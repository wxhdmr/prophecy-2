"""
Copy card images from ../prophecy/Cards-png/ to public/cards/ with card ID filenames.
Run once: python setup_images.py
"""
import re
import shutil
from pathlib import Path

CARDS_DIR = Path(__file__).parent.parent / "prophecy" / "Cards-png"
OUTPUT_DIR = Path(__file__).parent / "public" / "cards"

COURT_MAP = {"11": "page", "12": "knight", "13": "queen", "14": "king"}
MAJOR_PATTERN = re.compile(r"^(\d{2})-")
MINOR_PATTERN = re.compile(r"^(Wands|Cups|Swords|Pentacles)(\d{2})$", re.IGNORECASE)


def filename_to_card_id(stem: str) -> str | None:
    if m := MAJOR_PATTERN.match(stem):
        return f"major_{m.group(1)}"
    if m := MINOR_PATTERN.match(stem):
        suit = m.group(1).lower()
        num = m.group(2)
        rank = COURT_MAP.get(num, num)
        return f"{suit}_{rank}"
    return None


OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
copied, skipped = 0, []

for img_file in sorted(CARDS_DIR.glob("*.png")):
    card_id = filename_to_card_id(img_file.stem)
    if card_id:
        shutil.copy2(img_file, OUTPUT_DIR / f"{card_id}.png")
        print(f"  {img_file.name:<30} → {card_id}.png")
        copied += 1
    else:
        skipped.append(img_file.name)

print(f"\nCopied {copied} images to {OUTPUT_DIR}")
if skipped:
    print(f"Skipped: {skipped}")
