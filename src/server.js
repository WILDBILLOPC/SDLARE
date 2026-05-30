import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ServiceError,
  createLiveAvatarToken,
  generateVideo,
  getVideoStatus,
  listAvatars,
  listVoices,
} from "./heygen.js";
import { generateAvatarImage } from "./gemini.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// Small helper so async route handlers funnel errors into one place.
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => sendError(res, err));

function sendError(res, err) {
  if (err instanceof ServiceError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  console.error("Unexpected error:", err);
  return res.status(500).json({ error: "Internal server error." });
}

// Tells the frontend which capabilities are wired up, so it can enable/disable
// tabs gracefully instead of throwing opaque errors.
app.get("/api/config", (req, res) => {
  res.json({
    features: {
      liveAvatar: Boolean(process.env.LIVEAVATAR_API_KEY || process.env.HEYGEN_API_KEY),
      videoGeneration: Boolean(process.env.HEYGEN_API_KEY),
      avatarStudio: Boolean(process.env.GEMINI_API_KEY),
    },
    defaults: {
      avatarId: process.env.DEFAULT_AVATAR_ID || "",
      voiceId: process.env.DEFAULT_VOICE_ID || "",
    },
  });
});

// ─── Live Assistant (LiveAvatar real-time streaming) ───────────────────────────
app.post("/api/live/token", wrap(async (req, res) => {
  const token = await createLiveAvatarToken(req.body || {});
  res.json({ sessionToken: token });
}));

// ─── Spokesperson (photorealistic scripted video) ─────────────────────────────
app.post("/api/video/generate", wrap(async (req, res) => {
  const result = await generateVideo(req.body || {});
  res.json(result);
}));

app.get("/api/video/status/:id", wrap(async (req, res) => {
  res.json(await getVideoStatus(req.params.id));
}));

// ─── Pickers ───────────────────────────────────────────────────────────────────
app.get("/api/heygen/avatars", wrap(async (req, res) => res.json(await listAvatars())));
app.get("/api/heygen/voices", wrap(async (req, res) => res.json({ voices: await listVoices() })));

// ─── Avatar Studio (Gemini Nano Banana face generation) ────────────────────────
app.post("/api/studio/generate", wrap(async (req, res) => {
  const { prompt, referenceImage, referenceImages, framing } = req.body || {};
  const image = await generateAvatarImage({ prompt, referenceImage, referenceImages, framing });
  res.json({ dataUrl: `data:${image.mimeType};base64,${image.base64}` });
}));

app.listen(PORT, () => {
  // Keys are read from the environment — either via a .env file or exported
  // directly in your shell (export GEMINI_API_KEY=... etc). This readout shows
  // what was picked up so you immediately know which tabs will be active.
  const on = (v) => (v ? "✓ enabled" : "✗ off (key missing)");
  console.log(`\n  SDLARE Avatar running → http://localhost:${PORT}\n`);
  console.log(`  Live Assistant      ${on(process.env.LIVEAVATAR_API_KEY || process.env.HEYGEN_API_KEY)}`);
  console.log(`  Spokesperson Video  ${on(process.env.HEYGEN_API_KEY)}`);
  console.log(`  Avatar Studio       ${on(process.env.GEMINI_API_KEY)}\n`);
});
