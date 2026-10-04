#!/usr/bin/env python3
"""Generate PNG assets for Roblox Studio Android Edition.

Outputs:
  docs/app/assets/icon-192.png, icon-512.png, icon-maskable-512.png,
         apple-touch-icon.png, favicon-16.png, favicon-32.png,
         og.png (1200x630), feature-graphic.png (1024x500)
  android/app/src/main/res/mipmap-*/ic_launcher.png  (if that tree exists)

Run:  python tools/gen_assets.py
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_ASSETS = os.path.join(ROOT, "docs", "app", "assets")
ANDROID_RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

TOP = (30, 136, 255)      # #1e88ff
BOT = (11, 79, 179)       # #0b4fb3
DARK = (15, 17, 21)       # #0f1115
GREEN = (0, 226, 138)     # #00e28a
LIGHT = (232, 234, 237)
MUTED = (139, 146, 156)

FONT_DIRS = [
    r"C:\Windows\Fonts",
    "/usr/share/fonts/truetype/dejavu",
    "/usr/share/fonts/truetype/liberation",
]


def font(size, bold=False):
    names = ["segoeuib.ttf", "seguisb.ttf", "arialbd.ttf"] if bold else \
            ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"]
    for d in FONT_DIRS:
        for n in names:
            p = os.path.join(d, n)
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    pass
    return ImageFont.load_default()


def vgradient(w, h, top=TOP, bot=BOT):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    return img


def rounded_mask(w, h, radius):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    return m


def cube_points(cx, cy, hw):
    """Isometric cube vertices scaled from the 512px reference art."""
    def P(x, y):
        return (cx + (x - 256) * hw / 128.0, cy + (y - 236) * hw / 128.0)
    top = [P(256, 96), P(384, 166), P(256, 236), P(128, 166)]
    left = [P(128, 166), P(256, 236), P(256, 376), P(128, 306)]
    right = [P(384, 166), P(384, 306), P(256, 376), P(256, 236)]
    return top, left, right


def draw_cube(base, cx, cy, hw, outline=True):
    """Composite the white isometric cube onto an RGB image."""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    top, left, right = cube_points(cx, cy, hw)
    d.polygon(left, fill=(255, 255, 255, 199))
    d.polygon(right, fill=(255, 255, 255, 148))
    d.polygon(top, fill=(255, 255, 255, 255))
    if outline:
        for face in (top, left, right):
            pts = face + [face[0]]
            d.line(pts, fill=(11, 79, 179, 90), width=max(2, int(hw / 22)), joint="curve")
    base.alpha_composite(layer)


def draw_badge(size, maskable=False, play_badge=False, radius_ratio=0.22):
    """App icon: gradient tile + cube (+ optional play badge)."""
    img = vgradient(size, size).convert("RGBA")
    if not maskable:
        img.putalpha(rounded_mask(size, size, int(size * radius_ratio)))
    scale = 0.62 if maskable else 1.0
    cx, cy = size / 2, size * (0.442 if not maskable else 0.5)
    hw = 128 * (size / 512.0) * scale * (1.0 if maskable else 1.06)
    cx += (-26 * size / 512.0) if not maskable else 0
    cy += (-30 * size / 512.0) if not maskable else 0
    draw_cube(img, cx, cy, hw)
    if play_badge and not maskable and size >= 96:
        r = 74 * size / 512.0
        bx, by = 374 * size / 512.0, 374 * size / 512.0
        d = ImageDraw.Draw(img)
        d.ellipse([bx - r, by - r, bx + r, by + r], fill=DARK + (255,))
        d.ellipse([bx - r, by - r, bx + r, by + r], outline=(255, 255, 255, 46),
                  width=max(2, int(size / 85)))
        tri = [(bx - 0.27 * r, by - 0.43 * r), (bx + 0.49 * r, by), (bx - 0.27 * r, by + 0.43 * r)]
        d.polygon(tri, fill=GREEN + (255,))
    return img


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if img.mode == "RGBA" and path.endswith("apple-touch-icon.png"):
        img = img.convert("RGB")
    img.save(path, "PNG")
    print("wrote", os.path.relpath(path, ROOT), img.size)


def banner(w=1200, h=630):
    img = Image.new("RGB", (w, h), DARK)
    d = ImageDraw.Draw(img)
    # subtle diagonal sheen
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sheen)
    ds.polygon([(0, h), (w * 0.55, 0), (w, 0), (w, h)], fill=(30, 136, 255, 26))
    img = Image.alpha_composite(img.convert("RGBA"), sheen).convert("RGB")

    # grid dots
    gd = ImageDraw.Draw(img)
    for gx in range(0, w, 48):
        for gy in range(0, h, 48):
            gd.point((gx, gy), fill=(58, 64, 74))

    # logo tile
    tile = 200
    logo = draw_badge(tile, play_badge=False, radius_ratio=0.22)
    img.paste(logo, (90, (h - tile) // 2), logo)

    x = 90 + tile + 70
    d = ImageDraw.Draw(img)
    d.text((x, h // 2 - 104), "Roblox Studio", font=font(84, bold=True), fill=LIGHT)
    d.text((x, h // 2 - 14), "Android Edition", font=font(84, bold=True), fill=TOP)
    d.text((x, h // 2 + 92),
           "3D viewport  Â·  Lua scripting  Â·  AI Builder  Â·  Toolbox",
           font=font(30), fill=MUTED)
    d.text((x, h // 2 + 134),
           "Templates  Â·  Group games  Â·  Open Cloud publish",
           font=font(30), fill=MUTED)
    d.text((x, h // 2 + 196), "Android APK  Â·  Web app  Â·  PWA",
           font=font(30, bold=True), fill=GREEN)
    return img


def feature_graphic(w=1024, h=500):
    img = vgradient(w, h, top=(24, 120, 235), bot=(8, 46, 110)).convert("RGBA")
    veil = Image.new("RGBA", (w, h), (15, 17, 21, 90))
    img = Image.alpha_composite(img, veil)

    tile = 240
    logo = draw_badge(tile, play_badge=False, radius_ratio=0.22)
    img.paste(logo, (96, (h - tile) // 2), logo)

    d = ImageDraw.Draw(img)
    x = 96 + tile + 64
    d.text((x, h // 2 - 88), "Roblox Studio", font=font(76, bold=True), fill=(255, 255, 255))
    d.text((x, h // 2 + 2), "Android Edition", font=font(76, bold=True), fill=(140, 205, 255))
    d.text((x, h // 2 + 104), "Build, script and publish Roblox experiences from your phone",
           font=font(28), fill=(222, 231, 240))
    return img


def main():
    save(draw_badge(192, play_badge=True), os.path.join(DOCS_ASSETS, "icon-192.png"))
    save(draw_badge(512, play_badge=True), os.path.join(DOCS_ASSETS, "icon-512.png"))
    save(draw_badge(512, maskable=True), os.path.join(DOCS_ASSETS, "icon-maskable-512.png"))
    save(draw_badge(180, play_badge=True, radius_ratio=0.0), os.path.join(DOCS_ASSETS, "apple-touch-icon.png"))
    save(draw_badge(32, play_badge=False, radius_ratio=0.22), os.path.join(DOCS_ASSETS, "favicon-32.png"))
    save(draw_badge(16, play_badge=False, radius_ratio=0.22), os.path.join(DOCS_ASSETS, "favicon-16.png"))
    save(banner(), os.path.join(DOCS_ASSETS, "og.png"))
    save(feature_graphic(), os.path.join(DOCS_ASSETS, "feature-graphic.png"))

    if os.path.isdir(ANDROID_RES):
        for density, px in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96),
                            ("xxhdpi", 144), ("xxxhdpi", 192)):
            save(draw_badge(px, play_badge=True),
                 os.path.join(ANDROID_RES, "mipmap-" + density, "ic_launcher.png"))


if __name__ == "__main__":
    main()
