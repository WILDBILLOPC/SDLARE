// Spokesperson — photorealistic scripted video via HeyGen video generation.
import { $, setStatus, toast, api, sleep } from "./util.js";

const els = {
  avatar: $("#spk-avatar"),
  voice: $("#spk-voice"),
  script: $("#spk-script"),
  speed: $("#spk-speed"),
  speedOut: $("#spk-speed-out"),
  generate: $("#spk-generate"),
  status: $("#spk-status"),
  video: $("#spk-video"),
  overlay: $("#spk-overlay"),
  spinner: $("#spk-spinner"),
  progress: $("#spk-progress"),
  downloadRow: $("#spk-download-row"),
  download: $("#spk-download"),
};

let avatarIndex = new Map(); // id -> { type }

async function loadPickers(defaults) {
  try {
    const [{ avatars, talkingPhotos }, { voices }] = await Promise.all([
      api("/api/heygen/avatars"),
      api("/api/heygen/voices"),
    ]);

    els.avatar.innerHTML = "";
    const addOpt = (sel, id, label, type) => {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = label;
      o.dataset.type = type;
      sel.appendChild(o);
      avatarIndex.set(id, { type });
    };

    if (avatars.length) {
      const g = document.createElement("optgroup");
      g.label = "Avatars";
      els.avatar.appendChild(g);
      avatars.forEach((a) => addOpt(g, a.id, a.name || a.id, "avatar"));
    }
    if (talkingPhotos.length) {
      const g = document.createElement("optgroup");
      g.label = "Photo Avatars (your uploads)";
      els.avatar.appendChild(g);
      talkingPhotos.forEach((p) => addOpt(g, p.id, p.name || p.id, "talking_photo"));
    }
    if (!els.avatar.options.length) {
      els.avatar.innerHTML = '<option value="">No avatars found</option>';
    }

    els.voice.innerHTML = "";
    voices.slice(0, 400).forEach((v) => {
      const o = document.createElement("option");
      o.value = v.id;
      o.textContent = `${v.name}${v.language ? ` · ${v.language}` : ""}`;
      els.voice.appendChild(o);
    });

    if (defaults.avatarId) els.avatar.value = defaults.avatarId;
    if (defaults.voiceId) els.voice.value = defaults.voiceId;
  } catch (err) {
    els.avatar.innerHTML = '<option value="">Failed to load</option>';
    els.voice.innerHTML = '<option value="">Failed to load</option>';
    toast(`Could not load avatars/voices: ${err.message}`);
  }
}

async function generate() {
  const script = els.script.value.trim();
  const avatarId = els.avatar.value;
  const voiceId = els.voice.value;
  if (!script) return toast("Please write a script.");
  if (!avatarId) return toast("Please pick a presenter.");
  if (!voiceId) return toast("Please pick a voice.");

  els.generate.disabled = true;
  els.downloadRow.hidden = true;
  els.video.removeAttribute("src");
  els.overlay.hidden = true;
  els.spinner.hidden = false;
  els.progress.textContent = "Submitting…";
  setStatus(els.status, "Submitting render…", "busy");

  try {
    const { videoId } = await api("/api/video/generate", {
      method: "POST",
      body: JSON.stringify({
        script,
        avatarId,
        voiceId,
        characterType: avatarIndex.get(avatarId)?.type || "avatar",
        speed: parseFloat(els.speed.value),
      }),
    });

    setStatus(els.status, "Rendering — this can take a minute…", "busy");
    const url = await poll(videoId);

    els.spinner.hidden = true;
    els.video.src = url;
    els.video.load();
    els.download.href = url;
    els.downloadRow.hidden = false;
    setStatus(els.status, "Done.", "ok");
  } catch (err) {
    els.spinner.hidden = true;
    els.overlay.hidden = false;
    toast(err.message);
    setStatus(els.status, "Failed.", "error");
  } finally {
    els.generate.disabled = false;
  }
}

async function poll(videoId) {
  const started = Date.now();
  const timeoutMs = 8 * 60 * 1000;
  let attempt = 0;
  while (Date.now() - started < timeoutMs) {
    const { status, videoUrl, error } = await api(`/api/video/status/${videoId}`);
    const secs = Math.round((Date.now() - started) / 1000);
    els.progress.textContent = `${status || "processing"}… ${secs}s`;
    if (status === "completed" && videoUrl) return videoUrl;
    if (status === "failed") throw new Error(error?.message || error || "HeyGen reported the render failed.");
    await sleep(Math.min(3000 + attempt++ * 500, 6000));
  }
  throw new Error("Timed out waiting for the video to render.");
}

export function initSpokesperson(feature, defaults) {
  els.speed.addEventListener("input", () => (els.speedOut.textContent = `${parseFloat(els.speed.value).toFixed(1)}×`));
  if (!feature) {
    els.generate.disabled = true;
    els.avatar.innerHTML = '<option>HeyGen key not set</option>';
    els.voice.innerHTML = '<option>HeyGen key not set</option>';
    setStatus(els.status, "Set HEYGEN_API_KEY to enable video generation.", "error");
    return;
  }
  els.generate.addEventListener("click", generate);
  loadPickers(defaults);
}
