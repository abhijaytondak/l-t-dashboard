// Anthropic Claude vision provider. Reads ANTHROPIC_API_KEY / ANTHROPIC_MODEL.
// PDFs go in a `document` block; images in an `image` block (base64, no prefix).
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export async function extractText(
  base64: string,
  mediaType: string,
  isPdf: boolean,
  prompt: string,
): Promise<string> {
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

  const billBlock: Anthropic.Messages.ContentBlockParam = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType as ImageMediaType, data: base64 } };

  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    messages: [{ role: 'user', content: [billBlock, { type: 'text', text: prompt }] }],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}
