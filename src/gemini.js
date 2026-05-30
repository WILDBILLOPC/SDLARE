// Gemini 2.5 Flash Image ("Nano Banana") wrapper — generates a photorealistic
// avatar face from a text prompt (and optionally edits a reference image).
import { GoogleGenAI } from "@google/genai";
import { ServiceError } from "./heygen.js";

const IMAGE_MODEL = "gemini-2.5-flash-image";

let client = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new ServiceError(503, "GEMINI_API_KEY is not configured on the server.");
  }
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// Framing-specific guidance. "portrait" is tuned to be HeyGen-ready (front-facing
// head & shoulders, neutral background); "full" is a full-length fashion shot so
// styling details like a watch, shirt and shoes are visible.
const GUIDANCE = {
  portrait:
    "Photorealistic studio portrait, head and shoulders, facing the camera directly, " +
    "neutral relaxed expression, eyes open looking at the lens, soft even lighting, " +
    "plain light-grey seamless background, high detail, natural skin texture, " +
    "shot on an 85mm lens. Suitable as a talking-avatar source photo.",
  full:
    "Photorealistic full-length editorial fashion photograph, head to toe in frame, " +
    "subject standing and facing the camera, confident relaxed pose, sharp focus, " +
    "professional studio lighting on a clean seamless background, magazine-quality, " +
    "shot on a 50mm lens, ultra high detail, natural skin texture.",
};

// When reference photos are supplied, instruct the model to preserve identity.
const LIKENESS_GUIDANCE =
  "Keep the same face and identity as the reference photos provided " +
  "(same facial features, bone structure and likeness), restyled as described.";

export async function generateAvatarImage({ prompt, referenceImage, referenceImages, framing }) {
  if (!prompt || !prompt.trim()) throw new ServiceError(400, "A description prompt is required.");

  const ai = getClient();

  // Normalise references: accept a single `referenceImage` or an array.
  const refs = []
    .concat(referenceImages || [])
    .concat(referenceImage ? [referenceImage] : [])
    .filter((r) => r?.data && r?.mimeType)
    .slice(0, 8); // cap to keep the request reasonable

  const guidance = GUIDANCE[framing] || GUIDANCE.portrait;
  const fullPrompt =
    `${prompt.trim()}. ${guidance}` + (refs.length ? ` ${LIKENESS_GUIDANCE}` : "");

  const parts = [{ text: fullPrompt }];
  for (const ref of refs) {
    // ref.data is base64 (no data: prefix)
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
  }

  let response;
  try {
    response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts }],
    });
  } catch (err) {
    throw new ServiceError(502, "Gemini image generation failed.", { message: err?.message });
  }

  const candidate = response?.candidates?.[0];
  const outParts = candidate?.content?.parts || [];
  const imagePart = outParts.find((p) => p.inlineData?.data);
  if (!imagePart) {
    const text = outParts.find((p) => p.text)?.text;
    throw new ServiceError(502, "Gemini did not return an image.", { text });
  }

  return {
    mimeType: imagePart.inlineData.mimeType || "image/png",
    base64: imagePart.inlineData.data,
  };
}
