// OpenAI vision provider. Reads OPENAI_API_KEY / OPENAI_MODEL.
// Uses the Responses API, which accepts both images (input_image) and PDFs
// (input_file) as base64 data URLs.
import OpenAI from 'openai';

let client: OpenAI | null = null;

export async function extractText(
  base64: string,
  mediaType: string,
  isPdf: boolean,
  prompt: string,
): Promise<string> {
  client ??= new OpenAI(); // reads OPENAI_API_KEY from the environment
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o';

  const billPart = isPdf
    ? {
        type: 'input_file' as const,
        filename: 'bill.pdf',
        file_data: `data:application/pdf;base64,${base64}`,
      }
    : {
        type: 'input_image' as const,
        image_url: `data:${mediaType};base64,${base64}`,
        detail: 'auto' as const,
      };

  const response = await client.responses.create({
    model,
    max_output_tokens: 1500,
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text' as const, text: prompt }, billPart],
      },
    ],
  });

  return response.output_text ?? '';
}
