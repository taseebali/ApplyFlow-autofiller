import type { Settings } from './settings';

const NOTION_VERSION = '2022-06-28';
const MAX_RICH_TEXT_LENGTH = 2000;

export interface NotionLogEntry {
  title: string;
  company: string;
  jobUrl: string;
  source: string;
  jobDescription: string | null;
}

/** Splits text into <=2000-char chunks without cutting words, respecting Notion's rich_text length limit. */
function chunkText(text: string, maxLength = MAX_RICH_TEXT_LENGTH): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt < maxLength * 0.5) splitAt = remaining.lastIndexOf(' ', maxLength);
    if (splitAt < 1) splitAt = maxLength;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  return chunks;
}

function jobDescriptionBlocks(jobDescription: string | null) {
  if (!jobDescription) return [];
  return chunkText(jobDescription).map((chunk) => ({
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: chunk } }] },
  }));
}

export class NotionApiError extends Error {}

export interface NotionDatabaseOption {
  id: string;
  title: string;
}

/** Lists the databases the given integration token has been shared with, so the user can pick one instead of copy-pasting its ID. */
export async function searchDatabases(token: string): Promise<NotionDatabaseOption[]> {
  const response = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filter: { property: 'object', value: 'database' } }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new NotionApiError(`Notion API error (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    results: Array<{ id: string; title?: Array<{ plain_text: string }> }>;
  };

  return data.results.map((r) => ({
    id: r.id,
    title: r.title?.map((t) => t.plain_text).join('') || 'Untitled database',
  }));
}

/** Creates a row in the user's Job Application Tracker database, with the JD as page body content. */
export async function logApplicationToNotion(
  notion: Settings['notion'],
  entry: NotionLogEntry
): Promise<{ url: string }> {
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notion.token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: notion.databaseId },
      properties: {
        Title: { title: [{ text: { content: entry.title || 'Untitled role' } }] },
        Company: { rich_text: [{ text: { content: entry.company } }] },
        'Job URL': entry.jobUrl ? { url: entry.jobUrl } : undefined,
        'Applied Date': { date: { start: new Date().toISOString().slice(0, 10) } },
        Status: { select: { name: 'Applied' } },
        Source: { select: { name: entry.source } },
      },
      children: jobDescriptionBlocks(entry.jobDescription),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new NotionApiError(`Notion API error (${response.status}): ${body.slice(0, 300)}`);
  }

  const created = (await response.json()) as { url: string };
  return { url: created.url };
}
