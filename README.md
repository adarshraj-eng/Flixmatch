# FlickMatch

A two-player movie and TV show matchmaker. Set your mood, swipe through AI-curated picks, and find something you both actually want to watch — with exact Indian OTT availability.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:
| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | supabase.com → your project → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Same page (anon/public key) |
| `VITE_TMDB_READ_ACCESS_TOKEN` | themoviedb.org → Settings → API (the long token) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `RAPIDAPI_KEY` | rapidapi.com → your app header (X-RapidAPI-Key) |

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → **New Query**
3. Paste the contents of `supabase/schema.sql` and click **Run**

### 4. Run the app

```bash
npm run dev
```

This starts both the React frontend (port 5173) and the Express API server (port 3001) concurrently.

Open [http://localhost:5173](http://localhost:5173) in your browser.

## How it works

1. **Partner A** opens the app and clicks "Start a New Session"
2. A QR code and shareable link are generated
3. **Partner B** scans the QR or opens the link on their device
4. Both fill in preferences **independently** (mood, language, content type, rating, era)
5. Claude analyzes both preference sets and generates a tailored search brief
6. TMDB returns 30 curated titles; each partner sees them in a different random order
7. Both swipe — right to like, left to pass
8. The moment both partners like the same title, both screens show the match simultaneously
9. The match screen shows full details + which Indian OTT platforms it's on right now
10. If no match after round 1, Claude refines recommendations based on actual swipe patterns for round 2
11. If still no match after round 2, the top 5 combined-score titles are shown

## Project structure

```
flickmatch/
├── src/
│   ├── components/       # UI components (SwipeCard, QRShare, MatchReveal, ...)
│   ├── pages/            # Route-level pages
│   ├── lib/              # API clients (Supabase, TMDB, backend proxy)
│   └── index.css         # All styles
├── server/
│   └── index.js          # Express server (Claude + OTT API, keeps keys server-side)
├── supabase/
│   └── schema.sql        # Database schema to run in Supabase SQL Editor
├── .env.example          # Environment variable template
└── vite.config.js        # Vite config (proxies /api to Express in dev)
```

## Deployment

Build the frontend:
```bash
npm run build
```

Then run `npm start` (sets `NODE_ENV=production`). The Express server will serve the built React files and handle all API routes.

### Environment variables in production

Set the same variables from `.env` in your hosting platform's environment settings. For `ALLOWED_ORIGIN`, set your deployed frontend URL.
