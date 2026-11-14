#!/usr/bin/env python3
"""
Bake a fallback set of real NASA Astronomy Picture of the Day entries.

Why: since APOD moved to science.nasa.gov, api.nasa.gov/planetary/apod
answers every date with a generic "NASA Science" placeholder. The game still
asks the live API first (see src/apod.ts) and uses these entries only when
the API is unreachable or returns the placeholder.

Each entry is read from its official APOD article page (og:title, og:image,
Explanation, Image Credit). Images are downscaled copies stored in
public/apod/ so the widget also works offline; each keeps its credit line and
a link back to the original article.

Usage: python3 scripts/bake-apod.py
"""
import html, json, os, re, sys, urllib.request
from io import BytesIO
from PIL import Image

ARTICLES = [
    "https://science.nasa.gov/image-article/apod-2026-june-27-mars-marathon-by-perseverance/",
    "https://science.nasa.gov/image-article/apod-2023-november-7-a-martian-dust-devil-spins-by/",
    "https://science.nasa.gov/image-article/apod-2025-july-6-the-spiral-north-pole-of-mars/",
    "https://science.nasa.gov/image-article/apod-2024-march-22-phobos-moon-over-mars/",
    "https://science.nasa.gov/image-article/apod-2025-june-29-dark-sand-cascades-on-mars/",
    "https://science.nasa.gov/image-article/apod-2024-november-10-valles-marineris-the-grand-canyon-of-mars/",
    "https://science.nasa.gov/image-article/apod-2025-april-13-an-unusual-hole-in-mars/",
    "https://science.nasa.gov/image-article/apod-2026-february-1-galle-happy-face-crater-on-mars/",
]
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "apod")
UA = {"User-Agent": "Mozilla/5.0 (Nebula educational game asset bake)"}
MONTHS = "january february march april may june july august september october november december".split()


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()


def meta(page, prop):
    m = re.search(r'<meta[^>]+property="%s"[^>]+content="([^"]*)"' % re.escape(prop), page)
    return html.unescape(m.group(1)) if m else None


def text(fragment):
    t = re.sub(r"<[^>]+>", " ", fragment)
    t = re.sub(r"\s+", " ", html.unescape(t)).strip()
    return re.sub(r"\s+([.,;:!?)\]])", r"\1", t).replace("( ", "(")


os.makedirs(OUT, exist_ok=True)
entries = []
for url in ARTICLES:
    page = get(url).decode("utf-8", "replace")
    slug = url.rstrip("/").split("/")[-1]
    y, mon, d = re.match(r"apod-(\d{4})-([a-z]+)-(\d+)-", slug).groups()
    date = "%s-%02d-%02d" % (y, MONTHS.index(mon) + 1, int(d))
    title = meta(page, "og:title") or ""
    title = re.sub(r"^APOD:\s*\d{4} \w+ \d+\s*[-–]\s*", "", title)
    title = re.sub(r"\s*-\s*NASA Science\s*$", "", title)
    body = text(page)
    ex = re.search(r"Explanation:\s*(.+?)\s*(Tomorrow's picture|Authors? & editors|$)", body)
    credit = re.search(
        r"(?:Image |Video |Illustration )?Credits?(?: & Copyright)?:\s*(.+?)\s*(?:Authors? & editors|Explanation:|$)",
        body)
    copyright_ = bool(credit and re.search(r"Copyright|License", credit.group(0)))
    video = bool(re.search(r"youtube\.com/embed|\.mp4|player\.vimeo", page))
    explanation = ex.group(1).strip() if ex else ""
    # Keep the widget readable: first ~3 sentences.
    sentences = re.split(r"(?<=[.!?])\s+", explanation)
    short = " ".join(sentences[:3])
    img_url = meta(page, "og:image")
    if not img_url:
        print("skip (no image)", url, file=sys.stderr)
        continue
    im = Image.open(BytesIO(get(img_url))).convert("RGB")
    im.thumbnail((960, 960))
    fname = date + ".jpg"
    im.save(os.path.join(OUT, fname), quality=80, optimize=True)
    entries.append({
        "date": date,
        "title": title.strip(),
        "explanation": short,
        "credit": (credit.group(1).strip()[:160] if credit else "NASA APOD"),
        "copyright": copyright_,
        "media": "video" if video else "image",
        "image": fname,
        "source": url,
    })
    print(date, "|", title, "|", entries[-1]["credit"][:70], "| ©" if copyright_ else "")

json.dump({"note": "Real APOD entries baked from science.nasa.gov by scripts/bake-apod.py; "
           "used only when the live APOD API is unavailable or returns its placeholder.",
           "entries": entries}, open(os.path.join(OUT, "archive.json"), "w"), indent=2)
print(len(entries), "entries")
