"""Parse athlete-uploaded files into Activity / RecoveryMetric dicts.

Supported:
- .fit workout files (from a watch, or Garmin Connect "Export Original")
- .zip of .fit files, including Garmin's "Export Your Data" archive (its
  workout files sit in nested zips one level down)
- Apple Health "Export All Health Data" (export.zip or export.xml):
  workouts, resting HR, HRV (SDNN), sleep, body mass

Uploaded files are untrusted: zip member counts and uncompressed sizes are
capped, and XML is parsed with defusedxml.
"""
import hashlib
import io
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from typing import IO, Optional

import fitdecode
from defusedxml.ElementTree import iterparse

from app.models.activity import SportType

SOURCE = "file_upload"
MAX_ZIP_MEMBERS = 5000
MAX_UNCOMPRESSED_BYTES = 4 * 1024**3

_FIT_SPORT_MAP = {
    "cycling": SportType.cycling,
    "running": SportType.running,
    "swimming": SportType.swimming,
    "training": SportType.strength,
    "transition": SportType.transition,
}

_HK_WORKOUT_MAP = {
    "HKWorkoutActivityTypeCycling": SportType.cycling,
    "HKWorkoutActivityTypeRunning": SportType.running,
    "HKWorkoutActivityTypeSwimming": SportType.swimming,
    "HKWorkoutActivityTypeTraditionalStrengthTraining": SportType.strength,
    "HKWorkoutActivityTypeFunctionalStrengthTraining": SportType.strength,
}

_HK_ASLEEP = {
    "HKCategoryValueSleepAnalysisAsleep",
    "HKCategoryValueSleepAnalysisAsleepUnspecified",
    "HKCategoryValueSleepAnalysisAsleepCore",
    "HKCategoryValueSleepAnalysisAsleepDeep",
    "HKCategoryValueSleepAnalysisAsleepREM",
}

_DURATION_TO_SECONDS = {"min": 60, "s": 1, "sec": 1, "hr": 3600, "h": 3600}
_DISTANCE_TO_METERS = {"km": 1000, "m": 1, "mi": 1609.344, "yd": 0.9144}


class UnsupportedFile(ValueError):
    pass


class ImportResult:
    def __init__(self):
        self.activities: list[dict] = []
        self.recovery: list[dict] = []
        self.files_processed = 0
        self.skipped: list[str] = []


def parse_upload(filename: str, data: bytes) -> ImportResult:
    result = ImportResult()
    name = filename.lower()
    if name.endswith(".fit"):
        _parse_fit(data, result)
    elif name.endswith(".xml"):
        _parse_apple_health(io.BytesIO(data), result)
    elif name.endswith(".zip"):
        _parse_zip(data, result, depth=0)
    else:
        raise UnsupportedFile("Upload a .fit file, a .zip of .fit files, or an Apple Health export (.zip or .xml).")
    return result


def _parse_zip(data: bytes, result: ImportResult, depth: int) -> None:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise UnsupportedFile("That .zip file could not be read.") from exc
    members = [m for m in archive.infolist() if not m.is_dir()]
    if len(members) > MAX_ZIP_MEMBERS or sum(m.file_size for m in members) > MAX_UNCOMPRESSED_BYTES:
        raise UnsupportedFile("That archive is too large to import.")

    for member in members:
        lower = member.filename.lower()
        if lower.rsplit("/", 1)[-1] == "export.xml":
            with archive.open(member) as stream:
                _parse_apple_health(stream, result)
        elif lower.endswith(".fit"):
            _parse_fit(archive.read(member), result)
        elif lower.endswith(".zip") and depth == 0:
            _parse_zip(archive.read(member), result, depth=1)


def _value(frame, field: str):
    return frame.get_value(field, fallback=None) if frame.has_field(field) else None


def _utc(dt) -> Optional[datetime]:
    if not isinstance(dt, datetime):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _parse_fit(data: bytes, result: ImportResult) -> None:
    """One activity per FIT `session` message (multisport files have several)."""
    digest = hashlib.sha256(data).hexdigest()[:32]
    sessions = []
    try:
        with fitdecode.FitReader(io.BytesIO(data), check_crc=fitdecode.CrcCheck.WARN) as fit:
            for frame in fit:
                if isinstance(frame, fitdecode.FitDataMessage) and frame.name == "session":
                    sessions.append(frame)
    except fitdecode.FitError:
        result.skipped.append(f"unreadable FIT file ({digest[:8]})")
        return

    result.files_processed += 1
    for index, session in enumerate(sessions):
        start = _utc(_value(session, "start_time"))
        if start is None:
            continue
        sport = str(_value(session, "sport") or "")
        duration = _value(session, "total_timer_time")
        distance = _value(session, "total_distance")
        result.activities.append(
            {
                "external_id": f"fit:{digest}:{index}",
                "sport_type": _FIT_SPORT_MAP.get(sport, SportType.other),
                "name": sport.replace("_", " ").title() or "Uploaded workout",
                "start_time": start,
                "duration_seconds": int(duration) if isinstance(duration, (int, float)) else None,
                "distance_meters": float(distance) if isinstance(distance, (int, float)) else None,
                "avg_hr": _value(session, "avg_heart_rate"),
                "max_hr": _value(session, "max_heart_rate"),
                "avg_power": _value(session, "avg_power"),
                "normalized_power": _value(session, "normalized_power"),
                "tss": _value(session, "training_stress_score"),
                "calories": _value(session, "total_calories"),
                "elevation_gain": _value(session, "total_ascent"),
            }
        )


def _hk_datetime(text: str) -> datetime:
    # Apple Health format: "2026-11-08 07:12:45 -0500"
    return datetime.strptime(text, "%Y-%m-%d %H:%M:%S %z")


def _parse_apple_health(stream: IO[bytes], result: ImportResult) -> None:
    resting: dict = {}
    hrv: dict = defaultdict(list)
    weight: dict = {}
    # (wake date, sourceName) -> {"total": s, "deep": s, "rem": s, "core": s}
    sleep: dict = defaultdict(lambda: defaultdict(float))

    for _event, elem in iterparse(stream, events=("end",)):
        tag = elem.tag
        if tag == "Record":
            kind = elem.get("type")
            if kind == "HKQuantityTypeIdentifierRestingHeartRate":
                resting[_hk_datetime(elem.get("startDate")).date()] = round(float(elem.get("value")))
            elif kind == "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":
                hrv[_hk_datetime(elem.get("startDate")).date()].append(float(elem.get("value")))
            elif kind == "HKQuantityTypeIdentifierBodyMass":
                value = float(elem.get("value"))
                kg = value * 0.45359237 if elem.get("unit") == "lb" else value
                weight[_hk_datetime(elem.get("startDate")).date()] = round(kg, 1)
            elif kind == "HKCategoryTypeIdentifierSleepAnalysis" and elem.get("value") in _HK_ASLEEP:
                start, end = _hk_datetime(elem.get("startDate")), _hk_datetime(elem.get("endDate"))
                seconds = (end - start).total_seconds()
                bucket = sleep[(end.date(), elem.get("sourceName") or "")]
                bucket["total"] += seconds
                stage = elem.get("value").removeprefix("HKCategoryValueSleepAnalysisAsleep").lower()
                if stage in ("deep", "rem", "core"):
                    bucket[stage] += seconds
            elem.clear()
        elif tag == "Workout":
            _add_hk_workout(elem, result)
            elem.clear()

    result.files_processed += 1

    # Several apps (e.g. Garmin Connect and Apple Watch) can each log the same
    # night; summing them would double-count, so keep the longest per night.
    best_sleep: dict = {}
    for (night, _source), stages in sleep.items():
        if night not in best_sleep or stages["total"] > best_sleep[night]["total"]:
            best_sleep[night] = stages

    for day in sorted(set(resting) | set(hrv) | set(weight) | set(best_sleep)):
        stages = best_sleep.get(day)
        result.recovery.append(
            {
                "date": day,
                "resting_hr": resting.get(day),
                "hrv_sdnn": round(sum(hrv[day]) / len(hrv[day]), 1) if hrv.get(day) else None,
                "weight_kg": weight.get(day),
                "sleep_duration_seconds": int(stages["total"]) if stages else None,
                "sleep_deep_seconds": int(stages["deep"]) if stages else None,
                "sleep_rem_seconds": int(stages["rem"]) if stages else None,
                "sleep_light_seconds": int(stages["core"]) if stages else None,
            }
        )


def _add_hk_workout(elem, result: ImportResult) -> None:
    start_text = elem.get("startDate")
    if not start_text:
        return
    duration = elem.get("duration")
    duration_seconds = None
    if duration:
        duration_seconds = int(float(duration) * _DURATION_TO_SECONDS.get(elem.get("durationUnit", "min"), 60))

    distance_m = None
    if elem.get("totalDistance"):
        distance_m = float(elem.get("totalDistance")) * _DISTANCE_TO_METERS.get(elem.get("totalDistanceUnit", "km"), 1000)
    else:
        for stat in elem.findall("WorkoutStatistics"):
            if (stat.get("type") or "").startswith("HKQuantityTypeIdentifierDistance") and stat.get("sum"):
                distance_m = float(stat.get("sum")) * _DISTANCE_TO_METERS.get(stat.get("unit", "km"), 1000)

    kind = elem.get("workoutActivityType", "")
    result.activities.append(
        {
            "external_id": f"apple:{kind}:{start_text}",
            "sport_type": _HK_WORKOUT_MAP.get(kind, SportType.other),
            "name": kind.removeprefix("HKWorkoutActivityType") or "Workout",
            "start_time": _hk_datetime(start_text),
            "duration_seconds": duration_seconds,
            "distance_meters": round(distance_m, 1) if distance_m is not None else None,
        }
    )
