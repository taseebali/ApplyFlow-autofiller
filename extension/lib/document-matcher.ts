export type DocumentKind = 'resume' | 'coverLetter';

const KEYWORDS: Record<DocumentKind, string[]> = {
  resume: ['resume', 'cv'],
  coverLetter: ['cover letter', 'coverletter', 'cover'],
};

export interface FolderFile {
  name: string;
  handle: FileSystemFileHandle;
  lastModified: number;
}

export async function listFolderFiles(folder: FileSystemDirectoryHandle): Promise<FolderFile[]> {
  const files: FolderFile[] = [];
  for await (const entry of folder.values()) {
    if (entry.kind !== 'file') continue;
    const fileHandle = entry as FileSystemFileHandle;
    const file = await fileHandle.getFile();
    files.push({ name: entry.name, handle: fileHandle, lastModified: file.lastModified });
  }
  return files;
}

export interface DocumentMatchResult {
  file: FolderFile | null;
  /**
   * "company": filename matched the detected company name — high confidence.
   * "most-recent": company name couldn't be detected, so this is just the
   *   newest keyword-matching file — best-effort, should be confirmed by the user.
   * "none": either no keyword-matching file exists, or the company was known
   *   but no file matched it (we don't guess wrong-company in that case).
   */
  matchedBy: 'company' | 'most-recent' | 'none';
}

function newestOf(files: FolderFile[]): FolderFile {
  return [...files].sort((a, b) => b.lastModified - a.lastModified)[0]!;
}

export function findBestMatch(
  files: FolderFile[],
  kind: DocumentKind,
  companyName: string | null
): DocumentMatchResult {
  const keywords = KEYWORDS[kind];
  const candidates = files.filter((f) => {
    const name = f.name.toLowerCase();
    return keywords.some((k) => name.includes(k));
  });

  if (candidates.length === 0) return { file: null, matchedBy: 'none' };

  if (companyName) {
    const normalizedCompany = companyName.toLowerCase();
    const companyMatches = candidates.filter((f) => f.name.toLowerCase().includes(normalizedCompany));
    if (companyMatches.length > 0) {
      return { file: newestOf(companyMatches), matchedBy: 'company' };
    }
    // Known company, but nothing matched it by filename — don't guess wrong.
    return { file: null, matchedBy: 'none' };
  }

  return { file: newestOf(candidates), matchedBy: 'most-recent' };
}
