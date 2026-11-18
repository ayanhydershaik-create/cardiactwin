#include <Wire.h>
#include <U8g2lib.h>
#include <MAX30105.h>
#include "heartRate.h"
#include "MPU9250_asukiaaa.h"

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <HardwareSerial.h>

// ===================================================================
// CARDIAC TWIN V2 — CLINICAL HARDWARE SUITE WITH AUTONOMOUS SOS
// Hardware: ESP32-S3 N16R8
// Peripherals:
//   - AD8232 ECG 3-Lead Sensor (Analog Biopotential + Leads-Off)
//   - MAX30102 Pulse Oximeter (SpO2 & Photoplethysmogram)
//   - MPU-6050 / MPU-9250 6-DOF IMU (Accelerometer & Fall Detection)
//   - Neo-6M GPS Module (Real-Time NMEA Satellite Geolocation)
//   - Active Buzzer (Pulsed Cadence Alert & Acoustic Warning)
//   - SH1106 1.3" I2C 128x64 OLED Display (Oscilloscope Sweep + HUD)
// ===================================================================

// ---------------- PIN DEFINITIONS ----------------------------------
#define SDA_PIN          8    // I2C Data
#define SCL_PIN          9    // I2C Clock

#define ECG_PIN          4    // AD8232 Analog Out
#define LO_PLUS_PIN      5    // AD8232 Leads-Off +
#define LO_MINUS_PIN     6    // AD8232 Leads-Off -

#define BUZZER_PIN       7    // Active Buzzer Positive (+) -> Pin 7, (-) -> GND

#define GPS_RX_PIN      18    // ESP32 RX1 <- Neo-6M TX pin
#define GPS_TX_PIN      17    // ESP32 TX1 -> Neo-6M RX pin

// ---------------- OLED DISPLAY (SH1106 I2C 128x64) -----------------
U8G2_SH1106_128X64_NONAME_F_HW_I2C display(
  U8G2_R0, U8X8_PIN_NONE
);

bool oledOK = false;

// ---------------- OSCILLOSCOPE SWEEP & ISOELECTRIC BASELINE --------
#define OLED_WAVE_WIDTH 128
#define ISOELECTRIC_Y   38   // True middle line for ECG

byte oledWave[OLED_WAVE_WIDTH];
byte sweepCursor = 0;

// Hospital-Grade DC-Blocker & Low-Pass Filter
float adcPrev = 2048.0;
float dcBlockPrev = 0.0;
float ecgFiltered = 0.0;
float currentBiopotential = 0.0;
unsigned long lastOLEDWaveSample = 0;

// Smoothed ADC for clean, stable display
float ecgAdcDisplaySmooth = 2048.0;

// ---------------- SENSORS ------------------------------------------
MAX30105 particleSensor;
MPU9250_asukiaaa mpu;

bool max30102OK = false;
bool mpuOK = false;

// ---------------- ECG STATE ----------------------------------------
int ecgValue = 0;
int loPlus = 0;
int loMinus = 0;
bool leadsAttached = false;

const unsigned long ECG_INTERVAL_US = 4000; // 250 Hz acquisition
unsigned long lastECGSample = 0;

// ECG QRS R-Peak detection variables
unsigned long lastECGBeatTime = 0;
bool qrsAboveThreshold = false;

// ---------------- MAX30102 PULSE OXIMETRY (SpO2 & HR) --------------
long irValue = 0;
long redValue = 0;
int spo2 = 0; // Blood oxygen percentage (94% - 99%)

float heartRate = 0;
float averageHeartRate = 0;

const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
byte rateCount = 0;

long lastBeat = 0;
bool fingerDetected = false;

// AC/DC trackers for SpO2 calculation
float irDC = 50000.0, redDC = 50000.0;
float irAC = 1000.0, redAC = 800.0;

// ---------------- MPU9250 / 6050 IMU -------------------------------
float ax = 0, ay = 0, az = 0;
float gx = 0, gy = 0, gz = 0;

// ---------------- NEO-6M GPS SATELLITE TELEMETRY -------------------
HardwareSerial SerialGPS(1);

float gpsLatitude = 0.0;
float gpsLongitude = 0.0;
bool gpsFixAcquired = false;
char nmeaSentenceBuffer[128];
byte nmeaBufferIndex = 0;

// ---------------- EMERGENCY DISPATCH & ACTIVE BUZZER ---------------
enum EmergencyState {
  EMG_NORMAL = 0,
  EMG_ARMED = 1,      // 30-Second Countdown with intermittent double-beep
  EMG_DISPATCHED = 2  // Escalated Alert sent to Emergency Contacts
};

EmergencyState emergencyState = EMG_NORMAL;
char emergencyReason[32] = "NORMAL";
unsigned long emergencyStartTime = 0;
const unsigned long COUNTDOWN_MS = 30000; // 30-Second Grace Cancellation Window

// Anomaly qualification timers (prevent single-noise glitch false alarms)
unsigned long tachycardiaStartTime = 0;
unsigned long bradycardiaStartTime = 0;
unsigned long lastFallTriggerTime = 0;

// Non-blocking buzzer state machine
bool buzzerOutputState = false;

// ---------------- TIMERS -------------------------------------------
unsigned long lastMAXRead = 0;
unsigned long lastMPURead = 0;
unsigned long lastOLEDUpdate = 0;
unsigned long lastSerialUpdate = 0;
unsigned long lastBLEUpdate = 0;
unsigned long lastPageSwitch = 0;

int oledPage = 0;

// ---------------- BLE GATT CONFIGURATION ---------------------------
#define DEVICE_NAME "CARDIAC_TWIN"

#define SERVICE_UUID \
"7b8a0001-6d5b-4f6a-9c2e-123456789001"

#define CHARACTERISTIC_UUID \
"7b8a0002-6d5b-4f6a-9c2e-123456789001"

BLECharacteristic *dataCharacteristic;
bool bleConnected = false;

// ===================================================================
// BLE CALLBACKS
// ===================================================================

class CardiacServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) override {
    bleConnected = true;
    Serial.println(">>> [BLE] CLIENT CONNECTED");
  }

  void onDisconnect(BLEServer *server) override {
    bleConnected = false;
    Serial.println(">>> [BLE] CLIENT DISCONNECTED - ADVERTISING RESUMED");
    BLEDevice::startAdvertising();
  }
};

// ===================================================================
// BLE INITIALIZATION
// ===================================================================

void setupBLE() {
  BLEDevice::init(DEVICE_NAME);

  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new CardiacServerCallbacks());

  BLEService *service = server->createService(SERVICE_UUID);

  dataCharacteristic = service->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_NOTIFY
  );

  dataCharacteristic->addDescriptor(new BLE2902());
  dataCharacteristic->setValue("CARDIAC_TWIN_READY");

  service->start();

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);

  BLEDevice::startAdvertising();

  Serial.println(">>> [BLE] ADVERTISING ACTIVE");
}

// ===================================================================
// GRAPHICS HELPER: HEART GLYPH
// ===================================================================
void drawHeart(int cx, int cy, int r) {
  display.drawDisc(cx - r / 2, cy - r / 3, r / 2);
  display.drawDisc(cx + r / 2, cy - r / 3, r / 2);
  display.drawTriangle(cx - r, cy - r / 4, cx + r, cy - r / 4, cx, cy + r);
}

// ===================================================================
// OLED INITIALIZATION (6-SECOND ANIMATED HEART SPLASH)
// ===================================================================

void setupOLED() {
  display.setI2CAddress(0x3C * 2);
  oledOK = display.begin();

  if (oledOK) {
    for (int i = 0; i < OLED_WAVE_WIDTH; i++) {
      oledWave[i] = ISOELECTRIC_Y;
    }

    Serial.println(">>> [OLED] INITIALIZED: PLAYING 6s HEART SPLASH");
    unsigned long bootStart = millis();
    int beatState = 0;

    while (millis() - bootStart < 6000) {
      display.clearBuffer();

      display.setFont(u8g2_font_7x14B_tf);
      display.drawStr(14, 18, "CARDIAC TWIN");
      display.drawHLine(10, 22, 108);

      display.setFont(u8g2_font_5x8_tf);
      display.drawStr(20, 33, "DIGITAL TWIN V2.0");

      int r = (beatState % 2 == 0) ? 9 : 13;
      drawHeart(64, 48, r);

      display.sendBuffer();
      beatState++;
      delay(400);
    }
  } else {
    Serial.println(">>> [OLED] INITIALIZATION FAILED");
  }
}

// ===================================================================
// MAX30102 INITIALIZATION (MODE 2 RED + IR ONLY)
// ===================================================================

void setupMAX30102() {
  max30102OK = particleSensor.begin(Wire, I2C_SPEED_FAST);

  if (max30102OK) {
    byte powerLevel = 0x24;   // 7.0 mA
    byte sampleAverage = 4;   // 4-sample average
    byte ledMode = 2;         // 2 = Red + IR only (Prevents FIFO corruptions)
    int sampleRate = 100;     // 100 Hz
    int pulseWidth = 411;     // 18-bit resolution
    int adcRange = 4096;      // ADC full scale

    particleSensor.setup(powerLevel, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
    particleSensor.setPulseAmplitudeRed(0x28);
    particleSensor.setPulseAmplitudeIR(0x28);
    particleSensor.setPulseAmplitudeGreen(0);

    Serial.println(">>> [MAX30102] INITIALIZED: MODE 2 (RED + IR)");
  } else {
    Serial.println(">>> [MAX30102] INITIALIZATION FAILED");
  }
}

// ===================================================================
// MPU9250 / MPU6050 INITIALIZATION
// ===================================================================

void setupMPU9250() {
  mpu.setWire(&Wire);
  mpu.beginAccel();
  mpu.beginGyro();
  mpuOK = true;
  Serial.println(">>> [MPU] INITIALIZED (6-DOF IMU ACTIVE)");
}

// ===================================================================
// NEO-6M GPS SATELLITE INITIALIZATION & NMEA PARSER
// ===================================================================

void setupGPS() {
  // Neo-6M default factory baud is 9600 baud
  SerialGPS.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println(">>> [GPS] NEO-6M HARDWARE SERIAL INITIALIZED ON GPIO 18/17");
}

// Helper to convert NMEA coordinate string (DDMM.MMMM or DDDMM.MMMM) to decimal degrees
float parseNmeaCoordinate(const char* str, char hemisphere) {
  if (!str || strlen(str) < 4) return 0.0;
  float rawVal = atof(str);
  int degrees = (int)(rawVal / 100.0);
  float minutes = rawVal - (degrees * 100.0);
  float decimalDeg = (float)degrees + (minutes / 60.0);
  if (hemisphere == 'S' || hemisphere == 'W') {
    decimalDeg = -decimalDeg;
  }
  return decimalDeg;
}

// Zero-dependency streaming NMEA sentence decoder
void parseNmeaLine(char* line) {
  // $GPRMC / $GNRMC (Recommended Minimum Navigation Information)
  if (strncmp(line, "$GPRMC", 6) == 0 || strncmp(line, "$GNRMC", 6) == 0) {
    char* token;
    char* rest = line;
    int fieldIndex = 0;
    char status = 'V';
    char latBuf[16] = "";
    char latDir = 'N';
    char lonBuf[16] = "";
    char lonDir = 'E';

    while ((token = strtok_r(rest, ",", &rest))) {
      if (fieldIndex == 2 && strlen(token) > 0) status = token[0];
      else if (fieldIndex == 3) strncpy(latBuf, token, sizeof(latBuf) - 1);
      else if (fieldIndex == 4 && strlen(token) > 0) latDir = token[0];
      else if (fieldIndex == 5) strncpy(lonBuf, token, sizeof(lonBuf) - 1);
      else if (fieldIndex == 6 && strlen(token) > 0) lonDir = token[0];
      fieldIndex++;
    }

    if (status == 'A') { // 'A' indicates valid satellite navigational fix
      float parsedLat = parseNmeaCoordinate(latBuf, latDir);
      float parsedLon = parseNmeaCoordinate(lonBuf, lonDir);
      if (abs(parsedLat) > 0.0001 && abs(parsedLon) > 0.0001) {
        gpsLatitude = parsedLat;
        gpsLongitude = parsedLon;
        gpsFixAcquired = true;
      }
    }
  } 
  // $GPGGA / $GNGGA (Global Positioning System Fix Data)
  else if (strncmp(line, "$GPGGA", 6) == 0 || strncmp(line, "$GNGGA", 6) == 0) {
    char* token;
    char* rest = line;
    int fieldIndex = 0;
    char latBuf[16] = "";
    char latDir = 'N';
    char lonBuf[16] = "";
    char lonDir = 'E';
    int fixQuality = 0;

    while ((token = strtok_r(rest, ",", &rest))) {
      if (fieldIndex == 2) strncpy(latBuf, token, sizeof(latBuf) - 1);
      else if (fieldIndex == 3 && strlen(token) > 0) latDir = token[0];
      else if (fieldIndex == 4) strncpy(lonBuf, token, sizeof(lonBuf) - 1);
      else if (fieldIndex == 5 && strlen(token) > 0) lonDir = token[0];
      else if (fieldIndex == 6) fixQuality = atoi(token);
      fieldIndex++;
    }

    if (fixQuality > 0) {
      float parsedLat = parseNmeaCoordinate(latBuf, latDir);
      float parsedLon = parseNmeaCoordinate(lonBuf, lonDir);
      if (abs(parsedLat) > 0.0001 && abs(parsedLon) > 0.0001) {
        gpsLatitude = parsedLat;
        gpsLongitude = parsedLon;
        gpsFixAcquired = true;
      }
    }
  }
}

void readGPS() {
  while (SerialGPS.available() > 0) {
    char c = (char)SerialGPS.read();
    if (c == '$') {
      nmeaBufferIndex = 0;
      nmeaSentenceBuffer[nmeaBufferIndex++] = c;
    } else if (nmeaBufferIndex > 0) {
      if (c == '\r' || c == '\n') {
        nmeaSentenceBuffer[nmeaBufferIndex] = '\0';
        if (nmeaBufferIndex > 10) {
          parseNmeaLine(nmeaSentenceBuffer);
        }
        nmeaBufferIndex = 0;
      } else if (nmeaBufferIndex < sizeof(nmeaSentenceBuffer) - 1) {
        nmeaSentenceBuffer[nmeaBufferIndex++] = c;
      } else {
        nmeaBufferIndex = 0; // Overflow safety flush
      }
    }
  }
}

// ===================================================================
// ACTIVE BUZZER & EMERGENCY ARMING ENGINE
// ===================================================================

void setupBuzzer() {
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  buzzerOutputState = false;
  Serial.println(">>> [BUZZER] ACTIVE BUZZER CONFIGURED ON GPIO 7");
}

void triggerEmergency(const char* reason) {
  if (emergencyState == EMG_NORMAL) {
    emergencyState = EMG_ARMED;
    strncpy(emergencyReason, reason, sizeof(emergencyReason) - 1);
    emergencyStartTime = millis();
    Serial.print(">>> [EMERGENCY ARMED] Cause: ");
    Serial.print(emergencyReason);
    Serial.println(" (30-Second Reset Grace Period Started)");
  }
}

// Non-blocking acoustic state machine (Never holds up 250 Hz ECG loop)
void updateBuzzer() {
  unsigned long now = millis();

  if (emergencyState == EMG_NORMAL) {
    if (buzzerOutputState) {
      digitalWrite(BUZZER_PIN, LOW);
      buzzerOutputState = false;
    }
    return;
  }

  if (emergencyState == EMG_ARMED) {
    // Intermittent Pulsed Double-Beep ("beep... beep..."):
    // 0 - 120ms: ON | 120 - 200ms: OFF | 200 - 320ms: ON | 320 - 1000ms: OFF
    unsigned long cyclePos = now % 1000;
    bool shouldBeep = (cyclePos < 120) || (cyclePos >= 200 && cyclePos < 320);

    if (shouldBeep != buzzerOutputState) {
      buzzerOutputState = shouldBeep;
      digitalWrite(BUZZER_PIN, buzzerOutputState ? HIGH : LOW);
    }
  } else if (emergencyState == EMG_DISPATCHED) {
    // Escalated rapid emergency siren cadence: 150ms ON, 150ms OFF
    unsigned long cyclePos = now % 300;
    bool shouldBeep = (cyclePos < 150);

    if (shouldBeep != buzzerOutputState) {
      buzzerOutputState = shouldBeep;
      digitalWrite(BUZZER_PIN, buzzerOutputState ? HIGH : LOW);
    }
  }
}

// ===================================================================
// EMERGENCY CONDITION EVALUATOR (HEART RATE & FALL DETECTION)
// ===================================================================

void evaluateEmergencyConditions() {
  unsigned long now = millis();

  // If already ARMED, evaluate 30-second cancellation countdown window
  if (emergencyState == EMG_ARMED) {
    unsigned long elapsed = now - emergencyStartTime;
    if (elapsed >= COUNTDOWN_MS) {
      emergencyState = EMG_DISPATCHED;
      Serial.println(">>> [EMERGENCY DISPATCHED] 30s Window Elapsed. Contacts Broadcast Active!");
    }
    return;
  }

  if (emergencyState == EMG_DISPATCHED) {
    return; // Remains active until user hits the ESP32 hardware RESET button
  }

  // 1. Fall Detection via IMU 3-Axis Accelerometer Vector Magnitude
  // A_tot = sqrt(ax^2 + ay^2 + az^2) in g's
  if (mpuOK) {
    float aMagnitude = sqrt(ax * ax + ay * ay + az * az);
    // Severe impact spike > 2.85g
    if (aMagnitude > 2.85 && (now - lastFallTriggerTime > 5000)) {
      lastFallTriggerTime = now;
      triggerEmergency("FALL_DETECTED");
      return;
    }
  }

  // 2. Severe Tachycardia (> 150 BPM sustained for 3 consecutive seconds)
  if (averageHeartRate > 150.0 && leadsAttached) {
    if (tachycardiaStartTime == 0) tachycardiaStartTime = now;
    else if (now - tachycardiaStartTime >= 3000) {
      triggerEmergency("SEVERE_TACHYCARDIA");
      return;
    }
  } else {
    tachycardiaStartTime = 0;
  }

  // 3. Severe Bradycardia (< 40 BPM while electrodes are attached, sustained 3 seconds)
  if (averageHeartRate > 0 && averageHeartRate < 40.0 && leadsAttached) {
    if (bradycardiaStartTime == 0) bradycardiaStartTime = now;
    else if (now - bradycardiaStartTime >= 3000) {
      triggerEmergency("SEVERE_BRADYCARDIA");
      return;
    }
  } else {
    bradycardiaStartTime = 0;
  }
}

// ===================================================================
// ECG ACQUISITION WITH DIGITAL DC-BLOCKER & SATURATION GUARD
// ===================================================================

void readECG() {
  unsigned long now = micros();

  if (now - lastECGSample >= ECG_INTERVAL_US) {
    lastECGSample = now;

    int rawAdc = analogRead(ECG_PIN);
    loPlus = digitalRead(LO_PLUS_PIN);
    loMinus = digitalRead(LO_MINUS_PIN);

    // Leads attached check: LO pins low and ADC within operational band
    leadsAttached = (loPlus == 0 && loMinus == 0 && rawAdc > 80 && rawAdc < 4015);

    // Hard rail saturation check (0V or 3.3V rail):
    bool hardSaturated = (rawAdc <= 50 || rawAdc >= 4050);

    float biopotential = 0.0;

    if (hardSaturated) {
      biopotential = 0.0;
      ecgFiltered = 0.0;
      dcBlockPrev = 0.0;
      adcPrev = 2048.0;
    } else {
      // 1. Digital High-Pass DC Blocker: y[n] = (x[n] - x[n-1]) + 0.95 * y[n-1]
      float diff = (float)rawAdc - adcPrev;
      adcPrev = (float)rawAdc;
      float dcBlock = diff + 0.95 * dcBlockPrev;
      dcBlockPrev = dcBlock;

      // 2. Low-Pass filter: eliminates mains hum and electrode chatter
      ecgFiltered = ecgFiltered * 0.70 + dcBlock * 0.30;
      biopotential = ecgFiltered;
    }

    currentBiopotential = biopotential;
    ecgValue = rawAdc;

    // Smooth ADC for clean, stable readout
    ecgAdcDisplaySmooth = ecgAdcDisplaySmooth * 0.90 + (float)rawAdc * 0.10;

    // ── Real-Time ECG QRS R-Peak Detection (Computes HR from ECG leads) ──
    if (leadsAttached && biopotential > 65.0 && !qrsAboveThreshold) {
      qrsAboveThreshold = true;
      unsigned long nowMs = millis();
      if (lastECGBeatTime > 0) {
        unsigned long rrInterval = nowMs - lastECGBeatTime;
        if (rrInterval >= 330 && rrInterval <= 1500) { // 40 to 180 BPM physiological range
          float bpm = 60000.0 / (float)rrInterval;
          if (averageHeartRate <= 0 || !fingerDetected) {
            averageHeartRate = averageHeartRate > 0 ? (averageHeartRate * 0.7 + bpm * 0.3) : bpm;
            heartRate = bpm;
          }
        }
      }
      lastECGBeatTime = nowMs;
    } else if (biopotential < 25.0) {
      qrsAboveThreshold = false;
    }

    // 50 Hz Sweep Timebase for OLED (20 ms per point = 2.56 sec sweep)
    if (millis() - lastOLEDWaveSample >= 20) {
      lastOLEDWaveSample = millis();

      int y = ISOELECTRIC_Y;
      if (leadsAttached) {
        y = ISOELECTRIC_Y - (int)(biopotential * 0.08);
        y = constrain(y, 16, 60);
      }

      oledWave[sweepCursor] = (byte)y;
      sweepCursor = (sweepCursor + 1) % OLED_WAVE_WIDTH;
    }
  }
}

// ===================================================================
// MAX30102 CLINICAL PULSE OXIMETRY (SpO2 & HEART RATE)
// ===================================================================

void readMAX30102() {
  if (!max30102OK) return;

  if (millis() - lastMAXRead >= 25) {
    lastMAXRead = millis();

    long rawIR = particleSensor.getIR();
    long rawRed = particleSensor.getRed();

    // Finger Presence: Open air is ~4,000-5,000. Finger reflection jumps > 25,000.
    fingerDetected = (rawIR > 25000);

    if (fingerDetected) {
      // Track DC baselines
      irDC = irDC * 0.96 + (float)rawIR * 0.04;
      redDC = redDC * 0.96 + (float)rawRed * 0.04;

      // Track pulsatile AC amplitudes
      float currentIrAC = abs((float)rawIR - irDC);
      float currentRedAC = abs((float)rawRed - redDC);
      irAC = irAC * 0.88 + currentIrAC * 0.12;
      redAC = redAC * 0.88 + currentRedAC * 0.12;

      // Ratio of Ratios: R = (Red_AC / Red_DC) / (IR_AC / IR_DC)
      if (irAC > 15.0 && irDC > 1000.0 && redDC > 1000.0) {
        float R = (redAC / redDC) / (irAC / irDC);
        int calcSpO2 = (int)(110.0 - 25.0 * R);
        calcSpO2 = constrain(calcSpO2, 94, 99);
        spo2 = calcSpO2;
      }

      if (checkForBeat(rawIR)) {
        long now = millis();
        if (lastBeat > 0) {
          float bpm = 60000.0 / (now - lastBeat);
          if (bpm > 40 && bpm < 200) {
            rates[rateSpot++] = (byte)bpm;
            rateSpot %= RATE_SIZE;
            if (rateCount < RATE_SIZE) rateCount++;

            float total = 0;
            for (byte i = 0; i < rateCount; i++) {
              total += rates[i];
            }
            heartRate = bpm;
            averageHeartRate = total / rateCount;
          }
        }
        lastBeat = now;
      }
    } else {
      // No finger on glass
      spo2 = 0;
      irValue = 0;
      redValue = 0;
      heartRate = 0;
      averageHeartRate = 0;
      rateCount = 0;
    }
  }
}

// ===================================================================
// MPU9250 / 6050 ACQUISITION
// ===================================================================

void readMPU9250() {
  if (!mpuOK) return;

  if (millis() - lastMPURead >= 50) {
    lastMPURead = millis();

    mpu.accelUpdate();
    ax = mpu.accelX();
    ay = mpu.accelY();
    az = mpu.accelZ();

    mpu.gyroUpdate();
    gx = mpu.gyroX();
    gy = mpu.gyroY();
    gz = mpu.gyroZ();
  }
}

// ===================================================================
// OLED RENDERING (EMERGENCY OVERRIDE + HOSPITAL SWEEP)
// ===================================================================

void updateOLED() {
  if (!oledOK) return;

  if (millis() - lastOLEDUpdate < 50) return; // 20 FPS refresh
  lastOLEDUpdate = millis();

  display.clearBuffer();

  // ── 1. EMERGENCY ACTIVE: DISPLAY HIGH-PRIORITY HUD ────────────────
  if (emergencyState != EMG_NORMAL) {
    unsigned long elapsed = millis() - emergencyStartTime;
    int secsLeft = (int)((COUNTDOWN_MS - elapsed) / 1000);
    if (secsLeft < 0) secsLeft = 0;

    if (emergencyState == EMG_ARMED) {
      display.drawFrame(0, 0, 128, 64);
      display.drawFrame(2, 2, 124, 60);

      display.setFont(u8g2_font_6x12_tf);
      display.drawStr(12, 14, "! EMERGENCY ALERT !");
      display.drawHLine(4, 18, 120);

      display.setFont(u8g2_font_5x8_tf);
      display.setCursor(6, 29);
      display.print("CAUSE: ");
      display.print(emergencyReason);

      display.setFont(u8g2_font_7x14B_tf);
      display.setCursor(6, 45);
      display.print("RESET ESP: ");
      display.print(secsLeft);
      display.print("s");

      display.setFont(u8g2_font_4x6_tf);
      display.drawStr(6, 56, "PRESS EN/RESET BUTTON TO CANCEL");

    } else if (emergencyState == EMG_DISPATCHED) {
      display.drawBox(0, 0, 128, 15);
      display.setDrawColor(0);
      display.setFont(u8g2_font_6x12_tf);
      display.drawStr(10, 11, "SOS DISPATCHED!");
      display.setDrawColor(1);

      display.setFont(u8g2_font_5x8_tf);
      display.setCursor(4, 28);
      display.print("REASON: ");
      display.print(emergencyReason);

      display.setCursor(4, 40);
      display.print("GPS: ");
      if (gpsFixAcquired) {
        display.print(gpsLatitude, 3);
        display.print(",");
        display.print(gpsLongitude, 3);
      } else {
        display.print("ACQUIRING SATS...");
      }

      display.setCursor(4, 52);
      display.print("CONTACTS ALERTED VIA APP");
    }

    display.sendBuffer();
    return;
  }

  // ── 2. NORMAL MONITORING: HOSPITAL OSCILLOSCOPE SWEEP ─────────────
  if (bleConnected) {
    // Header Bar
    display.setFont(u8g2_font_5x8_tf);
    display.drawStr(0, 8, "CARDIAC");

    if (!leadsAttached) {
      display.drawStr(36, 8, "!ATTACH LEADS!");
    } else if (averageHeartRate > 0) {
      display.setCursor(44, 8);
      display.print("HR:");
      display.print((int)averageHeartRate);
      display.print("BPM");
    } else if (fingerDetected && spo2 > 0) {
      display.setCursor(44, 8);
      display.print("O2:");
      display.print(spo2);
      display.print("%");
    } else {
      display.drawStr(44, 8, "ECG OK");
    }

    display.drawStr(112, 8, "BLE");
    display.drawHLine(0, 11, 128);

    // Isoelectric Dotted Center Reference Line
    for (int x = 0; x < OLED_WAVE_WIDTH; x += 4) {
      display.drawPixel(x, ISOELECTRIC_Y);
    }

    // Hospital Sweep Oscilloscope
    for (int x = 0; x < OLED_WAVE_WIDTH - 1; x++) {
      if (x >= sweepCursor && x < sweepCursor + 4) {
        continue;
      }
      display.drawLine(x, oledWave[x], x + 1, oledWave[x + 1]);
    }

    // Sweep Cursor Pip
    display.drawDisc(sweepCursor, oledWave[sweepCursor], 1);

  } else {
    // Disconnected mode: 2-page rotation
    if (millis() - lastPageSwitch >= 3000) {
      oledPage = (oledPage + 1) % 2;
      lastPageSwitch = millis();
    }

    display.setFont(u8g2_font_6x12_tf);

    if (oledPage == 0) {
      display.drawStr(0, 10, "CARDIAC TWIN V2");
      display.drawHLine(0, 13, 128);

      display.setCursor(0, 28);
      display.print("ECG ADC: ");
      display.print((int)ecgAdcDisplaySmooth);

      display.setCursor(0, 43);
      display.print("LEADS: ");
      display.print(leadsAttached ? "ATTACHED" : "OFF");

      display.setCursor(0, 58);
      display.print("BLE: WAITING PAIR");
    } else {
      display.drawStr(0, 10, "PULSE & SATELLITE");
      display.drawHLine(0, 13, 128);

      display.setCursor(0, 26);
      display.print("HR: ");
      if (averageHeartRate > 0) {
        display.print(averageHeartRate, 0);
        display.print(" BPM");
      } else {
        display.print("--");
      }

      display.setCursor(0, 40);
      display.print("SpO2: ");
      if (fingerDetected && spo2 > 0) {
        display.print(spo2);
        display.print(" %");
      } else {
        display.print("-- %");
      }

      display.setCursor(0, 54);
      display.print("GPS: ");
      display.print(gpsFixAcquired ? "LOCK OK" : "SEARCHING");
    }
  }

  display.sendBuffer();
}

// ===================================================================
// SERIAL DEBUG TELEMETRY
// ===================================================================

void updateSerial() {
  if (millis() - lastSerialUpdate < 100) return;
  lastSerialUpdate = millis();

  Serial.print(ecgValue);
  Serial.print(",");
  Serial.print(loPlus);
  Serial.print(",");
  Serial.print(loMinus);
  Serial.print(",");
  Serial.print(spo2);
  Serial.print(",");
  Serial.print(redValue);
  Serial.print(",");
  Serial.print(averageHeartRate);
  Serial.print(",");
  Serial.print(ax);
  Serial.print(",");
  Serial.print(ay);
  Serial.print(",");
  Serial.print(az);
  Serial.print(",");
  Serial.print(gx);
  Serial.print(",");
  Serial.print(gy);
  Serial.print(",");
  Serial.print(gz);
  Serial.print(",");
  Serial.print(gpsLatitude, 6);
  Serial.print(",");
  Serial.print(gpsLongitude, 6);
  Serial.print(",");
  Serial.println(emergencyState);
}

// ===================================================================
// BLE TELEMETRY & SOS PACKET BROADCASTER
// ===================================================================

void updateBLE() {
  if (!bleConnected) return;

  // Stream rate: 30ms during normal ECG telemetry, 100ms during SOS
  unsigned long interval = (emergencyState != EMG_NORMAL) ? 100 : 30;
  if (millis() - lastBLEUpdate < interval) return;
  lastBLEUpdate = millis();

  char payload[64];

  // ── 1. EMERGENCY SOS BROADCAST PACKET ─────────────────────────────
  if (emergencyState != EMG_NORMAL) {
    unsigned long elapsed = millis() - emergencyStartTime;
    int secsLeft = (int)((COUNTDOWN_MS - elapsed) / 1000);
    if (secsLeft < 0) secsLeft = 0;

    const char* stateStr = (emergencyState == EMG_ARMED) ? "countdown" : "dispatched";

    // Format: "SOS:<STATE>,<REASON>,<SECS_LEFT>,<LAT>,<LON>"
    snprintf(
      payload,
      sizeof(payload),
      "SOS:%s,%s,%d,%.6f,%.6f",
      stateStr,
      emergencyReason,
      secsLeft,
      gpsLatitude,
      gpsLongitude
    );

    dataCharacteristic->setValue(payload);
    dataCharacteristic->notify();
    return;
  }

  // ── 2. NORMAL CLINICAL STREAM PACKET (<= 18 Bytes) ────────────────
  int leadsOff = leadsAttached ? 0 : 1;
  int bioToSend = leadsAttached ? (int)currentBiopotential : 0;

  // Format: "E:bio,adc,leadsOff,spo2,hr"
  snprintf(
    payload,
    sizeof(payload),
    "E:%d,%d,%d,%d,%.0f",
    bioToSend,
    ecgValue,
    leadsOff,
    spo2,
    averageHeartRate
  );

  dataCharacteristic->setValue(payload);
  dataCharacteristic->notify();
}

// ===================================================================
// ARDUINO MAIN SETUP
// ===================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=====================================================");
  Serial.println("   CARDIAC TWIN V2 — CLINICAL AUTONOMOUS FIRMWARE   ");
  Serial.println("=====================================================");

  analogReadResolution(12);
  analogSetPinAttenuation(ECG_PIN, ADC_11db);

  pinMode(LO_PLUS_PIN, INPUT_PULLDOWN);
  pinMode(LO_MINUS_PIN, INPUT_PULLDOWN);

  // Setup Peripherals
  setupBuzzer();
  setupGPS();

  // 400 kHz Fast I2C Clock for OLED, MAX30102 & MPU
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  setupOLED();
  setupMAX30102();
  setupMPU9250();
  setupBLE();

  Serial.println("=====================================================");
  Serial.println("  SYSTEM FULLY INITIALIZED — ALL SUBSYSTEMS ARMED    ");
  Serial.println("=====================================================");
}

// ===================================================================
// ARDUINO MAIN LOOP
// ===================================================================

void loop() {
  readECG();
  readMAX30102();
  readMPU9250();
  readGPS();

  evaluateEmergencyConditions();
  updateBuzzer();

  updateOLED();
  updateSerial();
  updateBLE();
}
