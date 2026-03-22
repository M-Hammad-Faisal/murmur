#!/usr/bin/env python3
"""Convert Gemini-generated PNG logo into all required Electron icon formats."""

import io
import os
import shutil
import struct
import subprocess
import sys

try:
    from PIL import Image
except ImportError:
    print("Pillow not found. Run: pip3 install pillow --break-system-packages")
    sys.exit(1)

SRC = os.path.join(
    os.path.dirname(__file__), "..",
    "packages", "Gemini_Generated_Image_bn052qbn052qbn05.png",
)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "apps", "main", "resources", "icons")
os.makedirs(OUT_DIR, exist_ok=True)

# ── Load & detect logo bounds by finding the dark navy region ─────────────────
src = Image.open(SRC).convert("RGB")
w_src, h_src = src.size
pixels = src.load()

min_x, min_y, max_x, max_y = w_src, h_src, 0, 0
for y in range(h_src):
    for x in range(w_src):
        r, g, b = pixels[x, y]
        if r < 80 and g < 100 and b < 160:   # dark navy pixels
            if x < min_x: min_x = x
            if y < min_y: min_y = y
            if x > max_x: max_x = x
            if y > max_y: max_y = y

# Tiny padding so rounded corners aren't clipped
pad = 4
bbox = (max(0, min_x - pad), max(0, min_y - pad),
        min(w_src, max_x + pad), min(h_src, max_y + pad))
cropped = src.crop(bbox)

# Make it square
w, h = cropped.size
side = max(w, h)
bg_color = (13, 27, 42)           # fallback fill matching the logo background
square = Image.new("RGB", (side, side), bg_color)
square.paste(cropped, ((side - w) // 2, (side - h) // 2))

print(f"Source: {w_src}×{h_src}  →  logo bbox {bbox}  →  squared to {side}×{side}")


def resized(size: int) -> Image.Image:
    return square.resize((size, size), Image.LANCZOS)


# ── icon.png  1024×1024 ───────────────────────────────────────────────────────
base = resized(1024)
base.save(os.path.join(OUT_DIR, "icon.png"), "PNG")
print("  ✓ icon.png  (1024×1024)")

# ── icon.jpg  1024×1024 ───────────────────────────────────────────────────────
base.save(os.path.join(OUT_DIR, "icon.jpg"), "JPEG", quality=97)
print("  ✓ icon.jpg  (1024×1024)")

# ── tray.png  32×32 ──────────────────────────────────────────────────────────
resized(32).save(os.path.join(OUT_DIR, "tray.png"), "PNG")
print("  ✓ tray.png  (32×32)")

# ── icon.icns  (macOS via iconutil) ──────────────────────────────────────────
iconset_dir = os.path.join(OUT_DIR, "icon.iconset")
os.makedirs(iconset_dir, exist_ok=True)

for fname, sz in {
    "icon_16x16.png":      16,
    "icon_16x16@2x.png":   32,
    "icon_32x32.png":      32,
    "icon_32x32@2x.png":   64,
    "icon_64x64.png":      64,
    "icon_64x64@2x.png":   128,
    "icon_128x128.png":    128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png":    256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png":    512,
    "icon_512x512@2x.png": 1024,
}.items():
    resized(sz).save(os.path.join(iconset_dir, fname), "PNG")

result = subprocess.run(
    ["iconutil", "-c", "icns", iconset_dir, "-o", os.path.join(OUT_DIR, "icon.icns")],
    capture_output=True, text=True,
)
shutil.rmtree(iconset_dir, ignore_errors=True)
if result.returncode == 0:
    print("  ✓ icon.icns (macOS, 12 sizes)")
else:
    print(f"  ✗ icon.icns: {result.stderr}")

# ── icon.ico  (Windows) ───────────────────────────────────────────────────────
def write_ico(path: str, sizes: list[int]) -> None:
    images = [(sz, resized(sz).convert("RGBA")) for sz in sizes]
    n = len(images)
    header = struct.pack("<HHH", 0, 1, n)
    entries, blobs = [], []
    offset = 6 + n * 16
    for sz, img in images:
        buf = io.BytesIO()
        img.convert("RGBA").save(buf, format="PNG")
        data = buf.getvalue()
        w = sz if sz < 256 else 0
        h = sz if sz < 256 else 0
        entries.append(struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(data), offset))
        blobs.append(data)
        offset += len(data)
    with open(path, "wb") as f:
        f.write(header)
        for e in entries:
            f.write(e)
        for b in blobs:
            f.write(b)

ico_sizes = [16, 32, 48, 64, 128, 256]
write_ico(os.path.join(OUT_DIR, "icon.ico"), ico_sizes)   # write_ico converts to RGBA internally
print(f"  ✓ icon.ico  (Windows, {ico_sizes}px)")

print(f"\nDone! → {OUT_DIR}")
