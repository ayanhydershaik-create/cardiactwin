
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_sample_weight


# --------------------------------------------------
# 1. Paths
# --------------------------------------------------

BASE = Path(r"C:\CardiacDigitalTwin\ecg_pipeline")
DATA_PATH = BASE / "prepared_heartbeat_data.npz"
MODEL_PATH = BASE / "heartbeat_random_forest.joblib"


# --------------------------------------------------
# 2. Check and load the prepared dataset
# --------------------------------------------------

if not DATA_PATH.exists():
    raise FileNotFoundError(
        f"Dataset not found: {DATA_PATH}\n"
        "Run prepare_dataset.py first."
    )

# Only use allow_pickle=True for a trusted local dataset.
with np.load(DATA_PATH, allow_pickle=True) as data:
    required_keys = {"X_train", "X_test", "y_train", "y_test"}
    missing_keys = required_keys - set(data.files)

    if missing_keys:
        raise KeyError(f"Missing dataset keys: {sorted(missing_keys)}")

    X_train = data["X_train"].astype(np.float32)
    X_test = data["X_test"].astype(np.float32)
    y_train = data["y_train"].astype(str)
    y_test = data["y_test"].astype(str)


# --------------------------------------------------
# 3. Validate data
# --------------------------------------------------

if X_train.ndim != 2 or X_test.ndim != 2:
    raise ValueError("Feature arrays must be two-dimensional.")

if X_train.shape[1] != X_test.shape[1]:
    raise ValueError("Training and testing feature counts differ.")

if len(X_train) != len(y_train):
    raise ValueError("Training features and labels have different lengths.")

if len(X_test) != len(y_test):
    raise ValueError("Testing features and labels have different lengths.")

if len(y_train) == 0 or len(y_test) == 0:
    raise ValueError("Training or testing dataset is empty.")

if not np.isfinite(X_train).all() or not np.isfinite(X_test).all():
    raise ValueError("Features contain NaN or infinite values.")


print("Dataset loaded successfully.")
print("Training shape:", X_train.shape)
print("Testing shape:", X_test.shape)

print(
    "\nTraining labels:",
    dict(zip(*np.unique(y_train, return_counts=True))),
)
print(
    "Testing labels:",
    dict(zip(*np.unique(y_test, return_counts=True))),
)


# --------------------------------------------------
# 4. Calculate balanced sample weights
# --------------------------------------------------

sample_weights = compute_sample_weight(
    class_weight="balanced",
    y=y_train,
)


# --------------------------------------------------
# 5. Train Random Forest
# --------------------------------------------------

model = RandomForestClassifier(
    n_estimators=300,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
)

print("\nTraining Random Forest...")
model.fit(X_train, y_train, sample_weight=sample_weights)
print("Training finished.")


# --------------------------------------------------
# 6. Evaluate the model
# --------------------------------------------------

predictions = model.predict(X_test)

labels = ["N", "Q", "S", "V"]

print("\nClassification report:")
print(
    classification_report(
        y_test,
        predictions,
        labels=labels,
        zero_division=0,
    )
)

print("Confusion matrix (labels N, Q, S, V):")
print(
    confusion_matrix(
        y_test,
        predictions,
        labels=labels,
    )
)


# --------------------------------------------------
# 7. Save the trained model
# --------------------------------------------------

joblib.dump(model, MODEL_PATH)

print("\nModel saved to:", MODEL_PATH)
print("Training complete.")

print(
    "\nResearch note: This is a preliminary research baseline, "
    "not a clinically validated diagnostic model. Rare classes "
    "have very few training examples, and the test distribution "
    "is highly imbalanced. Evaluate generalization carefully "
    "before drawing clinical conclusions."
)
