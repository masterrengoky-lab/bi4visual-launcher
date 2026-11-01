"""Draws the effect glyphs of assets/bi4visual/font/fx.json.

Every glyph is a white 64x64 picture; the game tints it with the effect's
colour. The first three (ring, soft dot, square) are kept as they are and the
NovaVis glyphs are appended after them:

  \\ue033 lightning bolt      \\ue034 glass shard     \\ue035 skull
  \\ue036 grave stone         \\ue037 bubble          \\ue038 four-point star
  \\ue039 splat               \\ue03a streak          \\ue03b crystal
  \\ue03c big soft glow

Run: python3 mod/tools/fx_glyphs.py
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / "src/main/resources/assets/bi4visual"
PNG = ROOT / "textures/font/fx.png"
JSON = ROOT / "font/fx.json"
S = 64
BASE = 3  # ring, dot, square stay first


def canvas():
    return Image.new("RGBA", (S, S), (255, 255, 255, 0))


def glow(img, radius=3, strength=0.6):
    """The picture with a soft halo of itself around it."""
    a = img.getchannel("A")
    halo = a.filter(ImageFilter.GaussianBlur(radius)).point(lambda v: int(v * strength))
    alpha = Image.new("L", (S, S))
    alpha.putdata([max(x, y) for x, y in zip(a.getdata(), halo.getdata())])
    res = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    res.putalpha(alpha)
    return res


def lightning():
    img = canvas()
    d = ImageDraw.Draw(img)
    rnd = random.Random(7)
    x, y = 32, 2
    pts = [(x, y)]
    while y < 60:
        y += rnd.randint(6, 10)
        x = max(10, min(54, x + rnd.randint(-11, 11)))
        pts.append((x, min(y, 62)))
    d.line(pts, fill=(255, 255, 255, 255), width=3, joint="curve")
    # a short branch
    bx, by = pts[2]
    d.line([(bx, by), (bx + 10, by + 8), (bx + 6, by + 18)], fill=(255, 255, 255, 200), width=2)
    return glow(img, 3, 0.7)


def shard():
    img = canvas()
    d = ImageDraw.Draw(img)
    poly = [(30, 4), (50, 26), (38, 60), (14, 40)]
    d.polygon(poly, fill=(255, 255, 255, 70))
    d.line(poly + [poly[0]], fill=(255, 255, 255, 235), width=2)
    d.line([(30, 4), (38, 60)], fill=(255, 255, 255, 120), width=1)
    return img


def skull():
    img = canvas()
    d = ImageDraw.Draw(img)
    d.ellipse((12, 6, 52, 44), fill=(255, 255, 255, 255))
    d.rectangle((20, 36, 44, 56), fill=(255, 255, 255, 255))
    clear = (255, 255, 255, 0)
    d.ellipse((18, 20, 29, 32), fill=clear)
    d.ellipse((35, 20, 46, 32), fill=clear)
    d.polygon([(32, 33), (28, 40), (36, 40)], fill=clear)
    for x in (25, 31, 37):
        d.rectangle((x, 47, x + 2, 56), fill=clear)
    return glow(img, 3, 0.5)


def grave():
    img = canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((14, 8, 50, 60), radius=16, fill=(255, 255, 255, 230))
    d.rectangle((14, 30, 50, 60), fill=(255, 255, 255, 230))
    clear = (255, 255, 255, 40)
    d.rectangle((30, 16, 34, 44), fill=clear)
    d.rectangle((23, 23, 41, 27), fill=clear)
    d.rectangle((8, 58, 56, 63), fill=(255, 255, 255, 255))
    return glow(img, 3, 0.5)


def bubble():
    img = canvas()
    d = ImageDraw.Draw(img)
    d.ellipse((6, 6, 58, 58), fill=(255, 255, 255, 40), outline=(255, 255, 255, 220), width=2)
    d.arc((14, 12, 44, 42), 200, 260, fill=(255, 255, 255, 255), width=4)
    d.ellipse((40, 16, 46, 22), fill=(255, 255, 255, 230))
    return img


def star():
    img = canvas()
    px = img.load()
    for y in range(S):
        for x in range(S):
            dx, dy = abs(x - 31.5) / 31.5, abs(y - 31.5) / 31.5
            v = max(0.0, 1 - (dx ** 0.5 + dy ** 0.5))  # astroid: four sharp rays
            core = max(0.0, 1 - math.hypot(dx, dy) * 3)
            a = min(1.0, v * 2.2 + core)
            px[x, y] = (255, 255, 255, int(255 * a))
    return img


def splat():
    img = canvas()
    d = ImageDraw.Draw(img)
    rnd = random.Random(3)
    d.ellipse((16, 16, 48, 48), fill=(255, 255, 255, 230))
    for _ in range(9):
        a = rnd.random() * math.tau
        r = rnd.uniform(16, 26)
        s = rnd.uniform(3, 7)
        cx, cy = 32 + math.cos(a) * r, 32 + math.sin(a) * r
        d.ellipse((cx - s, cy - s, cx + s, cy + s), fill=(255, 255, 255, 220))
        d.line([(32, 32), (cx, cy)], fill=(255, 255, 255, 220), width=int(s))
    return img.filter(ImageFilter.GaussianBlur(0.8))


def streak():
    img = canvas()
    px = img.load()
    for y in range(S):
        for x in range(S):
            along = x / 63  # bright head on the right
            across = max(0.0, 1 - abs(y - 31.5) / (2 + 5 * along))
            px[x, y] = (255, 255, 255, int(255 * (along ** 1.6) * across))
    d = ImageDraw.Draw(img)
    d.ellipse((54, 27, 63, 36), fill=(255, 255, 255, 255))
    return img


def crystal():
    img = canvas()
    d = ImageDraw.Draw(img)
    poly = [(32, 2), (50, 24), (32, 62), (14, 24)]
    d.polygon(poly, fill=(255, 255, 255, 120))
    d.line(poly + [poly[0]], fill=(255, 255, 255, 255), width=2)
    d.line([(14, 24), (50, 24)], fill=(255, 255, 255, 200), width=1)
    d.line([(32, 2), (32, 62)], fill=(255, 255, 255, 140), width=1)
    return glow(img, 2, 0.6)


def big_glow():
    img = canvas()
    px = img.load()
    for y in range(S):
        for x in range(S):
            r = math.hypot(x - 31.5, y - 31.5) / 31.5
            px[x, y] = (255, 255, 255, int(255 * max(0.0, 1 - r) ** 2.2))
    return img


def main():
    old = Image.open(PNG).convert("RGBA")
    glyphs = [old.crop((i * S, 0, (i + 1) * S, S)) for i in range(BASE)]
    glyphs += [lightning(), shard(), skull(), grave(), bubble(), star(), splat(), streak(), crystal(), big_glow()]
    out = Image.new("RGBA", (S * len(glyphs), S), (255, 255, 255, 0))
    for i, g in enumerate(glyphs):
        out.paste(g, (i * S, 0))
    out.save(PNG)
    chars = "".join(chr(0xE030 + i) for i in range(len(glyphs)))
    JSON.write_text(
        '{\n  "providers": [\n    {\n      "type": "bitmap",\n      "file": "bi4visual:font/fx.png",\n'
        '      "height": 64,\n      "ascent": 32,\n      "chars": [\n        "'
        + "".join("\\u%04x" % ord(c) for c in chars)
        + '"\n      ]\n    }\n  ]\n}\n'
    )
    print(len(glyphs), "glyphs")


if __name__ == "__main__":
    main()
