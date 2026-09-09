import httpx
from app.agents.state import AgentState, WeatherOutput
from app.core.config import settings


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


def weather_agent(state: AgentState) -> AgentState:
    """Sync wrapper — weather data may already be pre-fetched into garmin_data."""
    garmin = state.get("garmin_data", {})
    errors = state.get("errors", [])

    temp = garmin.get("weather_temp_c")
    humidity = garmin.get("weather_humidity")
    wind = garmin.get("weather_wind_kph")
    condition = garmin.get("weather_condition", "Unknown")

    heat_stress = False
    hydration_adj = 0
    sodium_adj = 0
    pacing_note = None

    if temp is not None:
        heat_stress = temp > 28 or (temp is not None and temp > 25 and (humidity or 0) > 70)
        if temp > 30:
            hydration_adj = 250
            sodium_adj = 300
            pacing_note = "Heat conditions: reduce target pace/power 5-8%."
        elif temp > 26:
            hydration_adj = 125
            sodium_adj = 150

    output = WeatherOutput(
        temperature_c=temp,
        humidity_pct=humidity,
        wind_kph=wind,
        condition=condition,
        heat_stress=heat_stress,
        hydration_adjustment_ml=hydration_adj,
        sodium_adjustment_mg=sodium_adj,
        pacing_note=pacing_note,
    )

    return {**state, "weather_output": output, "errors": errors}
