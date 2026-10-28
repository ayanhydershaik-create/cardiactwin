
from pathlib import Path

import numpy as np
import pandas as pd
import wfdb
from scipy.signal import butter, sosfiltfilt, find_peaks

DATA_DIR = Path(r"C:\CardiacDigitalTwin\data\mitdb")
RECORD_PATH = DATA_DIR / "100"
OUTPUT_PATH = Path(
    r"C:\CardiacDigitalTwin\ecg_pipeline\peak_validation.csv"
)

record = wfdb.rdrecord(str(RECORD_PATH), physical=True)
reference = wfdb.rdann(str(RECORD_PATH), "atr")

signal = record.p_signal[:, 0]
fs = float(record.fs)

# Filter ECG for candidate R-peak detection.
sos = butter(
    3, [5, 20], btype="bandpass", fs=fs, output="sos"
)
filtered = sosfiltfilt(sos, signal)

peaks, _ = find_peaks(
    filtered,
    distance=int(0.25 * fs),
    prominence=max(float(np.std(filtered)) * 0.8, 0.05),
)

# Keep reference annotations representing normal and
# other beat types, excluding non-beat annotations.
beat_symbols = set(
    "N L R B A a J S V r F e j n E / f Q ?"
)
ref_samples = np.array([
    sample
    for sample, symbol in zip(reference.sample, reference.symbol)
    if symbol in beat_symbols
])

# Match each detected peak to at most one reference beat
# within a tolerance of 150 milliseconds.
tolerance = int(0.150 * fs)
matched_reference = set()
true_positive = 0

for peak in peaks:
    candidates = [
        i for i, ref in enumerate(ref_samples)
        if i not in matched_reference
        and abs(int(ref) - int(peak)) <= tolerance
    ]
    if candidates:
        best = min(
            candidates,
            key=lambda i: abs(int(ref_samples[i]) - int(peak)),
        )
        matched_reference.add(best)
        true_positive += 1

false_positive = len(peaks) - true_positive
false_negative = len(ref_samples) - true_positive

precision = (
    true_positive / (true_positive + false_positive)
    if true_positive + false_positive else 0.0
)
sensitivity = (
    true_positive / (true_positive + false_negative)
    if true_positive + false_negative else 0.0
)
f1 = (
    2 * precision * sensitivity / (precision + sensitivity)
    if precision + sensitivity else 0.0
)

results = {
    "reference_beats": len(ref_samples),
    "detected_peaks": len(peaks),
    "true_positives": true_positive,
    "false_positives": false_positive,
    "false_negatives": false_negative,
    "precision": precision,
    "sensitivity": sensitivity,
    "f1_score": f1,
    "matching_tolerance_ms": 150,
}

print("\nR-peak validation summary")
for key, value in results.items():
    print(f"{key}: {value}")

pd.DataFrame([results]).to_csv(OUTPUT_PATH, index=False)
print(f"\nSaved results to: {OUTPUT_PATH}")
