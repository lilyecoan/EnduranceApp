"""Training load (TSS-like) for a logged workout.

A workout's load is roughly hours x intensity^2 x 100 (the TrainingPeaks TSS
formula, with intensity as a fraction of threshold). Athletes usually log
time and how hard it felt, not power, so effort (RPE 1-10) is mapped to an
intensity factor. When the athlete only says how much they did ("50 miles
instead of 42"), the planned load is scaled by how much more or less they did.
"""
from typing import Optional

# Session RPE (1-10) -> intensity factor (fraction of threshold effort).
RPE_TO_INTENSITY = {1: 0.50, 2: 0.55, 3: 0.62, 4: 0.68, 5: 0.73, 6: 0.78, 7: 0.84, 8: 0.90, 9: 0.96, 10: 1.02}

# Used for unplanned work logged with time but no effort rating.
DEFAULT_INTENSITY = 0.70


def tss(duration_min: float, intensity: float) -> float:
    return duration_min / 60 * intensity**2 * 100


def _ratio(actual: Optional[float], planned: Optional[float]) -> Optional[float]:
    if actual is None or not planned:
        return None
    return max(0.0, actual / planned)


def estimate_load(
    *,
    status: str = "completed",
    planned_load: Optional[float] = None,
    planned_duration_min: Optional[float] = None,
    planned_distance_m: Optional[float] = None,
    actual_duration_min: Optional[float] = None,
    actual_distance_m: Optional[float] = None,
    rpe: Optional[int] = None,
) -> float:
    """Estimated load of what was actually done, rounded to a whole number."""
    if status == "skipped":
        return 0.0
    if actual_duration_min and rpe:
        value = tss(actual_duration_min, RPE_TO_INTENSITY[rpe])
    elif planned_load:
        # Prefer time over distance: it tracks effort better across terrain and sport.
        ratio = _ratio(actual_duration_min, planned_duration_min)
        if ratio is None:
            ratio = _ratio(actual_distance_m, planned_distance_m)
        value = planned_load * (1.0 if ratio is None else ratio)
    elif actual_duration_min:
        value = tss(actual_duration_min, RPE_TO_INTENSITY[rpe] if rpe else DEFAULT_INTENSITY)
    else:
        value = 0.0
    return float(round(min(value, 1000)))
