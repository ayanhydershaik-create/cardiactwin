import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const presetsPath = path.resolve(__dirname, '../../src_presets.json');
const presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name} -> ${err.message}`);
  }
}

console.log('\n========================================');
console.log(' Cardiac Digital Twin Frontend Test Suite');
console.log('========================================\n');

test('Verify authentic MIT-BIH preset dataset has 4 AAMI classes (N, S, V, Q)', () => {
  const keys = Object.keys(presets);
  if (!keys.includes('N') || !keys.includes('S') || !keys.includes('V') || !keys.includes('Q')) {
    throw new Error(`Expected classes N, S, V, Q. Found: ${keys.join(', ')}`);
  }
});

test('Verify each preset contains exactly 234 preprocessed numerical features', () => {
  for (const [key, val] of Object.entries(presets)) {
    if (!Array.isArray(val.features) || val.features.length !== 234) {
      throw new Error(`Class ${key} contains ${val.features ? val.features.length : 0} features; required exactly 234.`);
    }
    const hasInvalid = val.features.some((v) => typeof v !== 'number' || !Number.isFinite(v));
    if (hasInvalid) {
      throw new Error(`Class ${key} contains non-finite numerical values.`);
    }
  }
});

test('Verify MIT-BIH record sources are authentic (Records 100, 101)', () => {
  if (presets.N.record !== '100') throw new Error(`Expected record 100 for N, got ${presets.N.record}`);
  if (presets.Q.record !== '101') throw new Error(`Expected record 101 for Q, got ${presets.Q.record}`);
});

console.log('\n----------------------------------------');
console.log(` Summary: ${passed} / ${total} tests passed.`);
console.log('========================================\n');

if (passed < total) {
  process.exit(1);
}
