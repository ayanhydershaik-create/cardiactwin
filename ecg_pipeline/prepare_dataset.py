
import ast
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

BASE = Path(r"C:\CardiacDigitalTwin\ecg_pipeline")
INPUT = BASE / "heartbeat_dataset.csv"

df = pd.read_csv(INPUT)

# Convert stored signal-window strings into numeric arrays.
signals = np.stack(
    df["signal_window"].apply(ast.literal_eval).to_numpy()
).astype(np.float32)

labels = df["label"].astype(str).to_numpy()
records = df["record"].astype(str).to_numpy()

print("Signal matrix shape:", signals.shape)
print("Class counts:")
print(pd.Series(labels).value_counts())

# Split by record to prevent beats from the same record
# appearing in both training and testing.
splitter = GroupShuffleSplit(
    n_splits=1,
    test_size=0.25,
    random_state=42,
)

train_idx, test_idx = next(
    splitter.split(signals, labels, groups=records)
)

print("\nTraining records:", sorted(set(records[train_idx])))
print("Testing records:", sorted(set(records[test_idx])))

print("\nTraining class counts:")
print(pd.Series(labels[train_idx]).value_counts())

print("\nTesting class counts:")
print(pd.Series(labels[test_idx]).value_counts())

# Save the prepared numerical arrays and metadata.
np.savez_compressed(
    BASE / "prepared_heartbeat_data.npz",
    X_train=signals[train_idx],
    X_test=signals[test_idx],
    y_train=labels[train_idx],
    y_test=labels[test_idx],
    train_records=records[train_idx],
    test_records=records[test_idx],
)

print("\nSaved prepared data to:")
print(BASE / "prepared_heartbeat_data.npz")
print("\nDataset preparation complete.")
