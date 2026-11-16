"""Race-day nutrition plan.

The numbers come from published sports-nutrition guidance (see SOURCES),
adjusted for this athlete and race: expected duration, start time, weather,
altitude, body weight and health notes. They are computed here, by rule, so
they are explainable and repeatable; the AI coach only adds personalized
notes on top (see app.routers.race).

Text may contain unit tokens the frontend renders in the athlete's units:
{temp:C}, {ml:ML}, {m:METERS}.
"""
import re
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from typing import Optional

from app.services.race_conditions import RaceConditions

SOURCES = [
    {"name": "ACSM Joint Position Statement: Nutrition and Athletic Performance (2016)",
     "url": "https://pubmed.ncbi.nlm.nih.gov/26891166/"},
    {"name": "ACSM Position Stand: Exercise and Fluid Replacement (2007)",
     "url": "https://pubmed.ncbi.nlm.nih.gov/17277604/"},
    {"name": "Jeukendrup (2014): Carbohydrate intake during exercise, Sports Medicine",
     "url": "https://pubmed.ncbi.nlm.nih.gov/24791914/"},
    {"name": "ISSN Position Stand: Caffeine and exercise performance (2021)",
     "url": "https://pubmed.ncbi.nlm.nih.gov/33388079/"},
    {"name": "ISSN Position Stand: Nutrient timing (2017)",
     "url": "https://pubmed.ncbi.nlm.nih.gov/28919842/"},
]

MULTISPORT = {"sprint", "olympic", "half_iron", "full_iron"}

# Typical age-group finish times, used only when the athlete gives no goal.
TYPICAL_FINISH_MIN = {
    "sprint": 90, "olympic": 165, "half_iron": 360, "full_iron": 780,
    "five_k": 30, "ten_k": 60, "half_marathon": 135, "marathon": 270, "ultramarathon": 480, "other": 120,
}
STANDARD_RUN_KM = {"five_k": 5.0, "ten_k": 10.0, "half_marathon": 21.1, "marathon": 42.2}
# Race pace relative to threshold pace, by distance.
RUN_PACE_FACTOR = {"five_k": 0.98, "ten_k": 1.02, "half_marathon": 1.07, "marathon": 1.14}
# Share of finish time: swim, T1, bike, T2, run.
TRI_SPLITS = {
    "sprint": (0.17, 0.03, 0.45, 0.02, 0.33),
    "olympic": (0.15, 0.02, 0.47, 0.01, 0.35),
    "half_iron": (0.11, 0.015, 0.50, 0.01, 0.365),
    "full_iron": (0.095, 0.01, 0.50, 0.008, 0.387),
}

CAFFEINE_CAUTION = re.compile(
    r"\b(caffeine|coffee|pregnan\w*|arrhythmi\w*|afib|atrial|heart|cardiac|palpitation\w*|anxiety|panic|insomnia|reflux|gerd)\b",
    re.I,
)


@dataclass
class RaceInputs:
    race_type: str
    start_time: time
    finish_minutes: Optional[int] = None
    weight_kg: Optional[float] = None
    run_threshold_pace: Optional[float] = None  # sec/km
    run_distance_km: Optional[float] = None
    venue_elevation_m: Optional[float] = None
    elevation_gain_m: Optional[float] = None
    conditions: Optional[RaceConditions] = None
    has_type1_diabetes: bool = False
    health_text: str = ""  # conditions + injuries + dietary, for keyword checks
    aid_station_products: list[str] = field(default_factory=list)


def expected_finish(inp: RaceInputs) -> tuple[int, str]:
    """(minutes, basis) where basis is "goal", "pace" or "typical"."""
    if inp.finish_minutes:
        return inp.finish_minutes, "goal"
    run_km = inp.run_distance_km or STANDARD_RUN_KM.get(inp.race_type)
    if inp.run_threshold_pace and run_km and inp.race_type in RUN_PACE_FACTOR:
        return round(run_km * inp.run_threshold_pace * RUN_PACE_FACTOR[inp.race_type] / 60), "pace"
    return TYPICAL_FINISH_MIN.get(inp.race_type, 120), "typical"


def carbs_per_hour(total_hours: float) -> int:
    """Jeukendrup 2014 / ACSM 2016 bands by event duration."""
    if total_hours < 1.25:
        return 0  # small amounts or a mouth rinse are enough
    if total_hours < 2.0:
        return 30
    if total_hours < 2.5:
        return 60
    return 75  # 60-90 g/h; up to 90 with a trained gut and glucose+fructose products


def fluid_per_hour(weight_kg: Optional[float], c: Optional[RaceConditions], venue_m: Optional[float]) -> tuple[int, list[str]]:
    notes = []
    base = min(700, max(400, round((weight_kg or 70) * 7)))  # ACSM: roughly 0.4-0.8 L/h, individualized
    feels = c.peak_feels_like_c if c and c.peak_feels_like_c is not None else (c.peak_temp_c if c else None)
    if feels is not None:
        if feels >= 32:
            base += 250
            notes.append(f"Very hot race window (feels like up to {{temp:{feels}}}): more fluid and sodium, "
                         "and start 5-10% easier than your goal effort.")
        elif feels >= 27:
            base += 150
            notes.append(f"Warm race window (feels like up to {{temp:{feels}}}): extra fluid and sodium each hour.")
        elif feels >= 22:
            base += 50
        elif feels < 10:
            base -= 100
            notes.append(f"Cool conditions (around {{temp:{feels}}}): you'll sweat less, so drink to thirst and "
                         "don't force fluids; carbs still matter.")
    if c and c.avg_humidity_pct and c.avg_humidity_pct >= 75 and (feels or 0) >= 22:
        base += 50
        notes.append("High humidity slows sweat cooling; plan to use ice and water on your body at aid stations.")
    if venue_m and venue_m >= 1500:
        base += 100
        notes.append(f"Race venue is at altitude ({{m:{venue_m}}}): you lose more water breathing and burn more "
                     "carbs, so fluid is up a little and fueling starts early.")
    return min(base, 1000), notes


def sodium_per_hour(total_hours: float, c: Optional[RaceConditions]) -> int:
    feels = c.peak_feels_like_c if c and c.peak_feels_like_c is not None else (c.peak_temp_c if c else None)
    value = 400  # ACSM 2016: ~300-600 mg/h for long events with heavy sweating
    if total_hours > 4 or (feels or 0) >= 27:
        value = 600
    if (feels or 0) >= 32:
        value = 800
    return value


def _clock(start: time, offset_min: float) -> str:
    return (datetime.combine(datetime(2000, 1, 1), start) + timedelta(minutes=offset_min)).strftime("%H:%M")


def _legs(race_type: str, total: int) -> list[tuple[str, float]]:
    if race_type in MULTISPORT:
        names = ("Swim", "T1", "Bike", "T2", "Run")
        return [(n, total * share) for n, share in zip(names, TRI_SPLITS[race_type])]
    return [("Run", float(total))]


def _leg_rates(name: str, carbs: int, fluid: int, sodium: int) -> tuple[int, int, int]:
    if name in ("Swim", "T1", "T2"):
        return 0, 0, 0
    if name == "Run" and carbs >= 60:
        # Harder to eat while running; most fuel goes in on the bike.
        return carbs - 15, fluid, sodium
    if name == "Bike" and carbs >= 60:
        return min(90, carbs + 5), fluid, sodium
    return carbs, fluid, sodium


def build_plan(inp: RaceInputs) -> dict:
    total, basis = expected_finish(inp)
    hours = total / 60
    weight = inp.weight_kg
    carbs = carbs_per_hour(hours)
    fluid, adjustments = fluid_per_hour(weight, inp.conditions, inp.venue_elevation_m)
    sodium = sodium_per_hour(hours, inp.conditions)
    if hours < 1.0:
        fluid, sodium = 0, 0  # short races: drink to thirst before and after
    caution = CAFFEINE_CAUTION.search(inp.health_text or "")
    caffeine_pre = 0 if caution or hours < 1.0 else round(3 * (weight or 70) / 10) * 10  # ISSN: 3-6 mg/kg
    products = ", ".join(inp.aid_station_products[:4])
    timeline: list[dict] = []
    assumptions = []

    def add(offset, phase, title, detail, carbs_g=0, fluid_ml=0, sodium_mg=0, caffeine_mg=0):
        timeline.append({
            "offset_min": round(offset), "clock": _clock(inp.start_time, offset), "phase": phase,
            "title": title, "detail": detail, "carbs_g": round(carbs_g), "fluid_ml": round(fluid_ml),
            "sodium_mg": round(sodium_mg), "caffeine_mg": round(caffeine_mg),
        })

    long_race = hours >= 1.5
    w = weight or 70
    if not weight:
        assumptions.append("Body weight isn't in your profile, so amounts assume 70 kg. Add it for exact numbers.")

    # --- before ---------------------------------------------------------------
    if long_race:
        add(-36 * 60, "Day before", "Carb-load",
            f"For the 36-48 hours before, eat about {round(10 * w)}-{round(12 * w)} g of carbs a day "
            "(10-12 g per kg), mostly familiar, lower-fiber foods, and ease off fat and fiber the evening before.",
            carbs_g=10 * w)
    add(-12 * 60, "Night before", "Familiar dinner",
        "A carb-centered dinner you've eaten before a long session. Nothing new, spicy or high in fiber.")
    breakfast_min = 180 if long_race else 120
    breakfast_carbs = (2.0 if long_race else 1.0) * w
    add(-breakfast_min, "Pre-race", "Breakfast",
        f"About {round(breakfast_carbs)} g of carbs ({'2' if long_race else '1'} g per kg), low in fat and fiber, "
        "with water or a sports drink sipped over the next hour.",
        carbs_g=breakfast_carbs, fluid_ml=6 * w, sodium_mg=300)
    if inp.start_time < time(7, 0) and long_race:
        assumptions.append("With an early start, eating 3 hours out means a very early alarm. If that won't happen, "
                           "eat a smaller breakfast (about 1 g carbs per kg) 2 hours before instead.")
    if caffeine_pre:
        add(-60, "Pre-race", "Caffeine (optional)",
            f"About {caffeine_pre} mg (3 mg per kg) from coffee, a caffeinated gel or tablet, only if you've used "
            "caffeine before hard training.", caffeine_mg=caffeine_pre)
    if long_race:
        add(-15, "Pre-race", "Top-up", "A gel or chews with a few sips of water before the start.",
            carbs_g=25, fluid_ml=150)
    else:
        add(-15, "Pre-race", "Top-up", "A few sips of water or sports drink. A small gel is fine if you're used to it.",
            fluid_ml=150)

    # --- during ---------------------------------------------------------------
    legs_out = []
    offset = 0.0
    for name, minutes in _legs(inp.race_type, total):
        c_rate, f_rate, s_rate = _leg_rates(name, carbs, fluid, sodium)
        legs_out.append({"name": name, "start_offset_min": round(offset), "duration_min": round(minutes),
                         "carbs_g_per_hr": c_rate, "fluid_ml_per_hr": f_rate, "sodium_mg_per_hr": s_rate})
        if name == "Swim":
            add(offset, "Swim", "Swim start", "No fueling during the swim. Breakfast and the top-up cover it.")
        elif name in ("T1", "T2"):
            if name == "T2" and c_rate == 0 and carbs:
                add(offset, name, "Transition", "Grab your run fuel; a few sips of water.")
        elif c_rate or f_rate:
            step = 20 if minutes <= 120 else 30 if minutes <= 240 else 60
            first = 15 if name == "Bike" else step
            if name == "Bike":
                add(offset, "Bike", "Settle in", "Sip water for the first 10-15 minutes while your heart rate settles, then start eating.")
            t = first
            while t <= minutes - 5:
                chunk = step / 60
                what = ("Gel, chews or bar, plus drink from your bottle" if name == "Bike"
                        else "At the aid station: gel or sports drink, plus water")
                if products:
                    what += f" (on course: {products})"
                add(offset + t, name, f"{name} fuel", what,
                    carbs_g=c_rate * chunk, fluid_ml=f_rate * chunk, sodium_mg=s_rate * chunk)
                t += step
            if name == "Run" and hours >= 4 and not caution:
                late = round(1.5 * w / 10) * 10
                add(offset + minutes * 0.66, "Run", "Late caffeine (optional)",
                    f"About {late} mg from cola or a caffeinated gel for the last third, if you've practiced it.",
                    caffeine_mg=late)
        offset += minutes

    if carbs == 0 and hours >= 0.75:
        add(total / 2, "Run", "Mid-race (optional)",
            "For a race this length you don't need to eat. Rinsing your mouth with sports drink can still help late on.")

    # --- after ------------------------------------------------------------------
    add(total + 30, "Recovery", "Within an hour of finishing",
        f"About {round(1.0 * w)} g carbs and {round(0.3 * w)} g protein, and drink about 1.5 times the fluid you "
        "lost (weigh yourself before and after if you can).", carbs_g=1.0 * w)

    if inp.elevation_gain_m and inp.elevation_gain_m >= 1000:
        adjustments.append(f"Hilly course ({{m:{inp.elevation_gain_m}}} of climbing): eat on the flats and descents "
                           "and before climbs, not on steep sections.")
    if caution and hours >= 1.0:
        adjustments.append("Caffeine is left out because of something in your health notes. "
                           "Check with your doctor if you'd like to use it.")
    if inp.has_type1_diabetes:
        adjustments.append("T1D: check glucose before the start, at each transition and every 30-45 minutes (CGM "
                           "alerts on), and carry 15-20 g of fast carbs beyond this plan. This plan doesn't change "
                           "insulin; agree race-day insulin with your care team.")
    if basis == "typical":
        assumptions.append("Finish time is a typical age-group time for this race. Add your goal time for a plan "
                           "sized to you.")
    elif basis == "pace":
        assumptions.append("Finish time is estimated from your threshold run pace.")
    if carbs >= 75:
        assumptions.append("75 g carbs per hour assumes you've practiced fueling in training. Work up to it; "
                           "up to 90 g/h is possible with glucose+fructose products and a trained gut.")

    timeline.sort(key=lambda e: e["offset_min"])
    during = [e for e in timeline if 0 <= e["offset_min"] < total]
    return {
        "version": 1,
        "race_type": inp.race_type,
        "start_time": inp.start_time.strftime("%H:%M"),
        "expected_finish_minutes": total,
        "finish_basis": basis,
        "legs": legs_out,
        "totals_during": {
            "carbs_g": sum(e["carbs_g"] for e in during),
            "fluid_ml": sum(e["fluid_ml"] for e in during),
            "sodium_mg": sum(e["sodium_mg"] for e in during),
            "caffeine_mg": sum(e["caffeine_mg"] for e in timeline if e["offset_min"] < total),
        },
        "rates": {"carbs_g_per_hr": carbs, "fluid_ml_per_hr": fluid, "sodium_mg_per_hr": sodium},
        "timeline": timeline,
        "adjustments": adjustments,
        "assumptions": assumptions,
        "sources": SOURCES,
    }
