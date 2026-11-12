#!/usr/bin/env python3
"""Create the 1200x630 Canford WhatsApp/Open Graph image from the real club crest."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
CREST = ROOT / "public" / "assets" / "canford-crest.png"
OUTPUT = ROOT / "public" / "assets" / "whatsapp-preview.png"
W, H = 1200, 630

def load_font(size, bold=False):
    paths = ([
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    ] if bold else [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ])
    for path in paths:
        if Path(path).is_file():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def tracking(draw, pos, label, font, colour, letterspace=2):
    x, y = pos
    for char in label:
        draw.text((int(x), y), char, font=font, fill=colour)
        x += draw.textlength(char, font=font) + letterspace

def generate():
    if not CREST.is_file():
        raise FileNotFoundError("Cannot create branded preview without club crest")
    image = Image.new("RGB", (W, H), (7, 53, 39))
    draw = ImageDraw.Draw(image)
    for x in range(W):
        t = x / (W - 1)
        draw.line([(x, 0), (x, H)], fill=(int(6 + 4*t), int(52 + 35*t), int(39 + 20*t)))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-260, 310, 540, 1110), fill=(63, 186, 118, 58))
    gd.ellipse((840, -350, 1690, 500), fill=(36, 164, 103, 31))
    image = Image.alpha_composite(image.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(80)))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((70, 72, 83, 121), radius=6, fill="#A6EF73")
    tracking(draw, (102, 78), "CANFORD UNITED FC", load_font(25, True), "#DBF2E3", 2.7)
    draw.text((66, 177), "SEASON", font=load_font(94, True), fill="white")
    draw.text((66, 282), "DASHBOARD", font=load_font(71, True), fill="#A6EF73")
    draw.text((70, 414), "Results. Form. The next match.", font=load_font(26), fill="#E9F8EC")
    draw.text((70, 460), "Results  /  Standings  /  Player statistics", font=load_font(20), fill="#BBDBCA")
    draw.line((70, 533, 782, 533), fill=(111, 182, 142, 125), width=2)
    tracking(draw, (70, 553), "DORSET SENIOR LEAGUE", load_font(19, True), "#D5EFDD", 2.4)
    draw.text((668, 552), "2026 / 27", font=load_font(21, True), fill="#A6EF73")
    card = (872, 101, 1153, 493)
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (card[0]+3,card[1]+12,card[2]+3,card[3]+12),
        radius=32, fill=(0, 0, 0, 80)
    )
    image = Image.alpha_composite(image, shadow.filter(ImageFilter.GaussianBlur(18)))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(card, radius=30, fill="white")
    draw.rounded_rectangle((878, 107, 1147, 487), radius=27, outline="#D4EFDE", width=3)
    crest = Image.open(CREST).convert("RGBA")
    crest.thumbnail((249,249), Image.Resampling.LANCZOS)
    image.alpha_composite(crest, (int((card[0]+card[2]-crest.width)/2), 155+int((245-crest.height)/2)))
    draw = ImageDraw.Draw(image)
    draw.line((907,419,1118,419), fill="#D8EEE0", width=2)
    label = "CANFORD UNITED"
    font = load_font(17, True)
    width = draw.textlength(label, font=font)
    draw.text((int((card[0]+card[2]-width)/2), 443), label, font=font, fill="#155C3C")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(OUTPUT, "PNG", optimize=True)
    if OUTPUT.stat().st_size > 600_000:
        raise ValueError("Social image exceeds the 600 KB target")
    return OUTPUT

if __name__ == "__main__":
    path = generate()
    print("Created branded link preview:", path, path.stat().st_size, "bytes")
