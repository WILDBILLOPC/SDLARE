// Shared DOM + fetch helpers.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function setStatus(el, text, state = "idle") {
  el.textContent = text;
  el.dataset.state = state;
}

let toastTimer;
export function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 6000);
}

export async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    const detail = data?.details ? ` — ${JSON.stringify(data.details).slice(0, 300)}` : "";
    throw new Error(msg + detail);
  }
  return data;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Read a File as { mimeType, data } where data is bare base64.
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // data:<mime>;base64,<data>
      const [meta, b64] = result.split(",");
      const mimeType = meta.match(/data:(.*?);/)?.[1] || file.type || "image/png";
      resolve({ mimeType, data: b64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
