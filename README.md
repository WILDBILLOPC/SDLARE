# SDLARE
San Diego Lending and Real Estate — Operations Platform

## Realistic Talking Avatar

A photorealistic talking-avatar app for the SDLARE platform, built around three
capabilities. Each tab activates only when its API key is configured, so you can
start with one provider and add the others later.

| Tab | What it does | Powered by |
| --- | --- | --- |
| **Live Assistant** | Real-time, interactive avatar that speaks typed text instantly, with optional two-way voice chat. Low latency, customer-facing. | HeyGen **LiveAvatar** (`@heygen/liveavatar-web-sdk`) |
| **Spokesperson Video** | Renders a fully photorealistic talking-avatar video from a written script — welcome messages, explainers, announcements. | HeyGen **video generation** (`/v2/video/generate`) |
| **Avatar Studio** | Generates a photorealistic portrait/full-length image of a person (optionally from your reference photos) to use as a custom avatar. | Google **Gemini 2.5 Flash Image** ("Nano Banana") |

The recommended end-to-end flow: **Avatar Studio** → generate a face → upload it
to HeyGen as a *Photo Avatar* → use that avatar in the **Live Assistant** and
**Spokesperson** tabs.

### Architecture

- **Backend** (`src/`) — a small Express server that proxies all provider calls
  so API keys live only on the server, never in the browser. It also exposes
  `/api/config` so the frontend can enable/disable tabs based on which keys are set.
- **Frontend** (`public/`) — a no-build static app. The LiveAvatar SDK is loaded
  directly from `esm.sh`, so there's no bundler step.

```
src/
  server.js        Express app + routes
  heygen.js        HeyGen REST + LiveAvatar token wrapper
  gemini.js        Gemini Nano Banana image generation
public/
  index.html       3-tab UI
  css/styles.css
  js/app.js        tab wiring + config
  js/live.js       LiveAvatar real-time session
  js/spokesperson.js  scripted video generation + polling
  js/studio.js     Gemini face generation
  js/util.js       shared helpers
```

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env template and add your keys:
   ```bash
   cp .env.example .env
   ```
   Fill in any of:
   - `HEYGEN_API_KEY` — from <https://app.heygen.com/settings?nav=API> (enables Spokesperson Video + avatar/voice lists)
   - `LIVEAVATAR_API_KEY` — LiveAvatar key for the real-time assistant (falls back to `HEYGEN_API_KEY` if unset)
   - `GEMINI_API_KEY` — from <https://aistudio.google.com/apikey> (enables Avatar Studio)
3. Run it:
   ```bash
   npm start          # or: npm run dev  (auto-reload)
   ```
4. Open <http://localhost:3000>.

### API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/config` | Which features are enabled + UI defaults |
| `POST` | `/api/live/token` | Mint a single-use LiveAvatar session token |
| `POST` | `/api/video/generate` | Start a scripted video render → `{ videoId }` |
| `GET` | `/api/video/status/:id` | Poll render status / get the video URL |
| `GET` | `/api/heygen/avatars` | List avatars + your photo avatars |
| `GET` | `/api/heygen/voices` | List voices |
| `POST` | `/api/studio/generate` | Generate an avatar image with Gemini |

### Notes

- **Avatar Studio** accepts multiple reference photos and a *Portrait* vs
  *Full length* framing toggle. Use several references of the same person for the
  best likeness; use *Full length* when you want outfit/watch/shoe styling visible.
- Keys are never exposed to the browser — the frontend only ever receives a
  short-lived LiveAvatar session token.
- HeyGen's older `@heygen/streaming-avatar` SDK is deprecated; this app uses the
  current `@heygen/liveavatar-web-sdk`.
