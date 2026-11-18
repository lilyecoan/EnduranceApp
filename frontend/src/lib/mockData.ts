// Demo/fixture Garmin snapshot — used when no live Garmin connection is available.
export const mockGarminData = {
  hrv_rmssd: 81,
  hrv_baseline: 46,
  hrv_status: "BALANCED",
  hrv_5day_avg: 62,
  sleep_score: 84,
  sleep_duration_seconds: 27780,   // 7h 43m
  body_battery_morning: 65,
  body_battery_high: 65,
  stress_avg: 24,
  training_readiness_score: 82,    // derived: high HRV + good sleep
  recovery_time_hours: 10,
  ctl: 28,
  atl: 30,
  tsb: -2,
  acute_load: 160,
  vo2_max: 47.2,
  ftp: 128,
  run_threshold_pace: 415,         // sec/km threshold (~11:08/mi after conversion)
  swim_pace_per_100yd: 110,        // 1:50/100yd
  resting_hr: 56,
  weight_kg: 63.5,
};

