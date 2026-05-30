// Avatar Studio — generate a photorealistic face with Gemini "Nano Banana".
import { $, setStatus, toast, api, fileToBase64 } from "./util.js";

const els = {
  prompt: $("#studio-prompt"),
  ref: $("#studio-ref"),
  refCount: $("#studio-ref-count"),
  framing: $("#studio-framing"),
  generate: $("#studio-generate"),
  status: $("#studio-status"),
  img: $("#studio-img"),
  overlay: $("#studio-overlay"),
  spinner: $("#studio-spinner"),
  downloadRow: $("#studio-download-row"),
  download: $("#studio-download"),
};

async function generate() {
  const prompt = els.prompt.value.trim();
  if (!prompt) return toast("Describe the person you want to generate.");

  els.generate.disabled = true;
  els.downloadRow.hidden = true;
  els.img.hidden = true;
  els.overlay.hidden = true;
  els.spinner.hidden = false;
  setStatus(els.status, "Generating portrait…", "busy");

  try {
    const body = { prompt, framing: els.framing.value };
    const files = [...(els.ref.files || [])].slice(0, 8);
    if (files.length) {
      body.referenceImages = await Promise.all(files.map(fileToBase64));
    }

    const { dataUrl } = await api("/api/studio/generate", {
      method: "POST",
      body: JSON.stringify(body),
    });

    els.img.src = dataUrl;
    els.img.hidden = false;
    els.download.href = dataUrl;
    els.downloadRow.hidden = false;
    setStatus(els.status, "Done. Download and upload to HeyGen as a Photo Avatar.", "ok");
  } catch (err) {
    els.overlay.hidden = false;
    toast(err.message);
    setStatus(els.status, "Failed.", "error");
  } finally {
    els.spinner.hidden = true;
    els.generate.disabled = false;
  }
}

export function initStudio(feature) {
  if (!feature) {
    els.generate.disabled = true;
    setStatus(els.status, "Set GEMINI_API_KEY to enable the Avatar Studio.", "error");
    return;
  }
  els.generate.addEventListener("click", generate);
  els.ref.addEventListener("change", () => {
    const n = els.ref.files?.length || 0;
    els.refCount.textContent = n ? `${n} reference photo${n > 1 ? "s" : ""} selected` : "";
  });
}
