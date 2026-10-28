import { apiClient } from '../services/api/client';
import { bleAdapter, DEFAULT_BLE_CONFIG } from '../services/ble/adapter';
import { PRESET_HEARTBEATS } from '../data/presetSamples';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✓ PASS: ${name}`);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error });
    console.error(`✗ FAIL: ${name} - ${error}`);
  }
}

export async function runAllTests() {
  console.log('\n--- Running Cardiac Digital Twin Frontend Verification Suite ---\n');

  // Test 1: Preset Samples Verification
  await runTest('Presets: All 4 AAMI classes present and contain exactly 234 features', () => {
    assert(PRESET_HEARTBEATS.length === 4, 'Expected 4 preset classes');
    const labels = PRESET_HEARTBEATS.map((p) => p.label);
    assert(labels.includes('N'), 'Missing Class N');
    assert(labels.includes('S'), 'Missing Class S');
    assert(labels.includes('V'), 'Missing Class V');
    assert(labels.includes('Q'), 'Missing Class Q');

    PRESET_HEARTBEATS.forEach((preset) => {
      assert(
        preset.features.length === 234,
        `Preset ${preset.label} has ${preset.features.length} features; expected exactly 234`
      );
      assert(
        preset.features.every((v) => typeof v === 'number' && Number.isFinite(v)),
        `Preset ${preset.label} contains non-finite or invalid numbers`
      );
    });
  });

  // Test 2: ApiClient 234 Feature Validation
  await runTest('ApiClient: Rejects input with feature length != 234', async () => {
    let threw = false;
    try {
      await apiClient.predictHeartbeat([0.1, 0.2]); // Only 2 features
    } catch (err: unknown) {
      threw = true;
      assert(
        err instanceof Error && err.message.includes('Exactly 234 heartbeat features are required'),
        `Unexpected error message: ${err}`
      );
    }
    assert(threw, 'Expected predictHeartbeat to throw for 2 features');
  });

  // Test 3: ApiClient Non-finite Number Validation
  await runTest('ApiClient: Rejects array containing NaN or Infinity', async () => {
    const badFeatures = new Array(234).fill(0.0);
    badFeatures[42] = NaN;

    let threw = false;
    try {
      await apiClient.predictHeartbeat(badFeatures);
    } catch (err: unknown) {
      threw = true;
      assert(
        err instanceof Error && err.message.includes('invalid'),
        `Unexpected error message: ${err}`
      );
    }
    assert(threw, 'Expected predictHeartbeat to throw for NaN value');
  });

  // Test 4: BleAdapter Initial State & Defaults
  await runTest('BleAdapter: Initial state and default GATT parameters', () => {
    const config = bleAdapter.getConfig();
    assert(config.serviceUuid === DEFAULT_BLE_CONFIG.serviceUuid, 'Default service UUID mismatch');
    assert(config.characteristicUuid === DEFAULT_BLE_CONFIG.characteristicUuid, 'Default characteristic UUID mismatch');
    assert(config.sampleRateHz === 360, 'Target sample rate should be 360 Hz');

    bleAdapter.updateConfig({ sampleRateHz: 500 });
    assert(bleAdapter.getConfig().sampleRateHz === 500, 'Config update failed');
    bleAdapter.updateConfig({ sampleRateHz: 360 }); // restore
  });

  // Test 5: BleAdapter Status Subscription Callbacks
  await runTest('BleAdapter: Subscriber callback registration and notification', () => {
    let receivedStatus = '';
    const unsub = bleAdapter.onStatusChange((status) => {
      receivedStatus = status;
    });
    assert(receivedStatus.length > 0, 'Callback was not invoked with initial status');
    unsub();
  });

  console.log('\n--------------------------------------------------------------');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`Results: ${passedCount} / ${results.length} passed\n`);

  if (passedCount < results.length) {
    throw new Error(`${results.length - passedCount} test(s) failed`);
  }
}

// Note: This file is for documentation purposes.
// Run tests using: npm test (test_runner.mjs)
export {};
