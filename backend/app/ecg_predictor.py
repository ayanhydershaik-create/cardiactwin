
from pathlib import Path

import joblib
import numpy as np


# Model saved by ecg_pipeline/train_model.py
MODEL_PATH = (
    Path(r"C:\CardiacDigitalTwin\ecg_pipeline")
    / "heartbeat_random_forest.joblib"
)

EXPECTED_FEATURES = 234


def load_model():
    """Load the trained research model."""
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Trained ECG model was not found: {MODEL_PATH}"
        )

    model = joblib.load(MODEL_PATH)

    if getattr(model, "n_features_in_", None) != EXPECTED_FEATURES:
        raise ValueError(
            f"Expected a model trained on {EXPECTED_FEATURES} features."
        )

    return model


# Load once when this module is imported.
model = load_model()


def predict_heartbeat(features: list[float]) -> dict:
    """
    Predict a heartbeat class from exactly 234 prepared features.

    This expects the same feature representation used during training,
    not a raw ECG waveform.
    """
    if len(features) != EXPECTED_FEATURES:
        raise ValueError(
            f"Exactly {EXPECTED_FEATURES} features are required; "
            f"received {len(features)}."
        )

    try:
        values = np.asarray(features, dtype=np.float32)
    except (TypeError, ValueError) as exc:
        raise ValueError("Features must be numerical values.") from exc

    if not np.isfinite(values).all():
        raise ValueError("Features must all be finite numbers.")

    probabilities = model.predict_proba(values.reshape(1, -1))[0]
    classes = model.classes_
    best_index = int(np.argmax(probabilities))

    return {
        "predicted_class": str(classes[best_index]),
        "class_probabilities": {
            str(label): round(float(probability), 6)
            for label, probability in zip(classes, probabilities)
        },
        "model_type": "RandomForest research baseline",
        "clinical_use": False,
    }
