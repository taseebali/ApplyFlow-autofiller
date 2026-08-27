# ApplyFlow

A browser extension that fills job application forms from your own locally-stored profile, attaches the right resume/cover letter, and logs applications to a Notion tracker — all without leaving the tab you're applying from.

Your data stays local (`chrome.storage.local`); nothing is sent anywhere except the one explicit "Log to Notion" action, which talks directly to Notion's API using a token you provide.

## Features

- **Autofill** — detects form fields by label/name/id/placeholder (contact info, links, work history, education, work authorization/EEO, logistics, custom Q&A) and fills them from your profile, including React-controlled forms and radio-button groups.
- **Document attach** — grant access to the folder where you save tailored resumes/cover letters; it matches files by company name and keyword ("resume"/"cv"/"cover letter"), falling back to a generic "Additional Documents" field when a form has no dedicated one.
- **Notion logging** — captures the job description (even from ATS flows where the description lives on a different page than the application form) and logs the application as a row in your existing Notion tracker database.
- Everything lives in the browser's side panel — no separate settings tab to lose track of.

## Getting started

The extension source lives in [`extension/`](extension).

```bash
cd extension
npm install
npm run build
```

Then load `extension/.output/chrome-mv3` as an unpacked extension:

1. Open `chrome://extensions` (or `brave://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** and select `extension/.output/chrome-mv3`

Click the toolbar icon to open the side panel, fill in your profile under "Your profile," and you're set.

## Tech stack

[WXT](https://wxt.dev) + React + TypeScript, Manifest V3, Chrome side panel API.
