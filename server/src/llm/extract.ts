// Provider-agnostic extraction dispatcher.
//
// The whole pipeline downstream consumes a plain `Extraction` JSON object and
// has no idea which model produced it. This file is the ONLY provider-aware
// seam: it reads LLM_PROVIDER from the environment and delegates the actual
// vision call to one of the provider modules, then runs the shared JSON parse +
// logging. Keys are read on the server only and never sent to the client.
//
//   LLM_PROVIDER=gemini    (default) → GEMINI_API_KEY,    GEMINI_MODEL
//   LLM_PROVIDER=anthropic           → ANTHROPIC_API_KEY, ANTHROPIC_MODEL
//   LLM_PROVIDER=openai              → OPENAI_API_KEY,     OPENAI_MODEL

import { EXTRACTION_PROMPT } from '../extraction-prompt.ts';
import type { Extraction } from '../engine.ts';

export type Provider = 'gemini' | 'anthropic' | 'openai';

export function activeProvider(): Provider {
  const p = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();
  return p === 'anthropic' || p === 'openai' ? p : 'gemini';
}

// Inline-image MIME types each provider accepts (PDFs are handled separately).
const IMAGE_SUPPORT: Record<Provider, Set<string>> = {
  gemini: new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']),
  anthropic: new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  openai: new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
};

export function isSupportedImageType(mediaType: string): boolean {
  return IMAGE_SUPPORT[activeProvider()].has(mediaType);
}

/** Strip ```json / ``` fences and parse the model's reply into an Extraction. */
function parseExtraction(text: string): Extraction {
  let t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) t = fenced[1]!.trim();
  try {
    return JSON.parse(t) as Extraction;
  } catch {
    // Fall back to the outermost { … } span if the model added stray prose.
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(t.slice(start, end + 1)) as Extraction;
    }
    throw new Error('Model reply did not contain valid JSON.');
  }
}

export async function extractBill(
  base64: string,
  mediaType: string,
  isPdf: boolean,
): Promise<Extraction> {
  const provider = activeProvider();

  // Dynamic import so only the selected provider's SDK is loaded and only its
  // client is constructed — you don't need the other providers' keys installed.
  let raw: string;
  if (provider === 'anthropic') {
    const m = await import('./providers/anthropic.ts');
    raw = await m.extractText(base64, mediaType, isPdf, EXTRACTION_PROMPT);
  } else if (provider === 'openai') {
    const m = await import('./providers/openai.ts');
    raw = await m.extractText(base64, mediaType, isPdf, EXTRACTION_PROMPT);
  } else {
    const m = await import('./providers/gemini.ts');
    raw = await m.extractText(base64, mediaType, isPdf, EXTRACTION_PROMPT);
  }

  const text = (raw ?? '').trim();
  if (!text) {
    throw new Error('Model returned no text. Check the API key, model, and that the file is a readable bill.');
  }

  const extraction = parseExtraction(text);

  // Raw extraction log (set LOG_EXTRACTION=false in .env to silence).
  if (process.env.LOG_EXTRACTION !== 'false') {
    console.log(`[extract] ${provider} read ${isPdf ? 'PDF' : mediaType} → extraction:`);
    console.log(JSON.stringify(extraction, null, 2));
  }

  return extraction;
}
