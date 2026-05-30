// Thin wrapper around the HeyGen REST API + the LiveAvatar session-token API.
// All calls are made server-side so the API keys never reach the browser.

const HEYGEN_BASE = "https://api.heygen.com";
const LIVEAVATAR_BASE = "https://api.liveavatar.com";

function heygenKey() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new ServiceError(503, "HEYGEN_API_KEY is not configured on the server.");
  return key;
}

function liveAvatarKey() {
  // Fall back to the standard HeyGen key if a dedicated LiveAvatar key isn't set.
  const key = process.env.LIVEAVATAR_API_KEY || process.env.HEYGEN_API_KEY;
  if (!key) throw new ServiceError(503, "LIVEAVATAR_API_KEY (or HEYGEN_API_KEY) is not configured on the server.");
  return key;
}

export class ServiceError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function parseJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

// ─── LiveAvatar: mint a short-lived session token for the browser SDK ──────────
// The browser never sees the API key — only this single-use session token.
export async function createLiveAvatarToken(body = {}) {
  const payload = { ...body };
  if (!payload.avatar_id && process.env.LIVEAVATAR_AVATAR_ID) {
    payload.avatar_id = process.env.LIVEAVATAR_AVATAR_ID;
  }

  const res = await fetch(`${LIVEAVATAR_BASE}/v1/sessions/token`, {
    method: "POST",
    headers: {
      "X-API-KEY": liveAvatarKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJson(res);
  if (!res.ok) {
    throw new ServiceError(res.status, "Failed to create LiveAvatar session token.", data);
  }
  // The token can come back under a few shapes depending on API version.
  const token =
    data?.data?.token ||
    data?.data?.session_token ||
    data?.token ||
    data?.session_token;
  if (!token) {
    throw new ServiceError(502, "LiveAvatar token endpoint returned no token.", data);
  }
  return token;
}

// ─── Video generation (photorealistic, scripted) ──────────────────────────────
export async function generateVideo({ script, avatarId, voiceId, characterType, background, dimension, speed }) {
  if (!script || !script.trim()) throw new ServiceError(400, "A script is required.");
  if (!avatarId) throw new ServiceError(400, "An avatar id is required.");
  if (!voiceId) throw new ServiceError(400, "A voice id is required.");

  const character =
    characterType === "talking_photo"
      ? { type: "talking_photo", talking_photo_id: avatarId }
      : { type: "avatar", avatar_id: avatarId, avatar_style: "normal" };

  const videoInput = {
    character,
    voice: {
      type: "text",
      input_text: script,
      voice_id: voiceId,
      speed: typeof speed === "number" ? speed : 1.0,
    },
    background: background || { type: "color", value: "#f4f5f7" },
  };

  const res = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
    method: "POST",
    headers: {
      "X-Api-Key": heygenKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      video_inputs: [videoInput],
      dimension: dimension || { width: 1280, height: 720 },
    }),
  });

  const data = await parseJson(res);
  if (!res.ok || data?.error) {
    throw new ServiceError(res.status === 200 ? 502 : res.status, "Video generation request failed.", data);
  }
  const videoId = data?.data?.video_id || data?.video_id;
  if (!videoId) throw new ServiceError(502, "HeyGen returned no video_id.", data);
  return { videoId };
}

export async function getVideoStatus(videoId) {
  if (!videoId) throw new ServiceError(400, "videoId is required.");
  const res = await fetch(`${HEYGEN_BASE}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`, {
    headers: { "X-Api-Key": heygenKey() },
  });
  const data = await parseJson(res);
  if (!res.ok) throw new ServiceError(res.status, "Failed to fetch video status.", data);
  const d = data?.data || {};
  return {
    status: d.status, // pending | processing | completed | failed
    videoUrl: d.video_url || null,
    thumbnailUrl: d.thumbnail_url || null,
    error: d.error || null,
  };
}

// ─── Listing helpers (populate the UI pickers) ─────────────────────────────────
export async function listAvatars() {
  const res = await fetch(`${HEYGEN_BASE}/v2/avatars`, { headers: { "X-Api-Key": heygenKey() } });
  const data = await parseJson(res);
  if (!res.ok) throw new ServiceError(res.status, "Failed to list avatars.", data);
  const avatars = (data?.data?.avatars || []).map((a) => ({
    id: a.avatar_id,
    name: a.avatar_name,
    preview: a.preview_image_url,
    gender: a.gender,
    type: "avatar",
  }));
  const talkingPhotos = (data?.data?.talking_photos || []).map((p) => ({
    id: p.talking_photo_id,
    name: p.talking_photo_name,
    preview: p.preview_image_url,
    type: "talking_photo",
  }));
  return { avatars, talkingPhotos };
}

export async function listVoices() {
  const res = await fetch(`${HEYGEN_BASE}/v2/voices`, { headers: { "X-Api-Key": heygenKey() } });
  const data = await parseJson(res);
  if (!res.ok) throw new ServiceError(res.status, "Failed to list voices.", data);
  return (data?.data?.voices || []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    language: v.language,
    gender: v.gender,
    preview: v.preview_audio,
  }));
}
