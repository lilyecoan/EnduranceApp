import io
import time
import zipfile
from datetime import date, datetime, timezone

import jwt
import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException

from app.core import crypto
from app.core.config import settings
from app.models.activity import SportType
from app.services.sources import AI_EXCLUDED_SOURCES, file_import, intervals_icu, strava
from app.services.sync import _normalize


@pytest.fixture(autouse=True)
def encryption_key(monkeypatch):
    monkeypatch.setattr(settings, "token_encryption_key", Fernet.generate_key().decode())


# --- crypto / OAuth state -------------------------------------------------

def test_encrypt_round_trip_hides_plaintext():
    token = "secret-access-token"
    ciphertext = crypto.encrypt(token)
    assert token not in ciphertext
    assert crypto.decrypt(ciphertext) == token


def test_missing_encryption_key_is_a_clear_503(monkeypatch):
    monkeypatch.setattr(settings, "token_encryption_key", "")
    with pytest.raises(HTTPException) as exc:
        crypto.encrypt("x")
    assert exc.value.status_code == 503


def test_oauth_state_round_trip():
    state = crypto.sign_oauth_state("user-1", "strava", "/onboarding")
    claims = crypto.verify_oauth_state(state, "strava")
    assert claims["sub"] == "user-1" and claims["ret"] == "/onboarding"


def test_oauth_state_never_returns_to_arbitrary_url():
    state = crypto.sign_oauth_state("user-1", "strava", "https://evil.example")
    assert crypto.verify_oauth_state(state, "strava")["ret"] == "/settings"


def test_oauth_state_rejects_other_provider():
    state = crypto.sign_oauth_state("user-1", "strava")
    with pytest.raises(HTTPException) as exc:
        crypto.verify_oauth_state(state, "intervals_icu")
    assert exc.value.status_code == 400


def test_oauth_state_rejects_expired_and_forged():
    expired = jwt.encode(
        {"sub": "user-1", "provider": "strava", "exp": int(time.time()) - 10},
        settings.token_encryption_key,
        algorithm="HS256",
    )
    forged = jwt.encode(
        {"sub": "user-1", "provider": "strava", "exp": int(time.time()) + 600}, "wrong-key", algorithm="HS256"
    )
    for state in (expired, forged):
        with pytest.raises(HTTPException):
            crypto.verify_oauth_state(state, "strava")


# --- Intervals.icu --------------------------------------------------------

def test_intervals_wellness_mapping_keeps_rmssd_and_sdnn_separate():
    row = intervals_icu.map_wellness(
        {"id": "2026-11-08", "hrv": 62.5, "hrvSDNN": 80, "restingHR": 51, "sleepSecs": 27000,
         "sleepScore": 84.0, "readiness": 70, "weight": 63.5, "ctl": 41.2, "atl": 48.9}
    )
    assert row["date"] == date(2026, 11, 8)
    assert row["hrv_rmssd"] == 62.5 and row["hrv_sdnn"] == 80.0
    assert row["resting_hr"] == 51 and row["sleep_duration_seconds"] == 27000
    assert row["ctl"] == 41.2 and row["atl"] == 48.9


def test_intervals_wellness_missing_fields_stay_none():
    row = intervals_icu.map_wellness({"id": "2026-11-08"})
    assert row["hrv_rmssd"] is None and row["sleep_score"] is None
    assert intervals_icu.map_wellness({}) is None


def test_intervals_activity_prefers_utc_start():
    row = intervals_icu.map_activity(
        {"id": "i55751783", "type": "Ride", "start_date": "2026-11-08T12:35:18Z",
         "start_date_local": "2026-11-08T07:35:18", "moving_time": 3600, "distance": 30000.0,
         "icu_training_load": 55, "icu_average_watts": 120, "average_heartrate": 140}
    )
    assert row["external_id"] == "i55751783"
    assert row["sport_type"] == SportType.cycling
    assert row["start_time"] == datetime(2026, 11, 8, 12, 35, 18, tzinfo=timezone.utc)
    assert row["tss"] == 55.0 and row["avg_power"] == 120.0


def test_intervals_authorize_url_requests_read_scopes():
    url = intervals_icu.authorize_url("cid", "https://api.example/cb", "st")
    assert url.startswith("https://intervals.icu/oauth/authorize?")
    assert "scope=ACTIVITY%3AREAD%2CWELLNESS%3AREAD" in url and "state=st" in url


# --- Strava ---------------------------------------------------------------

def test_strava_is_excluded_from_ai():
    assert "strava" in AI_EXCLUDED_SOURCES
    assert "intervals_icu" not in AI_EXCLUDED_SOURCES


def test_strava_activity_mapping():
    row = strava.map_activity(
        {"id": 123, "sport_type": "TrailRun", "start_date": "2026-11-08T12:00:00Z",
         "moving_time": 1800, "distance": 5000.0, "average_heartrate": 150.4}
    )
    assert row["external_id"] == "123"
    assert row["sport_type"] == SportType.running
    assert row["avg_hr"] == 150


# --- file uploads ---------------------------------------------------------

APPLE_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (Record*)>
]>
<HealthData locale="en_US">
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Watch" unit="count/min"
   startDate="2026-11-08 06:00:00 -0500" endDate="2026-11-08 06:00:00 -0500" value="52"/>
 <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Watch" unit="ms"
   startDate="2026-11-08 03:00:00 -0500" endDate="2026-11-08 03:01:00 -0500" value="40"/>
 <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Watch" unit="ms"
   startDate="2026-11-08 04:00:00 -0500" endDate="2026-11-08 04:01:00 -0500" value="60"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale" unit="lb"
   startDate="2026-11-08 07:00:00 -0500" endDate="2026-11-08 07:00:00 -0500" value="140"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch"
   startDate="2026-11-07 23:00:00 -0500" endDate="2026-11-08 06:00:00 -0500" value="HKCategoryValueSleepAnalysisAsleepCore"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Garmin Connect"
   startDate="2026-11-07 23:30:00 -0500" endDate="2026-11-08 05:30:00 -0500" value="HKCategoryValueSleepAnalysisAsleep"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch"
   startDate="2026-11-08 06:00:00 -0500" endDate="2026-11-08 06:30:00 -0500" value="HKCategoryValueSleepAnalysisInBed"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30" durationUnit="min"
   totalDistance="3.1" totalDistanceUnit="mi" sourceName="Watch"
   startDate="2026-11-08 08:00:00 -0500" endDate="2026-11-08 08:30:00 -0500"/>
</HealthData>
"""


def test_apple_health_export_parsing():
    result = file_import.parse_upload("export.xml", APPLE_XML)
    assert result.files_processed == 1
    (day,) = result.recovery
    assert day["date"] == date(2026, 11, 8)
    assert day["resting_hr"] == 52
    assert day["hrv_sdnn"] == 50.0  # SDNN mean, never stored as rMSSD
    assert "hrv_rmssd" not in day
    assert day["weight_kg"] == 63.5  # 140 lb
    # Two apps logged the same night: keep the longer (7h), don't sum (13h).
    # "In bed" time is not sleep.
    assert day["sleep_duration_seconds"] == 7 * 3600
    (workout,) = result.activities
    assert workout["sport_type"] == SportType.running
    assert workout["duration_seconds"] == 1800
    assert workout["distance_meters"] == pytest.approx(4988.97, abs=0.1)


def _zip(members: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as archive:
        for name, data in members.items():
            archive.writestr(name, data)
    return buf.getvalue()


def test_apple_health_zip_export():
    result = file_import.parse_upload("export.zip", _zip({"apple_health_export/export.xml": APPLE_XML}))
    assert len(result.recovery) == 1 and len(result.activities) == 1


def test_unreadable_fit_is_skipped_not_fatal():
    result = file_import.parse_upload("bad.zip", _zip({"workouts/a.fit": b"not a fit file"}))
    assert result.activities == []
    assert len(result.skipped) == 1


def test_unsupported_upload_type():
    with pytest.raises(file_import.UnsupportedFile):
        file_import.parse_upload("notes.txt", b"hello")
    with pytest.raises(file_import.UnsupportedFile):
        file_import.parse_upload("broken.zip", b"not a zip")


def test_normalize_gives_rows_uniform_columns():
    rows = _normalize([{"external_id": "a", "avg_hr": 140}, {"external_id": "b"}, None], "u1", "file_upload")
    assert len(rows) == 2
    assert rows[1]["avg_hr"] is None
    assert all(r["user_id"] == "u1" and r["source"] == "file_upload" for r in rows)
