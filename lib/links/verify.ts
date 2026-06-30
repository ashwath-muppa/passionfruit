// Link safeguard for AI-generated checkpoint resources. Models occasionally
// produce plausible-but-dead URLs; we verify every link and replace any broken
// one with a working "search within the provider" URL that reliably resolves
// and lands the student on the right resource. Run once at generation time, so
// the cached detail only ever stores links that work.

import "server-only";
import type { CheckpointResource, CheckpointStep, CheckpointDetail } from "@/lib/types";

const TIMEOUT_MS = 6000;
// A browser-like UA cuts false negatives from sites that block bare bots.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36";

function isHttpUrl(u: string): boolean {
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch {
    return false;
  }
}

async function probe(url: string, method: "HEAD" | "GET"): Promise<number | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "*/*" },
    });
    return res.status;
  } catch {
    return null; // DNS failure, connection refused, timeout, etc.
  } finally {
    clearTimeout(timer);
  }
}

/** True if the URL resolves to something real (exists), even if auth-gated. */
export async function isWorking(url: string): Promise<boolean> {
  if (!isHttpUrl(url)) return false;

  // YouTube serves HTTP 200 even for removed/private videos, so a status check
  // isn't enough — inspect the page for unavailability markers.
  if (isYoutubeWatch(url)) return youtubePlayable(url);

  let status = await probe(url, "HEAD");
  // Many servers don't support HEAD (405/501) or block it (403); confirm w/ GET.
  if (status === null || status === 403 || status === 405 || status === 501) {
    status = await probe(url, "GET");
  }
  if (status === null) return false;
  if (status >= 200 && status < 400) return true;
  // The page exists but is gated / rate-limited — treat as working.
  if (status === 401 || status === 403 || status === 429) return true;
  return false; // 404, 410, 5xx, …
}

function isYoutubeWatch(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h === "youtube.com" || h === "m.youtube.com" || h === "youtu.be";
  } catch {
    return false;
  }
}

/**
 * Check a YouTube video via the oEmbed endpoint: it returns 200 for a real,
 * embeddable video and 404 for a removed/nonexistent one — a clean signal the
 * watch page's HTTP 200 can't give. Ambiguous cases (401 embedding-disabled,
 * network hiccup) are kept rather than over-replaced.
 */
async function youtubePlayable(url: string): Promise<boolean> {
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const status = await probe(oembed, "GET");
  if (status === 404 || status === 400) return false; // removed / invalid id
  return true; // 200 valid, 401 restricted-but-real, or transient → keep
}

/** A provider-aware search URL that reliably resolves to the right place. */
function workingFallback(title: string, provider: string): string {
  const q = encodeURIComponent(title);
  const p = provider.toLowerCase();
  if (p.includes("youtube")) return `https://www.youtube.com/results?search_query=${q}`;
  if (p.includes("coursera")) return `https://www.coursera.org/search?query=${q}`;
  if (p.includes("khan")) return `https://www.khanacademy.org/search?page_search_query=${q}`;
  if (p.includes("kaggle")) return `https://www.kaggle.com/search?q=${q}`;
  if (p.includes("edx")) return `https://www.edx.org/search?q=${q}`;
  if (p.includes("udemy")) return `https://www.udemy.com/courses/search/?src=ukw&q=${q}`;
  if (p.includes("freecodecamp")) return `https://www.freecodecamp.org/news/search/?query=${q}`;
  if (p.includes("github")) return `https://github.com/search?q=${q}&type=repositories`;
  if (p.includes("mit")) return `https://ocw.mit.edu/search/?q=${q}`;
  if (p.includes("brilliant")) return `https://brilliant.org/search/?q=${q}`;
  if (p.includes("codecademy")) return `https://www.codecademy.com/search?query=${q}`;
  // Generic: a web search that always resolves and finds the resource.
  return `https://duckduckgo.com/?q=${encodeURIComponent(`${title} ${provider}`)}`;
}

async function repairResources(
  resources: CheckpointResource[],
): Promise<{ resources: CheckpointResource[]; replaced: number }> {
  let replaced = 0;
  const out = await Promise.all(
    resources.map(async (r) => {
      if (await isWorking(r.url)) return r;
      replaced++;
      return { ...r, url: workingFallback(r.title, r.provider) };
    }),
  );
  return { resources: out, replaced };
}

async function repairSteps(steps: CheckpointStep[]): Promise<CheckpointStep[]> {
  return Promise.all(
    steps.map(async (s) => {
      if (!s.resourceUrl) return s;
      if (await isWorking(s.resourceUrl)) return s;
      // A step's link is optional — drop a dead one; the instructions stand alone.
      const { resourceUrl: _drop, ...rest } = s;
      return rest;
    }),
  );
}

/**
 * Verify every link in a generated checkpoint detail and replace dead resource
 * links with working ones (broken step links are dropped). Returns the repaired
 * detail plus how many links were replaced (for logging).
 */
export async function repairDetailLinks(
  detail: CheckpointDetail,
): Promise<{ detail: CheckpointDetail; replaced: number }> {
  const [res, steps] = await Promise.all([
    repairResources(detail.resources),
    repairSteps(detail.steps),
  ]);
  return {
    detail: { ...detail, resources: res.resources, steps },
    replaced: res.replaced,
  };
}
