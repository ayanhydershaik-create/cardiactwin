
from pathlib import Path

import numpy as np
import pandas as pd
import wfdb
from scipy.signal import find_peaks, butter, sosfiltfilt

DATA_DIR = Path(r"C:\CardiacDigitalTwin\data\mitdb")
RECORD_PATH = DATA_DIR / "100"
OUTPUT_PATH = Path(
    r"C:\CardiacDigitalTwin\ecg_pipeline\record100_features.csv"
)

print("Loading ECG record...")
record = wfdb.rdrecord(str(RECORD_PATH), physical=True)

signal = record.p_signal[:, 0]
fs = float(record.fs)

# Band-pass filter: retain common ECG frequencies.
sos = butter(
    3,
    [5, 20],
    btype="bandpass",
    fs=fs,
    output="sos",
)
filtered = sosfiltfilt(sos, signal)

# Detect candidate R peaks with a minimum spacing of 250 ms.
minimum_distance = int(0.25 * fs)
prominence = max(float(np.std(filtered)) * 0.8, 0.05)

peaks, properties = find_peaks(
    filtered,
    distance=minimum_distance,
    prominence=prominence,
)

# Convert detected peak positions to seconds.
peak_times = peaks / fs
rr_intervals = np.diff(peak_times)

if len(rr_intervals) == 0:
    raise RuntimeError(
        "Not enough R peaks detected to calculate RR intervals."
    )

# Keep plausible intervals for this research feature summary.
valid_rr = rr_intervals[
    (rr_intervals >= 0.30) & (rr_intervals <= 2.00)
]

if len(valid_rr) == 0:
    raise RuntimeError(
        "No plausible RR intervals found. Review peak detection."
    )

heart_rates = 60.0 / valid_rr

features = {
    "record_name": record.record_name,
    "sampling_rate_hz": fs,
    "duration_seconds": len(signal) / fs,
    "detected_peak_count": len(peaks),
    "valid_rr_interval_count": len(valid_rr),
    "mean_rr_seconds": float(np.mean(valid_rr)),
    "median_rr_seconds": float(np.median(valid_rr)),
    "mean_heart_rate_bpm": float(np.mean(heart_rates)),
    "median_heart_rate_bpm": float(np.median(heart_rates)),
    "signal_mean_mv": float(np.mean(signal)),
    "signal_std_mv": float(np.std(signal)),
}

print("\nECG feature summary")
for name, value in features.items():
    print(f"{name}: {value}")

pd.DataFrame([features]).to_csv(OUTPUT_PATH, index=False)
print(f"\nFeatures saved to: {OUTPUT_PATH}")
print("Research feature extraction complete.")
