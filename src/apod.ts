/**
 * "Earth uplink": after every completed sol, mission control sends the crew a
 * NASA Astronomy Picture of the Day. The live APOD API (api.nasa.gov) is asked
 * first; when it is unreachable, rate-limited, or answers with its current
 * generic "NASA Science" placeholder, a baked set of real APOD entries
 * (public/apod/archive.json, see scripts/bake-apod.py) is used instead.
 *
 * The card never pauses the simulation: it slides in, can be expanded or
 * dismissed, and collapses to a small chip that reopens the latest picture.
 */
export interface ApodEntry {
  date: string;
  title: string;
  explanation: string;
  credit: string;
  image: string; // absolute URL
  source: string; // page to open for the full article
  media: "image" | "video";
  origin: "live" | "archive";
}

const API = "https://api.nasa.gov/planetary/apod";
const CACHE_KEY = "nebula.apod.v1";
const apiKey = (): string =>
  (import.meta.env.VITE_NASA_API_KEY as string | undefined) || "DEMO_KEY";

/** The API's post-migration stand-in response is not a real picture. */
export function isPlaceholder(d: {
  title?: string;
  url?: string;
  explanation?: string;
}) {
  return (
    !d?.url ||
    /nasa-logo/i.test(d.url) ||
    d.title === "NASA Science" ||
    /^Discover the cosmos!/.test(d.explanation ?? "")
  );
}

function firstSentences(text: string, n = 3) {
  const parts = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/);
  return parts.slice(0, n).join(" ");
}

/** Real calendar date whose APOD is beamed up after `sol` (sol 7 → today). */
export function dateForSol(sol: number, sols: number, today = new Date()) {
  const d = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() - Math.max(0, sols - sol) - 1);
  return d.toISOString().slice(0, 10);
}

let archive: Promise<ApodEntry[]> | null = null;
function loadArchive(): Promise<ApodEntry[]> {
  const base = import.meta.env.BASE_URL + "apod/";
  archive ??= fetch(base + "archive.json")
    .then((r) => r.json())
    .then((j: { entries: Omit<ApodEntry, "origin">[] }) =>
      j.entries.map((e) => ({
        ...e,
        image: base + e.image,
        media: e.media ?? "image",
        origin: "archive" as const,
      })),
    )
    .catch(() => []);
  return archive;
}

function readCache(): Record<string, ApodEntry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

async function fetchLive(date: string): Promise<ApodEntry | null> {
  const cached = readCache()[date];
  if (cached) return cached;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(
      `${API}?api_key=${encodeURIComponent(apiKey())}&thumbs=true&date=${date}`,
      { signal: ctl.signal },
    );
    clearTimeout(t);
    if (!r.ok) return null;
    const d = await r.json();
    if (isPlaceholder(d)) return null;
    const video = d.media_type === "video";
    const image = video ? d.thumbnail_url : d.url;
    if (!image) return null;
    const [y, m, day] = date.split("-");
    const e: ApodEntry = {
      date,
      title: d.title,
      explanation: firstSentences(d.explanation ?? ""),
      credit: (d.copyright ?? "NASA").replace(/\s+/g, " ").trim(),
      image,
      source: `https://apod.nasa.gov/apod/ap${y.slice(2)}${m}${day}.html`,
      media: video ? "video" : "image",
      origin: "live",
    };
    const c = readCache();
    c[date] = e;
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    return e;
  } catch {
    return null;
  }
}

/** Picture for the end of `sol` (1-based): live first, archive fallback. */
export async function apodForSol(sol: number, sols: number) {
  const live = await fetchLive(dateForSol(sol, sols));
  if (live) return live;
  const list = await loadArchive();
  return list.length ? list[(sol - 1) % list.length] : null;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);

export function createApodWidget(parent: HTMLElement) {
  const card = document.createElement("aside");
  card.id = "apod-card";
  card.setAttribute("aria-live", "polite");
  card.hidden = true;
  const chip = document.createElement("button");
  chip.id = "apod-chip";
  chip.type = "button";
  chip.hidden = true;
  chip.title = "Reopen the latest Earth uplink";
  parent.append(card, chip);
  let current: ApodEntry | null = null;
  let currentSol = 0;
  let collapseTimer = 0;
  const received: number[] = [];

  function render(expanded: boolean) {
    if (!current) return;
    const e = current;
    card.classList.toggle("expanded", expanded);
    card.innerHTML = `
      <div class="apod-head">
        <span class="apod-tag">EARTH UPLINK · SOL ${currentSol} COMPLETE</span>
        <button type="button" class="apod-close" aria-label="Dismiss">×</button>
      </div>
      <button type="button" class="apod-image" aria-label="Expand picture">
        <img src="${esc(e.image)}" alt="${esc(e.title)}" loading="eager" decoding="async">
        ${e.media === "video" ? '<span class="apod-play">▶ video</span>' : ""}
      </button>
      <p class="apod-kicker">NASA Astronomy Picture of the Day · ${esc(e.date)}</p>
      <h3>${esc(e.title)}</h3>
      <p class="apod-text">${esc(e.explanation)}</p>
      <p class="apod-credit">Credit: ${esc(e.credit)}${e.origin === "archive" ? " · from the APOD archive" : ""}</p>
      <a href="${esc(e.source)}" target="_blank" rel="noopener">Open on NASA APOD ↗</a>`;
    card.querySelector(".apod-close")!.addEventListener("click", collapse);
    card
      .querySelector(".apod-image")!
      .addEventListener("click", () => render(!card.classList.contains("expanded")));
    schedule(expanded);
  }
  /** Auto-collapse after a while, but never while read or expanded. */
  function schedule(expanded = card.classList.contains("expanded")) {
    clearTimeout(collapseTimer);
    if (!expanded && !card.matches(":hover"))
      collapseTimer = window.setTimeout(collapse, 22000);
  }
  card.addEventListener("mouseenter", () => clearTimeout(collapseTimer));
  card.addEventListener("mouseleave", () => {
    schedule();
    // Hand keyboard focus back to the game.
    document.querySelector<HTMLCanvasElement>("#world")?.focus();
  });

  function collapse() {
    clearTimeout(collapseTimer);
    card.classList.remove("show");
    setTimeout(() => (card.hidden = true), 350);
    if (current) {
      chip.hidden = false;
      chip.innerHTML = `<img src="${esc(current.image)}" alt=""><span>APOD · Sol ${currentSol}</span>`;
    }
  }

  function open(entry: ApodEntry, sol: number) {
    current = entry;
    currentSol = sol;
    chip.hidden = true;
    card.hidden = false;
    render(false);
    requestAnimationFrame(() => card.classList.add("show"));
  }

  chip.addEventListener("click", () => current && open(current, currentSol));

  return {
    /** Fetch and show the picture for a completed sol (idempotent per sol). */
    async deliver(sol: number, sols: number) {
      if (received.includes(sol)) return;
      received.push(sol);
      const e = await apodForSol(sol, sols);
      if (e) open(e, sol);
    },
    reset(completedSols = 0) {
      received.length = 0;
      for (let s = 1; s <= completedSols; s++) received.push(s);
      clearTimeout(collapseTimer);
      card.classList.remove("show");
      card.hidden = chip.hidden = true;
      current = null;
    },
    get state() {
      return {
        visible: !card.hidden && card.classList.contains("show"),
        chip: !chip.hidden,
        sol: currentSol,
        title: current?.title ?? null,
        origin: current?.origin ?? null,
        received: [...received],
      };
    },
  };
}
