"""Athlete data sources (Intervals.icu, Strava, file uploads).

Each source maps its own payloads onto plain dicts shaped like the
Activity / RecoveryMetric columns; app.services.sync persists them.
"""

# Sources whose data must never be sent to the AI coaching pipeline. Strava's
# API agreement prohibits using Strava data for AI/ML ("model training related
# to artificial intelligence, machine learning or similar applications"), so
# Strava activities are shown to the athlete but excluded from coaching input.
AI_EXCLUDED_SOURCES = frozenset({"strava"})

USER_AGENT = "IronMindAI/1.0 (+https://github.com/lilyecoan/EnduranceApp)"
