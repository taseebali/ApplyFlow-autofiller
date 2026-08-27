function findJobPostingJsonLd(doc: Document): Record<string, unknown> | null {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent ?? '');
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item && typeof item === 'object' && item['@type'] === 'JobPosting') {
          return item as Record<string, unknown>;
        }
      }
    } catch {
      // Malformed JSON-LD on the page — ignore and keep trying other sources.
    }
  }
  return null;
}

function htmlToText(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  return (container.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Largest non-form text block in a plausibly-named container — a best-effort fallback when no JSON-LD exists. */
function scrapeByHeuristic(doc: Document): string | null {
  const MIN_LENGTH = 400;
  const candidateSelectors = [
    '[class*="job-description" i]',
    '[class*="jobdescription" i]',
    '[id*="job-description" i]',
    '[class*="description" i]',
    'article',
    'main',
  ];

  for (const selector of candidateSelectors) {
    let best: string | null = null;
    doc.querySelectorAll(selector).forEach((el) => {
      const clone = el.cloneNode(true) as Element;
      // Exclude form content — an application form's own labels/instructions
      // aren't a job description, even when they're the biggest text block.
      clone.querySelectorAll('form').forEach((f) => f.remove());
      const text = (clone.textContent ?? '').trim();
      if (text.length >= MIN_LENGTH && (!best || text.length > best.length)) best = text;
    });
    // A selector tuned specifically for job descriptions beats falling
    // through to generic containers like <main>, so stop at the first hit.
    if (best) return best;
  }

  return null;
}

function scrapeJobPostingFrom(doc: Document): string | null {
  const jobPosting = findJobPostingJsonLd(doc);
  const jsonLdDescription = jobPosting?.description;
  if (typeof jsonLdDescription === 'string' && jsonLdDescription.trim()) {
    return htmlToText(jsonLdDescription);
  }
  return scrapeByHeuristic(doc);
}

/** Same-origin URLs likely to be "the actual job posting" when this page (e.g. an /apply sub-page) has none. */
function relatedPageCandidates(): string[] {
  const candidates = new Set<string>();

  const strippedApply = location.href.replace(/\/apply\/?(\?.*)?$/i, '');
  if (strippedApply !== location.href) candidates.add(strippedApply);

  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    if (
      a.href.startsWith(location.origin) &&
      a.href !== location.href &&
      location.href.startsWith(a.href.replace(/\/$/, ''))
    ) {
      candidates.add(a.href);
    }
  });

  return Array.from(candidates);
}

/**
 * Best-effort job description extraction. Prefers schema.org JobPosting
 * structured data on the current page (reliable when present — many ATSs
 * embed it for SEO). Many ATS flows (e.g. join.com-style /apply sub-pages)
 * show the application form on a separate page from the actual posting, so
 * as a fallback this also tries same-origin pages the current page links
 * back to (e.g. a "Back to job" link) before giving up.
 */
export async function scrapeJobDescription(): Promise<string | null> {
  const direct = scrapeJobPostingFrom(document);
  if (direct) return direct;

  for (const url of relatedPageCandidates()) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const html = await response.text();
      const relatedDoc = new DOMParser().parseFromString(html, 'text/html');
      const description = scrapeJobPostingFrom(relatedDoc);
      if (description) return description;
    } catch {
      // Network failure or unparsable page — try the next candidate.
    }
  }

  return null;
}

/** Best-effort job title extraction, e.g. "Senior Product Manager". */
export function scrapeJobTitle(): string | null {
  const jobPosting = findJobPostingJsonLd(document);
  const jsonLdTitle = jobPosting?.title;
  if (typeof jsonLdTitle === 'string' && jsonLdTitle.trim()) return jsonLdTitle.trim();

  const h1 = document.querySelector('h1')?.textContent?.trim();
  if (h1) return h1;

  const titleMatch = document.title.match(/^([^|\-–]+)/);
  return titleMatch?.[1]?.trim() || null;
}
