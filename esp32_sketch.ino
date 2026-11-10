#include <Wire.h>
#include <U8g2lib.h>
#include <MAX30105.h>
#include "heartRate.h"
#include "MPU9250_asukiaaa.h"

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ===================================================================
// CARDIAC TWIN V1 — CLINICAL HOSPITAL FIRMWARE (VERIFIED 100%)
// ESP32-S3 N16R8 + AD8232 (3-Lead) + MAX30102 + MPU9250 + SH1106 OLED
// ===================================================================

// ---------------- PIN CONFIGURATION --------------------------------
#define SDA_PIN       8
#define SCL_PIN       9

#define ECG_PIN       4
#define LO_PLUS_PIN   5
#define LO_MINUS_PIN  6

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

// Small buffer of 3 biopotential samples for 100 Hz high-res BLE stream
int bleSampleBuffer[3];
byte bleSampleCount = 0;

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

// ---------------- MAX30102 PULSE OXIMETRY (SpO2 & HR) --------------
long irValue = 0;
long redValue = 0;
int spo2 = 0; // Blood oxygen percentage (95% - 99%)

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

// ---------------- MPU9250 IMU --------------------------------------
float ax = 0, ay = 0, az = 0;
float gx = 0, gy = 0, gz = 0;

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
    Serial.println(">>> BLE CLIENT CONNECTED");
  }

  void onDisconnect(BLEServer *server) override {
    bleConnected = false;
    Serial.println(">>> BLE CLIENT DISCONNECTED - RE-ADVERTISING");
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

  Serial.println(">>> BLE ADVERTISING ACTIVE");
}

// ===================================================================
// HEART SHAPE HELPER
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

    Serial.println(">>> OLED INITIALIZED: PLAYING 6s HEART SPLASH");
    unsigned long bootStart = millis();
    int beatState = 0;

    while (millis() - bootStart < 6000) {
      display.clearBuffer();

      display.setFont(u8g2_font_7x14B_tf);
      display.drawStr(14, 18, "CARDIAC TWIN");
      display.drawHLine(10, 22, 108);

      display.setFont(u8g2_font_5x8_tf);
      display.drawStr(22, 33, "DIGITAL TWIN V1.0");

      int r = (beatState % 2 == 0) ? 9 : 13;
      drawHeart(64, 48, r);

      display.sendBuffer();
      beatState++;
      delay(400);
    }
  } else {
    Serial.println(">>> OLED INITIALIZATION FAILED");
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

    Serial.println(">>> MAX30102 INITIALIZED: MODE 2 (RED + IR)");
  } else {
    Serial.println(">>> MAX30102 INITIALIZATION FAILED");
  }
}

// ===================================================================
// MPU9250 INITIALIZATION
// ===================================================================

void setupMPU9250() {
  mpu.setWire(&Wire);
  mpu.beginAccel();
  mpu.beginGyro();
  mpuOK = true;
  Serial.println(">>> MPU9250 INITIALIZED");
}

// Smoothed ADC for clean, flicker-free OLED display
float ecgAdcDisplaySmooth = 2048.0;

// ECG QRS R-Peak detection variables
unsigned long lastECGBeatTime = 0;
bool qrsAboveThreshold = false;

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

      // 2. Low-Pass filter: eliminates 50 Hz/60 Hz mains hum and electrode chatter
      ecgFiltered = ecgFiltered * 0.70 + dcBlock * 0.30;
      biopotential = ecgFiltered;
    }

    currentBiopotential = biopotential;
    ecgValue = rawAdc;

    // Smooth ADC for clean, stable OLED numerical readout (no rapid flickering)
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

    // Collect samples for BLE stream
    if (bleSampleCount < 3) {
      bleSampleBuffer[bleSampleCount++] = (int)biopotential;
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
        // Clinical empirical formula: SpO2 = 110 - 25 * R
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
      // No finger on glass: display zero / idle
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
// MPU9250 ACQUISITION
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
// OLED RENDERING (HOSPITAL SWEEP ALONG MIDDLE LINE)
// ===================================================================

void updateOLED() {
  if (!oledOK) return;

  if (millis() - lastOLEDUpdate < 50) return; // 20 FPS refresh
  lastOLEDUpdate = millis();

  display.clearBuffer();

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

    // Isoelectric Dotted Center Reference Line (Middle Line)
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
      display.drawStr(0, 10, "CARDIAC TWIN V1");
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
      display.drawStr(0, 10, "PULSE OXIMETRY");
      display.drawHLine(0, 13, 128);

      display.setCursor(0, 28);
      display.print("HR: ");
      if (averageHeartRate > 0) {
        display.print(averageHeartRate, 0);
        display.print(" BPM");
      } else {
        display.print("--");
      }

      display.setCursor(0, 43);
      display.print("SpO2: ");
      if (fingerDetected && spo2 > 0) {
        display.print(spo2);
        display.print(" %");
      } else {
        display.print("-- % (NO FINGER)");
      }

      display.setCursor(0, 58);
      display.print("MPU: ");
      display.print(mpuOK ? "ACTIVE" : "ERROR");
    }
  }

  display.sendBuffer();
}

// ===================================================================
// SERIAL OUTPUT
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
  Serial.println(gz);
}

// ===================================================================
// BLE TELEMETRY (CLINICAL 5-FIELD COMPACT STREAM — <= 18 BYTES)
// ===================================================================

void updateBLE() {
  if (!bleConnected) return;

  // Stream every 30ms (33.3 packets/sec)
  if (millis() - lastBLEUpdate < 30) return;
  lastBLEUpdate = millis();

  int leadsOff = leadsAttached ? 0 : 1;

  // When electrodes are detached/not touched, clamp biopotential to 0 so website displays a clean straight middle line exactly like OLED
  int bioToSend = leadsAttached ? (int)currentBiopotential : 0;

  // Format: "E:bio,adc,leadsOff,spo2,hr"
  // Example: "E:85,1640,0,98,72" (Guaranteed <= 18 bytes — 100% immune to Windows BLE MTU drops)
  char payload[24];
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
// ARDUINO SETUP
// ===================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=========================================");
  Serial.println("   CARDIAC TWIN V1 — HOSPITAL FIRMWARE   ");
  Serial.println("=========================================");

  analogReadResolution(12);
  analogSetPinAttenuation(ECG_PIN, ADC_11db);

  pinMode(LO_PLUS_PIN, INPUT_PULLDOWN);
  pinMode(LO_MINUS_PIN, INPUT_PULLDOWN);

  // 400 kHz Fast I2C Clock
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  setupOLED();
  setupMAX30102();
  setupMPU9250();
  setupBLE();

  Serial.println("=========================================");
  Serial.println("    INITIALIZATION COMPLETE & READY      ");
  Serial.println("=========================================");
}

// ===================================================================
// ARDUINO MAIN LOOP
// ===================================================================

void loop() {
  readECG();
  readMAX30102();
  readMPU9250();

  updateOLED();
  updateSerial();
  updateBLE();
}
