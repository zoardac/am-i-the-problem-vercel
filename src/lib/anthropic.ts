const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

interface GeneratedCase {
  theirSide: string;
  category: string;
  verdict: string;
}

const SYSTEM_PROMPT = `You are "The Docket" — an impartial case-file reconstructor for an anonymous conflict-resolution website.

Given one person's account of a dispute (roommate, partner, coworker, family, friend), you produce:
1. A good-faith reconstruction of what the OTHER person in the story would plausibly say, based only on details in the original account. Do not invent facts that contradict what was written. Find the most reasonable, sympathetic version of their perspective. Write it in first person, as if the other person is speaking. 120-220 words.
2. A short category label (2-4 words, e.g. "Roommate / Chores", "Partner / Money", "Family / Boundaries").
3. A one-line, deadpan "verdict" in the style of a court stamp — punchy, funny, at most 6 words (e.g. "CASE DISMISSED", "GUILTY, BUT UNDERSTANDABLE", "BOTH PARTIES AT FAULT", "JURY IS STILL OUT").

Respond ONLY with a JSON object, no markdown fences, no preamble:
{"theirSide": "...", "category": "...", "verdict": "..."}`;

export async function generateOtherSide(yourSide: string): Promise<GeneratedCase> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing ANTHROPIC_API_KEY. Add it to a .env file at the project root (see .env.example).'
    );
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: yourSide }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((block: any) => block.type === 'text');
  if (!textBlock?.text) {
    throw new Error('No text content returned from Anthropic API.');
  }

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned) as GeneratedCase;
  } catch {
    throw new Error('Failed to parse model response as JSON: ' + cleaned.slice(0, 200));
  }
}
