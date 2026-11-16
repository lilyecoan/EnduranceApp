"""Health Auto Export (iOS app) REST pushes -> Activity / RecoveryMetric dicts.

The athlete installs Health Auto Export on their iPhone and adds a REST API
automation pointing at our ingest URL, with their personal token in an
Authorization header. Each request carries one data type (health metrics or
workouts) for a time window. Format reference:
https://help.healthyapps.dev/en/health-auto-export/export-format

This is also the path for Garmin users on iPhone: Garmin Connect can write
workouts, steps, sleep and heart rate to Apple Health (not HRV).

Payloads are untrusted: unknown metrics are ignored, values are range-checked,
and only the fields actually present are returned so a partial push never
blanks out values sent earlier.
"""
from collections import defaultdict
from datetime import date, datetime
from typing import Optional

from app.models.activity import SportType

SOURCE = "health_auto_export"
MAX_ITEMS = 20_000

_DISTANCE_TO_M = {"km": 1000.0, "m": 1.0, "mi": 1609.344, "yd": 0.9144, "ft": 0.3048}
_ENERGY_TO_KCAL = {"kcal": 1.0, "cal": 1.0, "kj": 0.239006}

# The docs give names as the Health app name in snake_case; a few vary by
# app version, so accept the common spellings.
_RESTING_HR = {"resting_heart_rate"}
_HRV_SDNN = {"heart_rate_variability", "heart_rate_variability_sdnn"}
_WEIGHT = {"weight_body_mass", "body_mass", "weight"}
_STEPS = {"step_count", "steps"}
_SLEEP = {"sleep_analysis"}

_WORKOUT_SPORT = [
    ("swim", SportType.swimming),
    ("cycl", SportType.cycling),
    ("bik", SportType.cycling),
    ("run", SportType.running),
    ("strength", SportType.strength),
    ("weight", SportType.strength),
    ("functional", SportType.strength),
]


def parse_date(value) -> Optional[datetime]:
    """"2024-02-06 14:30:00 -0800" (the app's usual format), or ISO 8601."""
    if not isinstance(value, str):
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S %z", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            return datetime.strptime(value.strip(), fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(value.strip())
    except ValueError:
        return None


def _num(value, lo: float, hi: float) -> Optional[float]:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return n if lo <= n <= hi else None


def _qty(obj, lo: float, hi: float) -> tuple[Optional[float], str]:
    """{"qty": 3.5, "units": "mi"} -> (3.5, "mi")."""
    if isinstance(obj, dict):
        return _num(obj.get("qty"), lo, hi), str(obj.get("units") or "").lower()
    return _num(obj, lo, hi), ""


def _sport(name: str) -> SportType:
    lowered = name.lower()
    for needle, sport in _WORKOUT_SPORT:
        if needle in lowered:
            return sport
    return SportType.other


def parse_metrics(metrics: list) -> list[dict]:
    """Daily wellness rows, each holding only the fields this push contained."""
    days: dict[date, dict] = defaultdict(dict)
    hrv: dict[date, list[float]] = defaultdict(list)
    sleep_segments: dict[date, dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for metric in metrics[:MAX_ITEMS]:
        if not isinstance(metric, dict):
            continue
        name = str(metric.get("name") or "").lower()
        units = str(metric.get("units") or "").lower()
        entries = metric.get("data") if isinstance(metric.get("data"), list) else []
        for entry in entries[:MAX_ITEMS]:
            if not isinstance(entry, dict):
                continue
            when = parse_date(entry.get("date"))
            if when is None:
                continue
            day = when.date()
            if name in _RESTING_HR:
                value = _num(entry.get("qty"), 20, 150)
                if value is not None:
                    days[day]["resting_hr"] = round(value)
            elif name in _HRV_SDNN:
                value = _num(entry.get("qty"), 1, 300)
                if value is not None:
                    hrv[day].append(value)
            elif name in _WEIGHT:
                value = _num(entry.get("qty"), 20, 700)
                if value is not None:
                    days[day]["weight_kg"] = round(value * 0.45359237 if units in ("lb", "lbs") else value, 1)
            elif name in _STEPS:
                value = _num(entry.get("qty"), 0, 200_000)
                if value is not None:
                    days[day]["steps"] = days[day].get("steps", 0) + round(value)
            elif name in _SLEEP:
                if "totalSleep" in entry or "asleep" in entry:
                    # Summarized: one entry per night, durations in hours.
                    total = _num(entry.get("totalSleep"), 0, 24)
                    if total is None:
                        parts = [_num(entry.get(k), 0, 24) or 0 for k in ("asleep", "core", "deep", "rem")]
                        total = sum(parts) or None
                    if total is not None:
                        days[day]["sleep_duration_seconds"] = round(total * 3600)
                        for key, column in (("deep", "sleep_deep_seconds"), ("rem", "sleep_rem_seconds"),
                                            ("core", "sleep_light_seconds"), ("awake", "sleep_awake_seconds")):
                            part = _num(entry.get(key), 0, 24)
                            if part is not None:
                                days[day][column] = round(part * 3600)
                else:
                    # Unsummarized segments: attribute to the night they end on.
                    end = parse_date(entry.get("endDate") or entry.get("end")) or when
                    hours = _num(entry.get("qty"), 0, 24)
                    stage = str(entry.get("value") or "").lower()
                    if hours is None or stage in ("in bed", "inbed"):
                        continue
                    bucket = sleep_segments[end.date()]
                    if stage == "awake":
                        bucket["awake"] += hours
                    else:
                        bucket["total"] += hours
                        if stage in ("deep", "rem", "core"):
                            bucket[stage] += hours

    for day, values in hrv.items():
        days[day]["hrv_sdnn"] = round(sum(values) / len(values), 1)
    for day, bucket in sleep_segments.items():
        if bucket["total"] > 0 and "sleep_duration_seconds" not in days[day]:
            days[day]["sleep_duration_seconds"] = round(min(bucket["total"], 24) * 3600)
            for key, column in (("deep", "sleep_deep_seconds"), ("rem", "sleep_rem_seconds"),
                                ("core", "sleep_light_seconds"), ("awake", "sleep_awake_seconds")):
                if bucket.get(key):
                    days[day][column] = round(bucket[key] * 3600)

    return [{"date": day, **values} for day, values in sorted(days.items()) if values]


def parse_workouts(workouts: list) -> list[dict]:
    rows = []
    for w in workouts[:MAX_ITEMS]:
        if not isinstance(w, dict):
            continue
        start = parse_date(w.get("start"))
        if start is None:
            continue
        end = parse_date(w.get("end"))
        name = str(w.get("name") or "Workout")[:100]
        duration = _num(w.get("duration"), 0, 7 * 86400)
        if duration is None and end is not None:
            duration = (end - start).total_seconds()

        # v2 has a stable id; v1 doesn't, so fall back to name + start.
        workout_id = w.get("id") or f"{name}:{w.get('start')}"
        row: dict = {
            "external_id": f"hae:{workout_id}"[:200],
            "sport_type": _sport(name),
            "name": name,
            "start_time": start,
            "duration_seconds": round(duration) if duration is not None else None,
        }
        distance, unit = _qty(w.get("distance"), 0, 1_000_000)
        if distance is not None:
            row["distance_meters"] = round(distance * _DISTANCE_TO_M.get(unit, 1000.0), 1)
        energy, unit = _qty(w.get("activeEnergyBurned") or w.get("activeEnergy"), 0, 100_000)
        if energy is not None:
            row["calories"] = round(energy * _ENERGY_TO_KCAL.get(unit, 1.0))
        avg_hr = None
        if isinstance(w.get("heartRate"), dict):
            avg_hr, _ = _qty(w["heartRate"].get("avg"), 30, 250)
            max_hr, _ = _qty(w["heartRate"].get("max"), 30, 250)
            if max_hr is not None:
                row["max_hr"] = round(max_hr)
        if avg_hr is None:
            avg_hr, _ = _qty(w.get("avgHeartRate"), 30, 250)
        if avg_hr is not None:
            row["avg_hr"] = round(avg_hr)
        elevation, unit = _qty(w.get("elevationUp"), 0, 20_000)
        if elevation is not None:
            row["elevation_gain"] = round(elevation * (0.3048 if unit == "ft" else 1.0), 1)
        rows.append(row)
    return rows


def parse_payload(body) -> tuple[list[dict], list[dict]]:
    """(activities, recovery days) from one REST push."""
    data = body.get("data") if isinstance(body, dict) else None
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object with a 'data' field (Health Auto Export JSON format)")
    metrics = data.get("metrics") if isinstance(data.get("metrics"), list) else []
    workouts = data.get("workouts") if isinstance(data.get("workouts"), list) else []
    return parse_workouts(workouts), parse_metrics(metrics)
