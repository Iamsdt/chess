"""Regenerate src/features/srs/fsrs-reference.json from py-fsrs, the FSRS reference implementation.

The scheduler in src/features/srs/fsrs.ts must reproduce these numbers; fsrs-reference.test.ts
checks it. Run in a throwaway virtualenv so nothing is installed into the project:

    python3 -m venv /tmp/fsrs && /tmp/fsrs/bin/pip install fsrs
    /tmp/fsrs/bin/python -I scripts/fsrs-reference.py > src/features/srs/fsrs-reference.json
"""

import json
from datetime import datetime, timedelta, timezone
from importlib.metadata import version

from fsrs import Card, Rating, Scheduler

GRADES = {"again": Rating.Again, "hard": Rating.Hard, "good": Rating.Good, "easy": Rating.Easy}
START = datetime(2026, 1, 5, 9, 0, tzinfo=timezone.utc)

# Each step is (grade, minutes after the previous review). The first step's offset is ignored.
SCENARIOS = {
    "good-through-learning-then-days": [
        ("good", 0), ("good", 10), ("good", 4 * 1440), ("good", 12 * 1440), ("good", 40 * 1440)
    ],
    "easy-graduates-at-once": [("easy", 0), ("easy", 20 * 1440), ("easy", 90 * 1440)],
    "hard-on-first-step": [("hard", 0), ("hard", 6), ("good", 6), ("good", 10), ("hard", 3 * 1440)],
    "again-restarts-steps": [("again", 0), ("again", 1), ("good", 1), ("good", 10), ("good", 2 * 1440)],
    "lapse-after-review": [
        ("good", 0), ("good", 10), ("good", 3 * 1440), ("again", 9 * 1440), ("good", 10),
        ("good", 2 * 1440),
    ],
    "overdue-review": [("good", 0), ("good", 10), ("good", 30 * 1440), ("hard", 200 * 1440)],
    "same-day-review-of-review-card": [
        ("easy", 0), ("good", 120), ("again", 60), ("good", 10), ("easy", 5 * 1440)
    ],
}


def run(steps):
    scheduler = Scheduler(enable_fuzzing=False)
    card = Card(card_id=1, due=START)
    now = START
    out = []
    for index, (grade, minutes) in enumerate(steps):
        if index > 0:
            now = now + timedelta(minutes=minutes)
        card, _ = scheduler.review_card(card, GRADES[grade], review_datetime=now)
        out.append({
            "grade": grade,
            "minutesAfterPrevious": 0 if index == 0 else minutes,
            "state": card.state.name.lower(),
            "step": card.step,
            "stability": card.stability,
            "difficulty": card.difficulty,
            "dueMinutesAfterReview": round((card.due - now).total_seconds() / 60, 6),
        })
    return out


print(json.dumps({
    "source": f"py-fsrs {version('fsrs')}, Scheduler(enable_fuzzing=False), default parameters",
    "parameters": list(Scheduler().parameters),
    "scenarios": {name: run(steps) for name, steps in SCENARIOS.items()},
}, indent=2))
