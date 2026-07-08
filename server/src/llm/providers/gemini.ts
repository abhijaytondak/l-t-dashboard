// Google Gemini vision provider. Reads GEMINI_API_KEY / GEMINI_MODEL.
import { GoogleGenAI } from '@google/genai';

let ai: GoogleGenAI | null = null;

export async function extractText(
  base64: string,
  mediaType: string,
  isPdf: boolean,
  prompt: string,
): Promise<string> {
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const mimeType = isPdf ? 'application/pdf' : mediaType;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }],
      },
    ],
    config: {
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      // gemini-2.5-flash is a thinking model; extraction needs no thinking.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  return response.text ?? '';
}
