/** Best-effort extraction of the hiring company's name from the current page. */
export function scrapeCompanyName(): string | null {
  // 1. JSON-LD JobPosting structured data (schema.org) — most reliable when present.
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent ?? '');
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const name = item?.hiringOrganization?.name;
        if (typeof name === 'string' && name.trim()) return name.trim();
      }
    } catch {
      // Malformed JSON-LD on the page — ignore and keep trying other sources.
    }
  }

  // 2. Open Graph site name meta tag.
  const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
  if (ogSiteName?.trim()) return ogSiteName.trim();

  // 3. "<Job Title> at <Company>" style page titles.
  const titleMatch = document.title.match(/ at ([^|\-–]+)/i);
  if (titleMatch?.[1]?.trim()) return titleMatch[1].trim();

  return null;
}
