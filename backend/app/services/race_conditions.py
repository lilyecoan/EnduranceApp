"""Race-day conditions from Open-Meteo (free, no key; data CC BY 4.0).

- Geocoding turns the race location into coordinates, elevation and time zone.
- Within the 16-day forecast window we use the forecast for race day.
- Further out we use the same calendar date over the past five years
  (historical weather), averaged hour by hour, as a "typical conditions" guide.
"""
import asyncio
from datetime import date, time, timedelta
from statistics import mean
from typing import Optional

import httpx
import structlog
from pydantic import BaseModel

log = structlog.get_logger()

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_DAYS = 16
HISTORY_YEARS = 5
HOURLY = "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation"
ATTRIBUTION = {"name": "Weather data by Open-Meteo.com (CC BY 4.0)", "url": "https://open-meteo.com/"}


class Place(BaseModel):
    name: str
    latitude: float
    longitude: float
    elevation_m: Optional[float] = None
    timezone: Optional[str] = None


class RaceConditions(BaseModel):
    basis: str  # "forecast" | "historical"
    years: list[int] = []
    start_temp_c: Optional[float] = None
    peak_temp_c: Optional[float] = None
    peak_feels_like_c: Optional[float] = None
    avg_humidity_pct: Optional[float] = None
    avg_wind_kph: Optional[float] = None
    rain_chance_pct: Optional[float] = None
    sunrise: Optional[str] = None  # local HH:MM


async def geocode(location: str) -> Optional[Place]:
    """Best match for "City, Region, Country"; tries the city alone if needed."""
    candidates = [location.strip()]
    city = location.split(",")[0].strip()
    if city and city != candidates[0]:
        candidates.append(city)
    region_hints = [p.strip().lower() for p in location.split(",")[1:] if p.strip()]
    async with httpx.AsyncClient(timeout=10.0) as client:
        for query in candidates:
            try:
                resp = await client.get(GEOCODE_URL, params={"name": query, "count": 10, "language": "en"})
                resp.raise_for_status()
                results = resp.json().get("results") or []
            except (httpx.HTTPError, ValueError) as e:
                log.warning("geocode_failed", error=str(e))
                return None
            if not results:
                continue

            def score(r: dict) -> int:
                fields = " ".join(str(r.get(k, "")) for k in ("admin1", "country", "country_code")).lower()
                return sum(1 for hint in region_hints if hint and hint in fields)

            best = max(results, key=score)
            return Place(
                name=", ".join(p for p in (best.get("name"), best.get("admin1"), best.get("country")) if p),
                latitude=best["latitude"],
                longitude=best["longitude"],
                elevation_m=best.get("elevation"),
                timezone=best.get("timezone"),
            )
    return None


def _window(hourly: dict, day: date, start: time, hours: float) -> dict[str, list]:
    """Hourly values from race start to expected finish on ``day``."""
    first = start.hour
    last = min(23, int(start.hour + max(1.0, hours)))
    keep = {f"{day.isoformat()}T{h:02d}:00" for h in range(first, last + 1)}
    out: dict[str, list] = {k: [] for k in hourly if k != "time"}
    for i, stamp in enumerate(hourly.get("time", [])):
        if stamp in keep:
            for key in out:
                value = hourly[key][i]
                if value is not None:
                    out[key].append(value)
    return out


def summarize(windows: list[dict[str, list]], sunrises: list[str]) -> dict:
    """Average several (one per year) race-window samples into one picture."""
    def per_year(key, fn):
        values = [fn(w[key]) for w in windows if w.get(key)]
        return round(mean(values), 1) if values else None

    rain = [1 if sum(w.get("precipitation") or [0]) >= 0.5 else 0 for w in windows]
    return {
        "start_temp_c": per_year("temperature_2m", lambda v: v[0]),
        "peak_temp_c": per_year("temperature_2m", max),
        "peak_feels_like_c": per_year("apparent_temperature", max),
        "avg_humidity_pct": per_year("relative_humidity_2m", mean),
        "avg_wind_kph": per_year("wind_speed_10m", mean),
        "rain_chance_pct": round(100 * mean(rain)) if rain else None,
        "sunrise": sunrises[0][-5:] if sunrises else None,
    }


async def _fetch(client: httpx.AsyncClient, url: str, place: Place, day: date) -> Optional[dict]:
    try:
        resp = await client.get(url, params={
            "latitude": place.latitude, "longitude": place.longitude,
            "start_date": day.isoformat(), "end_date": day.isoformat(),
            "hourly": HOURLY, "daily": "sunrise", "timezone": place.timezone or "auto",
        })
        resp.raise_for_status()
        return resp.json()
    except (httpx.HTTPError, ValueError) as e:
        log.warning("weather_fetch_failed", url=url, day=str(day), error=str(e))
        return None


async def race_conditions(place: Place, race_day: date, start: time, hours: float) -> Optional[RaceConditions]:
    today = date.today()
    async with httpx.AsyncClient(timeout=15.0) as client:
        if today <= race_day <= today + timedelta(days=FORECAST_DAYS - 1):
            basis, days = "forecast", [race_day]
            responses = [await _fetch(client, FORECAST_URL, place, race_day)]
        else:
            basis = "historical"
            # Same calendar date in recent complete years (archive lags ~a week).
            last_year = race_day.year - 1 if race_day >= today else race_day.year
            while date(last_year, race_day.month, min(race_day.day, 28)) > today - timedelta(days=7):
                last_year -= 1
            days = []
            for year in range(last_year, last_year - HISTORY_YEARS, -1):
                try:
                    days.append(race_day.replace(year=year))
                except ValueError:  # Feb 29
                    days.append(race_day.replace(year=year, day=28))
            responses = await asyncio.gather(*(_fetch(client, ARCHIVE_URL, place, d) for d in days))

    windows, sunrises, years = [], [], []
    for day, data in zip(days, responses):
        if not data or "hourly" not in data:
            continue
        windows.append(_window(data["hourly"], day, start, hours))
        sunrises.extend((data.get("daily") or {}).get("sunrise") or [])
        years.append(day.year)
    if not windows:
        return None
    return RaceConditions(basis=basis, years=years if basis == "historical" else [], **summarize(windows, sunrises))
