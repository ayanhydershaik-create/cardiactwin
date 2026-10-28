
from pathlib import Path

import numpy as np
import pandas as pd
import wfdb

DATA_DIR = Path(r"C:\CardiacDigitalTwin\data\mitdb")
OUTPUT_DIR = Path(r"C:\CardiacDigitalTwin\ecg_pipeline")
OUTPUT_CSV = OUTPUT_DIR / "heartbeat_dataset.csv"

# Start with a small subset; expand after validating the pipeline.
RECORDS = ["100", "101", "102", "103", "104", "105"]

# Each heartbeat window: 0.25 s before and 0.40 s after annotation.
BEFORE_SECONDS = 0.25
AFTER_SECONDS = 0.40

# Map original MIT-BIH beat symbols to AAMI-style groups.
CLASS_MAP = {
    "N": "N", "L": "N", "R": "N", "e": "N", "j": "N",
    "A": "S", "a": "S", "J": "S", "S": "S",
    "V": "V", "E": "V",
    "F": "F",
    "/": "Q", "f": "Q", "Q": "Q",
}

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
rows = []

for record_name in RECORDS:
    record_path = DATA_DIR / record_name
    header_path = DATA_DIR / f"{record_name}.hea"
    annotation_path = DATA_DIR / f"{record_name}.atr"

    if not header_path.exists() or not annotation_path.exists():
        print(f"Skipping {record_name}: local files not found.")
        continue

    print(f"Processing record {record_name}...")

    record = wfdb.rdrecord(str(record_path), physical=True)
    annotation = wfdb.rdann(str(record_path), "atr")

    # Use one consistent ECG channel for this initial dataset.
    signal = record.p_signal[:, 0]
    fs = float(record.fs)

    before = int(BEFORE_SECONDS * fs)
    after = int(AFTER_SECONDS * fs)

    for sample, symbol in zip(annotation.sample, annotation.symbol):
        label = CLASS_MAP.get(symbol)
        if label is None:
            continue

        start = int(sample) - before
        end = int(sample) + after

        # Ignore windows extending beyond record boundaries.
        if start < 0 or end > len(signal):
            continue

        segment = signal[start:end]

        # Fixed length is required for machine learning.
        if len(segment) != before + after:
            continue

        rows.append({
            "record": record_name,
            "annotation_sample": int(sample),
            "annotation_symbol": symbol,
            "label": label,
            "signal_window": segment.astype(float).tolist(),
        })

if not rows:
    raise RuntimeError(
        "No heartbeat samples were created. Check which records "
        "are downloaded and whether their annotation files exist."
    )

df = pd.DataFrame(rows)
df.to_csv(OUTPUT_CSV, index=False)

print("\nDataset creation complete.")
print(f"Records included: {sorted(df['record'].unique().tolist())}")
print(f"Total heartbeat windows: {len(df)}")
print("\nClass counts:")
print(df["label"].value_counts().sort_index())
print(f"\nSaved dataset to: {OUTPUT_CSV}")
