# TrustPath

TrustPath is a renter-controlled application-readiness copilot. It helps renters turn supporting documents into a transparent, editable packet without making eligibility decisions, scores, rankings, approvals, or protected-trait inferences.

The product flow is intentionally guided:

1. Upload or load a synthetic renter document.
2. Review extracted fields with evidence quotes and confidence levels.
3. Correct fields and see downstream calculations update.
4. Ask a narrow rules question and receive a cited answer.
5. Review missing or expired packet items.
6. Export a local renter packet.
7. Delete the local session when finished.

## Demo

Production: https://trust-path-copilot.vercel.app/

## Tech Stack

- Frontend: vanilla HTML, CSS, and JavaScript
- Local runtime: Node.js HTTP server
- Production hosting: Vercel static hosting plus Vercel Serverless Functions
- AI API: OpenAI Responses API, called server-side only
- State: in-browser session state, no database
- Export: browser-generated JSON packet download

## Architecture

```text
public/
  index.html              Static app shell
  assets/app.js           Frontend workflow, state, mock data, calculations, export, guardrails
  assets/styles.css       Product UI and motion
api/
  extract.js              Serverless document extraction endpoint
  rules.js                Serverless rules explanation endpoint
local-server.js           Local development server and local API implementation
vercel.json               Production deployment configuration
package.json              Dev, build, and check scripts
```

The frontend is a single-page hash-routed workspace with three steps: Build Your Trust Profile, Understand the Rules, and Prepare Your Packet. Most demo behavior is available with mock data so the app remains reliable during presentation.

In production, `/api/extract` and `/api/rules` run as Vercel Serverless Functions. If `OPENAI_API_KEY` is configured, those endpoints call OpenAI server-side. If the API is unavailable or no readable text is provided, the app falls back to deterministic mock data.

## Safety and Guardrails

TrustPath is designed around renter control and conservative AI behavior:

- Uploaded document text is treated as untrusted input.
- The app does not approve, deny, score, rank, compare renters, or infer protected traits.
- Refusal logic exists in both frontend mock behavior and serverless API routes.
- Session data stays in browser memory unless the user exports a packet.
- Packet calculations are deterministic JavaScript calculations, not model judgments.

## Local Development

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:4173/index.html
```

Run checks:

```bash
npm run check
```

Run the Vercel build command locally:

```bash
npm run build
```

## Environment Variables

Create `.env.local` for local development:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-5
```

For Vercel, set the same variables in the Vercel project settings. The key is never exposed to the browser; OpenAI calls are made only from the local Node server or Vercel Serverless Functions.

## Deployment

The production app is deployed on Vercel. Static files are served from `public/`, and serverless API routes are served from `api/`.

`vercel.json` configures:

- `outputDirectory: public`
- root redirect from `/` to `/index.html`
- build command: `npm run build`

## What to Show in a Technical Demo

For a short technical walkthrough, open these files:

1. `public/assets/app.js` - frontend workflow, state, calculations, export, and guardrails
2. `api/rules.js` - cited rules answer endpoint and refusal behavior
3. `api/extract.js` - extraction endpoint and mock fallback
4. `vercel.json` - deployment configuration

## Status

TrustPath is a hackathon MVP focused on a polished frontend-first demo experience. It uses mock data where appropriate while supporting real server-side OpenAI calls when configured.
