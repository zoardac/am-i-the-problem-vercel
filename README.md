# The Docket — "Am I the Problem?"

Anonymous conflict-resolution site: paste in your side of a fight, an AI reconstructs
the other person's side in good faith, and the internet votes on who's actually the
problem. Every case gets a downloadable "verdict card" for sharing.

## Stack

- [Astro](https://astro.build) with the **Vercel adapter** (SSR, so API routes work when deployed)
- Tailwind CSS v4
- Anthropic API (Claude) for generating the reconstructed "other side"
- A flat JSON file as the datastore — see the **Storage on Vercel** warning below

## Local setup

```bash
npm install
cp .env.example .env
# then edit .env and add your real Anthropic API key
npm run dev
```

Visit `http://localhost:4321`.

## Deploying to Vercel

```bash
npm i -g vercel   # if you don't have the CLI
vercel
```

Or push this to a GitHub repo and import it in the Vercel dashboard — it auto-detects
Astro. Either way, set the `ANTHROPIC_API_KEY` environment variable in the Vercel
project settings (Settings → Environment Variables) before it will generate cases.

### ⚠️ Storage on Vercel — read this before you rely on it

This project stores cases in a JSON file on disk (`src/lib/store.ts`). That's fine
for local dev. **On Vercel it will not reliably persist**: serverless functions get
a read-only filesystem except `/tmp`, `/tmp` doesn't survive between invocations
for long, and separate instances don't share it at all. In practice, on Vercel this
means: a case you just created might not be visible from the next request, and the
"recently filed" list will be inconsistent or empty.

The code path already checks `process.env.VERCEL` and writes to `/tmp` there
instead of failing outright, so the site *works* for a quick demo — submissions and
votes just won't reliably stick around. Before using this for anything real, swap
`src/lib/store.ts` for an actual persistence layer: [Vercel KV](https://vercel.com/docs/storage/vercel-kv),
[Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres), Turso, or
similar — all have generous free tiers and drop-in Vercel integrations.

## How it works

1. `src/pages/index.astro` — landing page + submission form
2. `POST /api/cases` (`src/pages/api/cases.ts`) — takes the submitted story, calls
   Claude via `src/lib/anthropic.ts` to generate the other side, a category, and a
   one-line verdict, then saves it via `src/lib/store.ts`
3. `src/pages/case/[id].astro` — shows both sides side by side, lets people vote
   (one vote per browser via `localStorage`), and renders a downloadable verdict
   card using an HTML `<canvas>`
4. `POST /api/vote` — records votes

## Before you launch this for real

- **Moderation**: right now anything submitted gets processed and posted. Add a
  profanity/abuse filter and a report button before this goes public.
- **Datastore**: see the Vercel storage warning above — this is the first thing
  to fix before real traffic.
- **Rate limiting**: add IP-based rate limiting on `/api/cases` — API calls to
  Claude cost money per submission.
- **Vote integrity**: votes are deduped per-browser via `localStorage` only, which
  is trivial to bypass. Fine for a fun viral launch, not for anything you need to
  be tamper-proof.

## Design

"Case file" aesthetic: manila/paper palette, ink navy + stamp red, Courier Prime for
system text, Source Serif 4 for the actual stories. One animated moment (the verdict
stamp slams down on page load) — everything else is static and quiet.
# am-i-the-problem-vercel
