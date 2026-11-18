"""Weekly training plan generator.

Builds one week of dated sessions from:
- the goal (race type, or gym / general fitness) and weeks to race, which set
  the phase (base, build, peak, taper, race week) and the weekly shape;
- current fitness: recent weekly training load (synced workouts + logs) and
  CTL, ramped up by at most ~8% a week, with every 4th week easier;
- recovery: elevated resting HR, suppressed HRV or a poor check-in this week
  trims the load;
- health notes: injuries move impact work to low-impact sports, and
  conditions add notes.

Everything is rule-based so it is explainable; the reasons are returned with
the plan. Session load uses the TSS formula (hours x intensity^2 x 100).

Description text may carry unit tokens the frontend renders in the athlete's
units: {pace_run:SEC_PER_KM}, {pace_swim:SEC_PER_100M}.
"""
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from app.services.health_references import match_topics

# Intensity factor (fraction of threshold) by session type.
IF = {
    "recovery": 0.58, "technique": 0.62, "endurance": 0.68, "long": 0.70, "tempo": 0.82,
    "sweetspot": 0.86, "intervals": 0.88, "brick": 0.76, "strength": 0.65, "race": 0.85,
}
ZONE_LABEL = {
    "recovery": "Zone 1", "technique": "Zone 1–2", "endurance": "Zone 2", "long": "Zone 2",
    "tempo": "Zone 3", "sweetspot": "Zone 3–4", "intervals": "Zone 4–5", "brick": "Zone 2–3",
    "strength": "Strength", "race": "Race",
}
# Stored Workout.workout_type values.
WORKOUT_TYPE = {
    "recovery": "recovery", "technique": "recovery", "endurance": "endurance", "long": "long",
    "tempo": "tempo", "sweetspot": "tempo", "intervals": "intervals", "brick": "brick",
    "strength": "strength", "race": "race_simulation",
}
TYPICAL_HOURS = {
    "sprint": 5, "olympic": 7, "half_iron": 9, "full_iron": 12, "five_k": 4, "ten_k": 5,
    "half_marathon": 6, "marathon": 7, "ultramarathon": 9, "other": 5, "gym": 4, "general": 4,
}
TRI = {"sprint", "olympic", "half_iron", "full_iron"}
RUN = {"five_k", "ten_k", "half_marathon", "marathon", "ultramarathon"}
MAX_RAMP = 1.08
MIN_SESSION_LOAD = 25
LOAD_PER_HOUR_CAP = 60

RUN_LIMITING = {"ankle_injury", "achilles", "plantar_fasciitis", "shin_splints", "stress_fracture", "knee", "hamstring"}
SWIM_LIMITING = {"shoulder"}


@dataclass
class PlanInputs:
    week_start: date  # a Monday
    goal: str  # race type, "gym" or "general"
    race_date: Optional[date] = None
    hours_available: Optional[float] = None
    recent_weekly_load: Optional[float] = None  # avg of last 4 weeks
    ctl: Optional[float] = None
    ftp_watts: Optional[float] = None
    run_threshold_pace: Optional[float] = None  # sec/km
    swim_pace_per_100m: Optional[float] = None  # sec/100m (threshold / CSS)
    max_hr: Optional[int] = None
    injuries: str = ""
    conditions: str = ""
    has_type1_diabetes: bool = False
    # Recovery signals for the last few days.
    resting_hr_recent: Optional[float] = None
    resting_hr_baseline: Optional[float] = None
    hrv_recent: Optional[float] = None
    hrv_baseline: Optional[float] = None
    worst_soreness: Optional[int] = None  # 1-5, recent check-ins
    lowest_energy: Optional[int] = None  # 1-5


@dataclass
class Slot:
    day: int  # 0 = Monday
    sport: str  # Swim | Bike | Run | Strength | Cross
    kind: str  # key of IF
    share: float  # share of the week's load
    slot: str = "main"
    max_min: int = 240


@dataclass
class Plan:
    phase: str
    phase_label: str
    weeks_to_race: Optional[int]
    target_load: int
    hours: float
    recovery_week: bool
    readiness_factor: float
    reasons: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    sessions: list[dict] = field(default_factory=list)


# --- phase -----------------------------------------------------------------------

def phase_for(weeks_to_race: Optional[int], goal: str) -> tuple[str, str, float]:
    """(phase enum value, label, load multiplier)."""
    if goal in ("gym", "general") or weeks_to_race is None:
        return "base", "Ongoing fitness", 1.0
    if weeks_to_race <= 0:
        return "race", "Race week", 0.45
    if weeks_to_race <= 2:
        return "taper", "Taper", 0.6
    if weeks_to_race <= 8:
        return "peak", "Race-specific", 1.0
    if weeks_to_race <= 16:
        return "build", "Build", 1.05
    return "base", "Base", 1.0


# --- weekly shapes -------------------------------------------------------------------

def week_shape(goal: str, phase: str) -> list[Slot]:
    strength_sessions = 2 if phase == "base" else 1 if phase == "build" else 0
    if goal in TRI:
        long_bike = "brick" if phase in ("build", "peak") else "long"
        slots = [
            Slot(0, "Swim", "technique", 0.08, max_min=75),
            Slot(1, "Bike", "sweetspot" if phase != "base" else "tempo", 0.15, max_min=120),
            Slot(2, "Run", "intervals" if phase in ("build", "peak") else "tempo", 0.11, max_min=75),
            Slot(3, "Swim", "intervals" if phase != "base" else "endurance", 0.10, max_min=75),
            Slot(4, "Run", "recovery", 0.05, max_min=45),
            Slot(5, "Bike", long_bike, 0.30, max_min=360 if goal == "full_iron" else 240),
            Slot(6, "Run", "long", 0.21, max_min=180 if goal == "full_iron" else 120),
        ]
        if strength_sessions:
            slots.append(Slot(0, "Strength", "strength", 0.0, slot="strength", max_min=40))
        if strength_sessions > 1:
            slots.append(Slot(4, "Strength", "strength", 0.0, slot="strength", max_min=40))
        return slots
    if goal in RUN or goal == "other":
        long_cap = {"five_k": 75, "ten_k": 90, "half_marathon": 120, "marathon": 180, "ultramarathon": 240}.get(goal, 90)
        slots = [
            Slot(1, "Run", "intervals" if phase in ("build", "peak") else "tempo", 0.18, max_min=75),
            Slot(2, "Run", "endurance", 0.15, max_min=70),
            Slot(3, "Run", "tempo", 0.17, max_min=75),
            Slot(4, "Cross", "recovery", 0.07, max_min=45),
            Slot(5, "Run", "long", 0.30, max_min=long_cap),
            Slot(6, "Run", "recovery" if goal != "ultramarathon" else "long", 0.13, max_min=60 if goal != "ultramarathon" else 150),
        ]
        if strength_sessions:
            slots.append(Slot(1, "Strength", "strength", 0.0, slot="strength", max_min=40))
        if strength_sessions > 1:
            slots.append(Slot(6, "Strength", "strength", 0.0, slot="strength", max_min=40))
        return slots
    if goal == "gym":
        return [
            Slot(0, "Strength", "strength", 0.22, max_min=60),
            Slot(1, "Cross", "endurance", 0.15, max_min=45),
            Slot(2, "Strength", "strength", 0.22, max_min=60),
            Slot(4, "Strength", "strength", 0.22, max_min=60),
            Slot(5, "Cross", "intervals", 0.19, max_min=45),
        ]
    # general fitness
    return [
        Slot(0, "Strength", "strength", 0.18, max_min=50),
        Slot(1, "Run", "endurance", 0.18, max_min=45),
        Slot(3, "Strength", "strength", 0.18, max_min=50),
        Slot(4, "Bike", "intervals", 0.18, max_min=50),
        Slot(5, "Cross", "long", 0.28, max_min=90),
    ]


# --- targets & text ----------------------------------------------------------------

def _w(ftp: Optional[float], lo: float, hi: float) -> str:
    return f" ({round(ftp * lo)}–{round(ftp * hi)} W)" if ftp else ""


def _pace(p: Optional[float], lo: float, hi: float) -> str:
    return f" ({{pace_run:{round(p * lo)}}}–{{pace_run:{round(p * hi)}}})" if p else ""


def _hr(max_hr: Optional[int], lo: float, hi: float) -> str:
    return f" (HR {round(max_hr * lo)}–{round(max_hr * hi)})" if max_hr else ""


def describe(sport: str, kind: str, minutes: int, inp: PlanInputs) -> tuple[str, str]:
    """(name, description) with targets from the athlete's FTP / paces / max HR."""
    ftp, pace, css, mhr = inp.ftp_watts, inp.run_threshold_pace, inp.swim_pace_per_100m, inp.max_hr
    wu = 10 if minutes >= 45 else 5
    main = max(minutes - 2 * wu, 10)
    if sport == "Strength":
        if inp.goal == "gym":
            return "Strength", (f"{minutes} min: warm-up 8 min mobility, then 4–5 compound lifts (squat or deadlift pattern, "
                                "push, pull, single-leg, carry) 3–4 sets of 6–10 reps, 1–2 reps in reserve. Core finisher.")
        return "Strength & mobility", (f"{minutes} min: single-leg squats, Romanian deadlifts, step-ups, calf raises, "
                                       "rows and core (dead bugs, side planks), 2–3 sets of 8–12. Keep 2 reps in reserve.")
    if sport == "Swim":
        css_note = f" CSS {{pace_swim:{round(css)}}}." if css else ""
        if kind == "technique":
            return "Technique swim", f"Easy warm-up, drills (catch-up, fingertip drag, kick on side), then steady pulls. Relaxed effort.{css_note}"
        if kind == "intervals":
            target = f" at {{pace_swim:{round(css)}}}" if css else " at a hard, controlled effort"
            return "Swim intervals", f"Warm-up, then repeats of 100s{target} with 15–20 s rest, easy cool-down.{css_note}"
        return "Endurance swim", f"Continuous steady swimming, breathing every 3 strokes where you can.{css_note}"
    if sport == "Bike":
        if kind == "sweetspot":
            reps = max(2, min(4, main // 15))
            return "Sweet-spot ride", f"{wu} min easy, {reps} × {main // reps - 3} min at sweet spot{_w(ftp, 0.88, 0.94)} with 3 min easy between, cool down."
        if kind == "tempo":
            return "Tempo ride", f"{wu} min easy, {main} min steady tempo{_w(ftp, 0.76, 0.87)}{'' if ftp else _hr(mhr, 0.75, 0.84)}, cool down."
        if kind == "brick":
            run = 15 if minutes < 150 else 25
            return "Brick: ride + run", (f"Ride {minutes - run} min mostly Zone 2{_w(ftp, 0.60, 0.75)} with the last 20 min at race effort, "
                                         f"then straight into a {run} min easy run{_pace(pace, 1.15, 1.25)}. Practise race fueling.")
        if kind == "intervals":
            return "Bike intervals", f"{wu} min easy, 5 × 3 min hard{_w(ftp, 1.05, 1.20)} with 3 min easy, cool down."
        return "Long ride", f"Steady Zone 2{_w(ftp, 0.56, 0.75)}{'' if ftp else _hr(mhr, 0.65, 0.75)}. Eat and drink every 20 min as on race day."
    if sport == "Run":
        if kind == "intervals":
            return "Run intervals", f"{wu} min easy, 6 × 3 min at 5K–10K effort{_pace(pace, 0.94, 0.98)} with 2 min jog, cool down."
        if kind == "tempo":
            return "Tempo run", f"{wu} min easy, {main} min comfortably hard{_pace(pace, 1.03, 1.08)}{'' if pace else _hr(mhr, 0.84, 0.89)}, cool down."
        if kind == "long":
            return "Long run", f"Easy conversational pace{_pace(pace, 1.20, 1.30)}{'' if pace else _hr(mhr, 0.65, 0.75)}. Practise fueling if over 75 min."
        if kind == "recovery":
            return "Recovery run", f"Very easy jog{_pace(pace, 1.30, 1.40)}. Walk breaks are fine."
        return "Easy run", f"Steady Zone 2{_pace(pace, 1.18, 1.28)}{'' if pace else _hr(mhr, 0.65, 0.75)}."
    # Cross / low-impact
    if kind == "intervals":
        return "Cardio intervals", "Bike, rower or elliptical: 8 × 1 min hard / 1 min easy after a 10 min warm-up."
    if kind == "long":
        return "Long easy cardio", "Hike, ride or swim at an easy, conversational effort."
    return "Easy cross-training", "Easy bike, swim or elliptical to loosen up. Keep it truly easy."


def session_load(minutes: float, kind: str) -> int:
    return round(minutes / 60 * IF[kind] ** 2 * 100)


def _round5(x: float) -> int:
    return int(5 * round(x / 5))


# --- main ---------------------------------------------------------------------------

def build_week(inp: PlanInputs) -> Plan:
    weeks_to_race = None
    if inp.race_date and inp.goal not in ("gym", "general"):
        weeks_to_race = max(0, (inp.race_date - inp.week_start).days // 7)
    phase, label, phase_mult = phase_for(weeks_to_race, inp.goal)
    reasons: list[str] = []
    notes: list[str] = []

    hours = inp.hours_available or TYPICAL_HOURS.get(inp.goal, 5)
    cap = hours * LOAD_PER_HOUR_CAP

    # Floor: a light week for this goal, so a sparse history doesn't plan 20-minute sessions.
    floor = min(cap, TYPICAL_HOURS.get(inp.goal, 5) * 0.45 * 45)
    current = max(inp.recent_weekly_load or 0, (inp.ctl or 0) * 7) or None
    if current and current * MAX_RAMP >= floor:
        base = min(current * MAX_RAMP, cap)
        reasons.append(f"Starting from your recent training (about {round(current)} load a week), up to 8% more.")
    elif current:
        base = floor
        reasons.append(f"Your recent training (about {round(current)} load a week) is light for this goal, "
                       "so this week starts at an easy entry level for it.")
    else:
        base = floor
        reasons.append("Not enough synced training yet to gauge your fitness, so this week starts at an easy entry level.")

    # Every 4th week counting back from race week is a recovery week.
    recovery_week = phase in ("base", "build", "peak") and weeks_to_race is not None and weeks_to_race > 2 and weeks_to_race % 4 == 3
    if recovery_week:
        phase_mult *= 0.7
        reasons.append("Recovery week: about 30% less load so the past weeks' training can sink in.")
    if phase == "taper":
        reasons.append("Taper: volume drops while a little intensity stays, so you arrive fresh.")
    if phase == "race":
        reasons.append("Race week: short, easy sessions with a few race-pace efforts.")

    readiness = 1.0
    if inp.resting_hr_recent and inp.resting_hr_baseline and inp.resting_hr_recent - inp.resting_hr_baseline >= 5:
        readiness -= 0.15
        reasons.append(f"Your resting HR is up {round(inp.resting_hr_recent - inp.resting_hr_baseline)} bpm on your normal, so the week is lighter.")
    if inp.hrv_recent and inp.hrv_baseline and inp.hrv_recent < inp.hrv_baseline * 0.9:
        readiness -= 0.10
        reasons.append("Your HRV is below your baseline, a sign of incomplete recovery, so the week is lighter.")
    if (inp.worst_soreness or 0) >= 4 or (inp.lowest_energy or 5) <= 2:
        readiness -= 0.10
        reasons.append("Your recent check-ins show high soreness or low energy, so the week is lighter.")
    readiness = max(0.7, round(readiness, 2))

    target = round(base * phase_mult * readiness)

    # Health notes.
    topics = set(match_topics(inp.injuries or "")) | set(match_topics(inp.conditions or ""))
    run_limited = bool(topics & RUN_LIMITING)
    swim_limited = bool(topics & SWIM_LIMITING)
    if run_limited:
        notes.append("Because of your injury notes, hard running is swapped for low-impact work and runs are shorter and easy. "
                     "Stop if it hurts and check with a clinician.")
    if swim_limited:
        notes.append("Because of your shoulder notes, swims are shorter and technique-focused; skip paddles.")
    if "low_back" in topics:
        notes.append("With your back notes, keep strength work light and avoid heavy spinal loading.")
    if inp.has_type1_diabetes or "type1_diabetes" in topics:
        notes.append("T1D: check glucose before, during (sessions over an hour) and after training; carry fast carbs.")
    if "asthma" in topics:
        notes.append("Asthma: take a longer warm-up and keep your inhaler with you, especially in cold air.")

    slots = week_shape(inp.goal, phase)
    if phase == "race":
        slots = [s for s in slots if s.sport != "Strength"]
    # Support strength sessions (share 0) come out of the week's budget too.
    support_load = sum(session_load(35, "strength") for s in slots if s.sport == "Strength" and s.share == 0)
    cardio_target = max(target - support_load, target * 0.6)

    # Low volume: fewer, more useful sessions rather than many 20-minute ones.
    # Drop the smallest sessions, never a sport's last one, until each averages
    # at least MIN_SESSION_LOAD.
    dropped = []
    while True:
        cardio = [s for s in slots if s.share > 0]
        if len(cardio) <= 3 or cardio_target / len(cardio) >= MIN_SESSION_LOAD:
            break
        droppable = [s for s in cardio if s.sport != "Strength" and sum(1 for o in cardio if o.sport == s.sport) > 1]
        if not droppable:
            break
        victim = min(droppable, key=lambda s: s.share)
        slots.remove(victim)
        dropped.append(victim)
    if dropped:
        reasons.append(f"At this volume you'll get more from {len([s for s in slots if s.share > 0])} solid sessions "
                       f"than many short ones, so {len(dropped)} optional session{'s are' if len(dropped) > 1 else ' is'} left out for now.")
    weighted = [s for s in slots if s.share > 0]
    share_total = sum(s.share for s in weighted) or 1

    sessions = []
    for s in slots:
        sport, kind = s.sport, s.kind
        if phase in ("taper", "race") and kind in ("long", "brick"):
            kind = "endurance"
        if run_limited and sport == "Run":
            if kind in ("intervals", "tempo"):
                sport, kind = ("Bike" if inp.goal in TRI else "Cross"), kind
            else:
                kind = "recovery" if kind != "long" else "endurance"
        if swim_limited and sport == "Swim":
            kind = "technique"

        if sport == "Strength":
            minutes = min(s.max_min, 45 if inp.goal == "gym" else 35)
            if inp.goal == "gym" and target:
                minutes = min(s.max_min, max(30, _round5(target * s.share / share_total / (IF["strength"] ** 2 * 100) * 60)))
        else:
            load_share = cardio_target * s.share / share_total
            minutes = load_share / (IF[kind] ** 2 * 100) * 60
            if run_limited and sport == "Run":
                minutes *= 0.5
            if swim_limited and sport == "Swim":
                minutes *= 0.6
            minimum = 20 if kind in ("recovery", "technique") else 30
            minutes = max(minimum, min(s.max_min, _round5(minutes)))

        day = inp.week_start + timedelta(days=s.day)
        if phase == "race" and inp.race_date and day >= inp.race_date:
            continue
        name, desc = describe(sport, kind, minutes, inp)
        distance_m = None
        if sport == "Run" and inp.run_threshold_pace:
            factor = {"intervals": 1.1, "tempo": 1.12, "long": 1.25, "recovery": 1.35}.get(kind, 1.23)
            distance_m = round(minutes * 60 / (inp.run_threshold_pace * factor) * 1000, -2)
        elif sport == "Swim" and inp.swim_pace_per_100m:
            distance_m = round(minutes * 60 * 0.75 / (inp.swim_pace_per_100m * 1.1) * 100, -2)
        sessions.append({
            "date": day.isoformat(), "slot": s.slot, "sport": sport, "kind": kind,
            "workout_type": WORKOUT_TYPE[kind], "name": name, "intensity": ZONE_LABEL[kind],
            "duration_min": minutes, "distance_m": distance_m, "load": session_load(minutes, kind),
            "description": desc,
        })

    if phase == "race" and inp.race_date and inp.week_start <= inp.race_date < inp.week_start + timedelta(days=7):
        sessions.append({
            "date": inp.race_date.isoformat(), "slot": "main", "sport": "Race", "kind": "race",
            "workout_type": "race_simulation", "name": "Race day", "intensity": "Race", "duration_min": 0,
            "distance_m": None, "load": 0, "description": "Race day. Follow your race-day plan on the Race tab.",
        })

    sessions.sort(key=lambda x: (x["date"], x["slot"] != "main"))
    return Plan(
        phase=phase, phase_label=label, weeks_to_race=weeks_to_race,
        target_load=sum(x["load"] for x in sessions), hours=round(sum(x["duration_min"] for x in sessions) / 60, 1),
        recovery_week=recovery_week, readiness_factor=readiness, reasons=reasons, notes=notes, sessions=sessions,
    )
