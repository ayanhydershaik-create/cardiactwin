
from pathlib import Path

import matplotlib.pyplot as plt
import wfdb

DATA_DIR = Path(r"C:\CardiacDigitalTwin\data\mitdb")
RECORD_PATH = DATA_DIR / "100"
OUTPUT_PATH = Path(
    r"C:\CardiacDigitalTwin\ecg_pipeline\record100.png"
)

print("Checking MIT-BIH files...")

required_files = ["100.hea", "100.dat", "100.atr"]
missing_files = [
    name for name in required_files
    if not (DATA_DIR / name).exists()
]

if missing_files:
    print("Missing files:", ", ".join(missing_files))
    print("Please check the dataset download before continuing.")
    raise SystemExit(1)

print("All required files found.")
print("Reading ECG record...")

record = wfdb.rdrecord(str(RECORD_PATH), physical=True)
annotation = wfdb.rdann(str(RECORD_PATH), "atr")

signal = record.p_signal
sampling_rate = record.fs
duration_seconds = record.sig_len / sampling_rate

print(f"Record: {record.record_name}")
print(f"Sampling rate: {sampling_rate} Hz")
print(f"Channels: {record.n_sig}")
print(f"Duration: {duration_seconds / 60:.2f} minutes")
print(f"Signal shape: {signal.shape}")
print(f"Annotations: {len(annotation.sample)}")

sample_count = min(10 * sampling_rate, record.sig_len)
time_axis = [
    i / sampling_rate for i in range(sample_count)
]

plt.figure(figsize=(14, 5))
plt.plot(time_axis, signal[:sample_count, 0], linewidth=0.8)
plt.xlabel("Time (seconds)")
plt.ylabel("ECG amplitude (mV)")
plt.title("MIT-BIH Record 100 — First ECG Channel")
plt.grid(True)
plt.tight_layout()
plt.savefig(OUTPUT_PATH, dpi=150)

print(f"ECG plot saved to: {OUTPUT_PATH}")
plt.show()
