
"""Generate natural Kannada audio for Stud-Help using Eleven v3."""

import json
import os
import sys
import time
from pathlib import Path

import requests

KANNADA_SPEECH = {
    "add-1-01": "ನಾಲ್ಕು ಜೊತೆಗೆ ನಾಲ್ಕು ಎಷ್ಟು?",
    "add-1-03": "ಏಳು ಜೊತೆಗೆ ನಾಲ್ಕು ಎಷ್ಟು?",
    "add-1-04": "ಒಂದು ಜೊತೆಗೆ ನಾಲ್ಕು ಎಷ್ಟು?",
    "add-1-05": "ಎಂಟು ಜೊತೆಗೆ ಏಳು ಎಷ್ಟು?",
    "add-1-06": "ಒಂದು ಜೊತೆಗೆ ಐದು ಎಷ್ಟು?",
    "add-2-01": "ಹನ್ನೆರಡು ಜೊತೆಗೆ ಹತ್ತು ಎಷ್ಟು?",
    "add-2-02": "ಮೂವತ್ತು ಜೊತೆಗೆ ಮೂವತ್ತೇಳು ಎಷ್ಟು?",
    "add-2-03": "ಇಪ್ಪತ್ತಾರು ಜೊತೆಗೆ ಇಪ್ಪತ್ತೆರಡು ಎಷ್ಟು?",
    "add-2-04": "ನಲವತ್ತೆಂಟು ಜೊತೆಗೆ ನಲವತ್ತಮೂರು ಎಷ್ಟು?",
}

API_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"


def main():
    if len(sys.argv) < 3:
        raise SystemExit(
            "Usage: python tools/generate_audio.py PACK_JSON APP_DIR"
        )

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID")

    if not api_key or not voice_id:
        raise SystemExit("Missing ElevenLabs credentials.")

    pack_path = Path(sys.argv[1])
    app_dir = Path(sys.argv[2])

    with pack_path.open("r", encoding="utf-8") as file:
        pack = json.load(file)

    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    generated = 0
    updated = 0

    for question_id, kannada_text in KANNADA_SPEECH.items():
        item = next(
            (x for x in pack["items"] if x["id"] == question_id),
            None,
        )

        if item is None:
            print(f"Question not found: {question_id}")
            continue

        output = (
            app_dir / "audio" / "kn" /
            f"{question_id}-v3.mp3"
        )

        print(f"Generating: {question_id}")
        print(f"Kannada: {kannada_text}")

        payload = {
            "text": kannada_text,
            "model_id": "eleven_v3",
            "language_code": "kn",
        }

        response = requests.post(
            API_URL.format(voice_id=voice_id),
            headers=headers,
            json=payload,
            timeout=120,
        )

        if response.status_code != 200:
            print("ElevenLabs error:", response.status_code)
            print(response.text)
            raise SystemExit("Generation stopped.")

        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(response.content)

        item.setdefault("audio", {})
        item["audio"]["kn"] = f"audio/kn/{question_id}-v3.mp3"

        generated += 1
        updated += 1

        print(f"Saved: {output}")
        time.sleep(1)

    with pack_path.open("w", encoding="utf-8") as file:
        json.dump(pack, file, ensure_ascii=False, indent=2)

    print("\nFinished!")
    print("New Kannada recordings:", generated)
    print("Updated audio references:", updated)


if __name__ == "__main__":
    main()
