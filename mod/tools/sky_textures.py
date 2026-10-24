# Run from this folder: python3 sky_textures.py, then copy galaxy.png and aurora.png
# to src/main/resources/assets/bi4visual/textures/font/.
# Procedural sky textures for the bi4visual mod: a purple galaxy band and aurora curtains.
import numpy as np
from PIL import Image, ImageFilter
rng = np.random.default_rng(7)

def fbm(h, w, octaves=6, base=4, seed=0, wrap_x=True):
    r = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        gh, gw = base * 2**o // 4 + 2, base * 2**o + 1
        g = r.random((gh, gw))
        if wrap_x:
            g[:, -1] = g[:, 0]
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += amp * np.asarray(img) / 255.0
        total += amp
        amp *= 0.55
    return out / total

# Galaxy band: 1536 x 256 (12 x 2 tiles of 128).
W, H = 1536, 256
y = np.linspace(-1, 1, H)[:, None]
x = np.linspace(0, 1, W)[None, :]
n = fbm(H, W, seed=1)
n2 = fbm(H, W, seed=2, base=8)
warp = (n - 0.5) * 0.9
band = np.exp(-((y + warp * 0.6 + 0.12 * np.sin(x * 6.283 * 2)) ** 2) / 0.10)
core = np.exp(-((y + warp * 0.4) ** 2) / 0.02) * (0.6 + 0.4 * np.sin(x * 6.283 * 3 + 1) ** 2)
dust = np.clip((n2 - 0.52) * 4, 0, 1) * np.exp(-(y ** 2) / 0.05)
n3 = fbm(H, W, seed=6, base=12)
dust = np.clip((n2 - 0.45) * 3, 0, 1) * np.exp(-((y + warp * 0.4) ** 2) / 0.03)
inten = np.clip(band * (0.15 + 0.85 * n ** 1.5) * 1.05 + core * 0.75 * n3 - dust * 0.7, 0, 1.2)
deep = np.array([60, 25, 140]) / 255
mid = np.array([150, 90, 255]) / 255
hot = np.array([245, 225, 255]) / 255
t = np.clip(inten, 0, 1)[..., None]
rgb = deep * (1 - t) + mid * t
rgb = rgb * (1 - np.clip(inten - 0.8, 0, 1)[..., None] * 1.5) + hot * np.clip(inten - 0.8, 0, 1)[..., None] * 1.5
alpha = np.clip(inten * 1.1, 0, 1) ** 1.2
# Stars.
stars = np.zeros((H, W))
for _ in range(1400):
    sy, sx = rng.integers(0, H), rng.integers(0, W)
    stars[sy, sx] = rng.random() ** 3
stars = np.asarray(Image.fromarray((stars * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))) / 255.0 * 3
rgb = np.clip(rgb + stars[..., None], 0, 1)
alpha = np.clip(np.maximum(alpha, np.clip(stars, 0, 1)), 0, 1)
# Fade the top and bottom edges so no seam shows.
edge = np.clip(np.minimum(np.linspace(0, 1, H), np.linspace(1, 0, H)) * 6, 0, 1)[:, None]
alpha *= edge
img = np.dstack([rgb * 255, alpha * 255]).astype(np.uint8)
Image.fromarray(img, "RGBA").save("galaxy.png")

# Aurora curtains: 1024 x 128 (8 tiles of 128). Row 0 is the top.
W, H = 1024, 128
row = np.linspace(0, 1, H)[:, None]  # 0 top, 1 bottom
x = np.linspace(0, 1, W)[None, :]
edge_y = 0.8 + (fbm(1, W, octaves=4, base=6, seed=4)[0][None, :] - 0.5) * 0.25
below = row > edge_y
fade_up = np.clip(1 - (edge_y - row) / 0.75, 0, 1) ** 2.2
fade_down = np.exp(-((row - edge_y) / 0.035) ** 2)
shape = np.where(below, fade_down, fade_up)
rays = fbm(1, W, octaves=6, base=40, seed=3)[0][None, :]
rays = 0.25 + 0.75 * np.clip((rays - 0.3) * 2.0, 0, 1)
patch = 0.4 + 0.6 * fbm(1, W, octaves=3, base=5, seed=5)[0][None, :]
inten = shape * rays * patch
low = np.array([175, 135, 255]) / 255
high = np.array([110, 60, 220]) / 255
t = np.clip((edge_y - row) / 0.7, 0, 1)[..., None]
rgb = low * (1 - t) + high * t
alpha = np.clip(inten * 1.3, 0, 1)
side = np.clip(np.minimum(np.linspace(0, 1, W), np.linspace(1, 0, W)) * 10, 0, 1)[None, :]
alpha *= side
img = np.dstack([rgb * 255, alpha * 255]).astype(np.uint8)
Image.fromarray(img, "RGBA").save("aurora.png")
