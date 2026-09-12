import type { APIRoute } from 'astro';
import { generateOtherSide } from '../../lib/anthropic';
import { addCase, listRecentCases, type CaseRecord } from '../../lib/store';

export const prerender = false;

function makeId(): string {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${now}${rand}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const yourSide = (body?.yourSide ?? '').toString().trim();

    if (!yourSide || yourSide.length < 20) {
      return new Response(
        JSON.stringify({ error: 'Tell us more — at least a few sentences about what happened.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (yourSide.length > 4000) {
      return new Response(
        JSON.stringify({ error: 'Keep it under 4000 characters — this is a docket entry, not a memoir.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const generated = await generateOtherSide(yourSide);

    const record: CaseRecord = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      yourSide,
      theirSide: generated.theirSide,
      category: generated.category,
      verdict: generated.verdict,
      votesYou: 0,
      votesThem: 0,
    };

    await addCase(record);

    return new Response(JSON.stringify({ id: record.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Something went wrong.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET: APIRoute = async () => {
  const cases = await listRecentCases(20);
  return new Response(JSON.stringify({ cases }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
