from datetime import date

import pytest

from app.models.activity import SportType
from app.routers.ingest import TOKEN_PREFIX, hash_token, new_token
from app.services.sources.health_auto_export import parse_metrics, parse_payload, parse_workouts

# Shapes copied from https://help.healthyapps.dev/en/health-auto-export/export-format
METRICS = [
    {"name": "step_count", "units": "count",
     "data": [{"qty": 8500, "date": "2024-02-06 14:30:00 -0800", "source": "Apple Watch"}]},
    {"name": "resting_heart_rate", "units": "count/min", "data": [{"qty": 52, "date": "2024-02-06 00:00:00 -0800"}]},
    {"name": "heart_rate_variability", "units": "ms",
     "data": [{"qty": 60, "date": "2024-02-06 03:00:00 -0800"}, {"qty": 70, "date": "2024-02-06 04:00:00 -0800"}]},
    {"name": "weight_body_mass", "units": "lb", "data": [{"qty": 140, "date": "2024-02-06 07:00:00 -0800"}]},
    {"name": "sleep_analysis", "units": "hr", "data": [{
        "date": "2024-02-06 00:00:00 -0800", "totalSleep": 7.5, "asleep": 0.5, "core": 3.5, "deep": 1.5, "rem": 2.0,
        "sleepStart": "2024-02-05 23:00:00 -0800", "sleepEnd": "2024-02-06 06:30:00 -0800", "inBed": 8.0,
        "awake": 0.0, "source": "Apple Watch"}]},
    {"name": "heart_rate", "units": "count/min",
     "data": [{"date": "2024-02-06 14:30:00 -0800", "Min": 65, "Avg": 72, "Max": 85}]},
]


def test_summarized_metrics_become_one_day():
    [day] = parse_metrics(METRICS)
    assert day == {
        "date": date(2024, 2, 6), "steps": 8500, "resting_hr": 52, "hrv_sdnn": 65.0, "weight_kg": 63.5,
        "sleep_duration_seconds": 27000, "sleep_deep_seconds": 5400, "sleep_rem_seconds": 7200,
        "sleep_light_seconds": 12600, "sleep_awake_seconds": 0,
    }


def test_partial_push_only_returns_fields_present():
    [day] = parse_metrics([METRICS[1]])
    assert day == {"date": date(2024, 2, 6), "resting_hr": 52}


def test_unsummarized_sleep_segments_sum_per_night():
    segments = [
        {"start": "2024-02-05 23:00:00 -0800", "end": "2024-02-06 02:00:00 -0800", "endDate": "2024-02-06 02:00:00 -0800",
         "date": "2024-02-05 23:00:00 -0800", "qty": 3.0, "value": "Core"},
        {"date": "2024-02-06 02:00:00 -0800", "endDate": "2024-02-06 03:00:00 -0800", "qty": 1.0, "value": "Deep"},
        {"date": "2024-02-06 03:00:00 -0800", "endDate": "2024-02-06 03:30:00 -0800", "qty": 0.5, "value": "Awake"},
        {"date": "2024-02-05 22:45:00 -0800", "endDate": "2024-02-06 07:00:00 -0800", "qty": 8.25, "value": "In Bed"},
    ]
    [day] = parse_metrics([{"name": "sleep_analysis", "units": "hr", "data": segments}])
    assert day["date"] == date(2024, 2, 6)
    assert day["sleep_duration_seconds"] == 4 * 3600 and day["sleep_deep_seconds"] == 3600
    assert day["sleep_awake_seconds"] == 1800


def test_out_of_range_and_junk_values_are_ignored():
    junk = [{"name": "resting_heart_rate", "data": [{"qty": 900, "date": "2024-02-06 00:00:00 -0800"},
                                                    {"qty": "abc", "date": "nope"}, "string"]},
            "not a metric", {"name": "unknown_metric", "data": [{"qty": 1, "date": "2024-02-06 00:00:00 -0800"}]}]
    assert parse_metrics(junk) == []


def test_v2_workout():
    [w] = parse_workouts([{
        "id": "550e8400-e29b-41d4-a716-446655440000", "name": "Outdoor Cycling",
        "start": "2024-02-06 07:00:00 -0800", "end": "2024-02-06 08:30:00 -0800", "duration": 5400,
        "distance": {"qty": 25, "units": "mi"}, "activeEnergyBurned": {"qty": 700, "units": "kcal"},
        "heartRate": {"min": {"qty": 90, "units": "count/min"}, "avg": {"qty": 140, "units": "count/min"},
                      "max": {"qty": 172, "units": "count/min"}},
        "elevationUp": {"qty": 1200, "units": "ft"},
    }])
    assert w["external_id"] == "hae:550e8400-e29b-41d4-a716-446655440000"
    assert w["sport_type"] == SportType.cycling and w["duration_seconds"] == 5400
    assert w["distance_meters"] == pytest.approx(40233.6) and w["calories"] == 700
    assert (w["avg_hr"], w["max_hr"]) == (140, 172) and w["elevation_gain"] == pytest.approx(365.8)


def test_v1_workout_without_id_or_duration():
    [w] = parse_workouts([{"name": "Pool Swim", "start": "2024-02-06 07:00:00 -0800", "end": "2024-02-06 07:45:00 -0800",
                           "activeEnergy": {"qty": 1000, "units": "kJ"}, "distance": {"qty": 2000, "units": "m"}}])
    assert w["external_id"] == "hae:Pool Swim:2024-02-06 07:00:00 -0800"
    assert w["sport_type"] == SportType.swimming and w["duration_seconds"] == 2700
    assert w["distance_meters"] == 2000 and w["calories"] == 239


def test_payload_requires_data_object():
    with pytest.raises(ValueError):
        parse_payload({"metrics": []})
    assert parse_payload({"data": {"metrics": METRICS[:1]}})[1][0]["steps"] == 8500


def test_tokens_are_random_and_only_hash_is_kept():
    a, ha = new_token()
    b, _ = new_token()
    assert a.startswith(TOKEN_PREFIX) and a != b and ha == hash_token(a) and a not in ha
