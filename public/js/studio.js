// Avatar Studio — generate a photorealistic face with Gemini "Nano Banana".
import { $, setStatus, toast, api, fileToBase64 } from "./util.js";

// Ready-made prompts. Each sets the prompt text and the best framing.
const PRESETS = {
  valentino: {
    framing: "full",
    text:
      "A confident, athletic man, about 40 years old, with a full head of styled hair, " +
      "modeling as a Valentino 2026 campaign model. Wearing a high-fashion designer grey " +
      "ensemble styled like a Valentino 2026 runway look, with a black shirt and black shoes. " +
      "On his left wrist, a Rolex Cosmograph Daytona in white gold with a blue dial, clearly " +
      "visible. Editorial high-fashion full-length shot, confident pose.",
  },
  advisor: {
    framing: "portrait",
    text:
      "A warm, approachable San Diego lending and real estate advisor in their 40s, " +
      "professional business-casual blazer, confident friendly smile, trustworthy.",
  },
};

const els = {
  prompt: $("#studio-prompt"),
  presets: $("#studio-presets"),
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
  els.presets.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preset]");
    if (!btn) return;
    const preset = PRESETS[btn.dataset.preset];
    if (!preset) return;
    els.prompt.value = preset.text;
    els.framing.value = preset.framing;
  });
  els.ref.addEventListener("change", () => {
    const n = els.ref.files?.length || 0;
    els.refCount.textContent = n ? `${n} reference photo${n > 1 ? "s" : ""} selected` : "";
  });
}
