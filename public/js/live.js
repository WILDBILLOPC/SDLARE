// Live Assistant — real-time photorealistic avatar via HeyGen LiveAvatar SDK.
import { LiveAvatarSession, SessionEvent, SessionState }
  from "https://esm.sh/@heygen/liveavatar-web-sdk@0.0.18";
import { $, setStatus, toast, api } from "./util.js";

let session = null;

const els = {
  video: $("#live-video"),
  overlay: $("#live-overlay"),
  quality: $("#live-quality"),
  avatarId: $("#live-avatar-id"),
  voiceChat: $("#live-voicechat"),
  start: $("#live-start"),
  stop: $("#live-stop"),
  text: $("#live-text"),
  speak: $("#live-speak"),
  interrupt: $("#live-interrupt"),
  status: $("#live-status"),
};

function setConnected(connected) {
  els.start.disabled = connected;
  els.stop.disabled = !connected;
  els.speak.disabled = !connected;
  els.interrupt.disabled = !connected;
  els.avatarId.disabled = connected;
  els.voiceChat.disabled = connected;
}

async function start() {
  if (session) return;
  setStatus(els.status, "Requesting session token…", "busy");
  setConnected(true);
  els.start.disabled = true;

  try {
    const body = {};
    if (els.avatarId.value.trim()) body.avatar_id = els.avatarId.value.trim();

    const { sessionToken } = await api("/api/live/token", {
      method: "POST",
      body: JSON.stringify(body),
    });

    session = new LiveAvatarSession(sessionToken, { voiceChat: els.voiceChat.checked });

    session.on(SessionEvent.SESSION_STREAM_READY, () => {
      session.attach(els.video);
      els.overlay.hidden = true;
      setStatus(els.status, "Connected — live", "ok");
    });

    session.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
      if (state === SessionState.CONNECTING) setStatus(els.status, "Connecting to avatar…", "busy");
    });

    session.on(SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED, (q) => {
      els.quality.hidden = false;
      els.quality.textContent = `Connection: ${q}`;
    });

    session.on(SessionEvent.SESSION_DISCONNECTED, () => teardown("Session ended."));

    setStatus(els.status, "Starting session…", "busy");
    await session.start();
  } catch (err) {
    toast(err.message);
    teardown("Failed to start.", "error");
  }
}

async function stop() {
  if (!session) return;
  try {
    await session.stop();
  } catch { /* ignore */ }
  teardown("Stopped.");
}

function teardown(msg, state = "idle") {
  session = null;
  els.video.srcObject = null;
  els.overlay.hidden = false;
  els.quality.hidden = true;
  setConnected(false);
  setStatus(els.status, msg, state);
}

function speak() {
  const text = els.text.value.trim();
  if (!text || !session) return;
  // repeat() = say this exact text. (session.message() would route through the
  // configured agent/LLM instead of speaking verbatim.)
  session.repeat(text);
  setStatus(els.status, "Speaking…", "ok");
}

function interrupt() {
  if (session) session.interrupt();
}

export function initLive(feature) {
  if (!feature) {
    setConnected(false);
    els.start.disabled = true;
    setStatus(els.status, "Live mode unavailable — set LIVEAVATAR_API_KEY.", "error");
    return;
  }
  els.start.addEventListener("click", start);
  els.stop.addEventListener("click", stop);
  els.speak.addEventListener("click", speak);
  els.interrupt.addEventListener("click", interrupt);
  window.addEventListener("beforeunload", () => session?.stop?.());
}
