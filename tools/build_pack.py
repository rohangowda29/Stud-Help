"""Build the content pack (questions + UI text in en/hi/kn).

  python tools/build_pack.py              # text only
  python tools/build_pack.py --with-audio # also reference app/audio/<lang>/<id>.mp3

Numbers are language-neutral, so one template per language gives correct prompts.
Re-running always produces the same pack (fixed random seed).
"""
import json
import random
import sys
from pathlib import Path

LANGS = ["en", "hi", "kn"]
PER_LEVEL = 6

UI = {
    "en": {"title": "Practice", "correct": "Correct!", "wrong": "Try again", "next": "Next", "listen": "Listen",
           "offline": "Offline: progress is saved on this device", "online": "Online", "synced": "Progress synced",
           "pending": "waiting to sync", "whoAreYou": "Who is practicing?", "addChild": "Add a child",
           "name": "Name", "grade": "Class", "add": "Add", "switch": "Change child", "teacher": "Teacher view"},
    "hi": {"title": "अभ्यास", "correct": "सही!", "wrong": "फिर कोशिश करें", "next": "आगे", "listen": "सुनें",
           "offline": "ऑफ़लाइन: प्रगति इस डिवाइस पर सहेजी जा रही है", "online": "ऑनलाइन", "synced": "प्रगति सिंक हो गई",
           "pending": "सिंक होना बाकी", "whoAreYou": "कौन अभ्यास कर रहा है?", "addChild": "बच्चा जोड़ें",
           "name": "नाम", "grade": "कक्षा", "add": "जोड़ें", "switch": "बच्चा बदलें", "teacher": "शिक्षक दृश्य"},
    "kn": {"title": "ಅಭ್ಯಾಸ", "correct": "ಸರಿ!", "wrong": "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ", "next": "ಮುಂದೆ", "listen": "ಕೇಳಿ",
           "offline": "ಆಫ್‌ಲೈನ್: ಪ್ರಗತಿ ಈ ಸಾಧನದಲ್ಲಿ ಉಳಿಯುತ್ತಿದೆ", "online": "ಆನ್‌ಲೈನ್", "synced": "ಪ್ರಗತಿ ಸಿಂಕ್ ಆಯಿತು",
           "pending": "ಸಿಂಕ್ ಬಾಕಿ", "whoAreYou": "ಯಾರು ಅಭ್ಯಾಸ ಮಾಡುತ್ತಿದ್ದಾರೆ?", "addChild": "ಮಗುವನ್ನು ಸೇರಿಸಿ",
           "name": "ಹೆಸರು", "grade": "ತರಗತಿ", "add": "ಸೇರಿಸಿ", "switch": "ಮಗುವನ್ನು ಬದಲಿಸಿ", "teacher": "ಶಿಕ್ಷಕರ ನೋಟ"},
}

SKILLS = {
    "addition": {"en": "Addition", "hi": "जोड़", "kn": "ಕೂಡುವಿಕೆ"},
    "subtraction": {"en": "Subtraction", "hi": "घटाव", "kn": "ಕಳೆಯುವಿಕೆ"},
    "multiplication": {"en": "Multiplication", "hi": "गुणा", "kn": "ಗುಣಾಕಾರ"},
}

SYMBOL = {"addition": "+", "subtraction": "-", "multiplication": "×"}
WORD = {"addition": "plus", "subtraction": "minus", "multiplication": "times"}
PROMPT = {
    "en": "What is {a} {op} {b}?",
    "hi": "{a} {op} {b} कितना होता है?",
    "kn": "{a} {op} {b} ಎಷ್ಟು?",
}


def operands(skill, level, rng):
    if skill == "addition":
        lo, hi = {1: (1, 9), 2: (10, 49), 3: (100, 499)}[level]
        a, b = rng.randint(lo, hi), rng.randint(lo, hi)
        return a, b, a + b
    if skill == "subtraction":
        if level == 1:
            a = rng.randint(5, 18); b = rng.randint(1, a - 1)
        elif level == 2:
            a = rng.randint(30, 99); b = rng.randint(11, a - 1)
        else:
            a = rng.randint(200, 999); b = rng.randint(101, a - 1)
        return a, b, a - b
    if level == 1:
        a, b = rng.choice([2, 5, 10]), rng.randint(1, 10)
    elif level == 2:
        a, b = rng.randint(2, 9), rng.randint(2, 9)
    else:
        a, b = rng.randint(11, 19), rng.randint(2, 12)
    return a, b, a * b


def options_for(skill, a, answer, rng):
    near = {answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10}
    if skill == "multiplication":
        near |= {answer + a, answer - a}
    pool = sorted(x for x in near if x > 0 and x != answer)
    picks = rng.sample(pool, 3)
    return sorted(picks + [answer])


def build(with_audio):
    rng = random.Random(26)
    items = []
    for skill in SKILLS:
        for level in (1, 2, 3):
            seen = set()
            n = 0
            while n < PER_LEVEL:
                a, b, answer = operands(skill, level, rng)
                if (a, b) in seen:
                    continue
                seen.add((a, b))
                n += 1
                item_id = f"{skill[:3]}-{level}-{n:02d}"
                item = {
                    "id": item_id, "skill": skill, "level": level, "answer": answer,
                    "options": options_for(skill, a, answer, rng),
                    "prompt": {l: PROMPT[l].format(a=a, op=SYMBOL[skill], b=b) for l in LANGS},
                    "say": {"en": f"What is {a} {WORD[skill]} {b}?"},
                }
                if with_audio:
                    item["audio"] = {l: f"audio/{l}/{item_id}.mp3" for l in LANGS}
                items.append(item)
    return {"version": 1, "languages": LANGS, "ui": UI, "skills": SKILLS, "items": items}


if __name__ == "__main__":
    pack = build("--with-audio" in sys.argv)
    out = Path(__file__).resolve().parent.parent / "app" / "content" / "pack-v1.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(pack, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {out} with {len(pack['items'])} questions")