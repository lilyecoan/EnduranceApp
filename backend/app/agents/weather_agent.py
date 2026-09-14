from typing import Optional

import httpx
from app.agents.state import AgentState, WeatherOutput
from app.core.config import settings


async def _geocode(location: str) -> Optional[tuple]:
    """Resolve a free-text location (e.g. race city) to lat/lon via OpenWeatherMap's geocoding API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.openweathermap.org/geo/1.0/direct",
                params={"q": location, "limit": 1, "appid": settings.openweather_api_key},
            )
            resp.raise_for_status()
            results = resp.json()
        if results:
            return results[0]["lat"], results[0]["lon"]
    except Exception:
        pass
    return None


async def weather_agent_async(lat: float, lon: float) -> WeatherOutput:
    """Fetch current weather and produce hydration/pacing adjustments."""
    try:
        url = "https://api.openweathermap.org/data/2.5/weather"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params={
                "lat": lat,
                "lon": lon,
                "appid": settings.openweather_api_key,
                "units": "metric",
            })
            resp.raise_for_status()
            data = resp.json()

        temp = data["main"]["temp"]
        humidity = data["main"]["humidity"]
        wind_speed = data["wind"]["speed"] * 3.6
        condition = data["weather"][0]["main"]

        heat_stress = temp > 28 or (temp > 25 and humidity > 70)

        hydration_adj = 0
        sodium_adj = 0
        pacing_note = None

        if temp > 30:
            hydration_adj = 250
            sodium_adj = 300
            pacing_note = "Heat conditions: reduce target pace/power 5-8%. Prioritize hydration."
        elif temp > 26:
            hydration_adj = 125
            sodium_adj = 150
            pacing_note = "Warm conditions: increase fluid intake. Monitor effort by feel."

        if humidity > 80:
            hydration_adj += 100
            sodium_adj += 100
            pacing_note = (pacing_note or "") + " High humidity impairs sweat evaporation — stay conservative."

        return WeatherOutput(
            temperature_c=temp,
            humidity_pct=humidity,
            wind_kph=wind_speed,
            condition=condition,
            heat_stress=heat_stress,
            hydration_adjustment_ml=hydration_adj,
            sodium_adjustment_mg=sodium_adj,
            pacing_note=pacing_note,
        )

    except Exception:
        return WeatherOutput(condition="Unknown")


async def weather_agent(state: AgentState) -> AgentState:
    """Fetch live weather for the athlete's race location, when configured.

    Previously this read weather_temp_c/humidity/wind_kph/condition from
    garmin_data, fields the Garmin service never populates, so weather was
    always "unknown" regardless of the separate weather_agent_async
    function that actually calls OpenWeatherMap (that function existed but
    was never invoked by the graph). This wires the real fetch in, using a
    race location resolved to lat/lon via geocoding.
    """
    ctx = state["athlete_context"]
    errors = state.get("errors", [])

    if not ctx.race_location or not settings.openweather_api_key:
        return {**state, "weather_output": WeatherOutput(condition="Unknown"), "errors": errors}

    try:
        coords = await _geocode(ctx.race_location)
        if coords is None:
            output = WeatherOutput(condition="Unknown")
        else:
            output = await weather_agent_async(*coords)
    except Exception as e:
        errors.append(f"WeatherAgent error: {str(e)}")
        output = WeatherOutput(condition="Unknown")

    return {**state, "weather_output": output, "errors": errors}
