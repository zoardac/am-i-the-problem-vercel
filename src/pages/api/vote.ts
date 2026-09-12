import type { APIRoute } from 'astro';
import { castVote } from '../../lib/store';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const id = (body?.id ?? '').toString();
    const side = body?.side === 'them' ? 'them' : body?.side === 'you' ? 'you' : null;

    if (!id || !side) {
      return new Response(JSON.stringify({ error: 'Missing case id or side.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const record = await castVote(id, side);
    if (!record) {
      return new Response(JSON.stringify({ error: 'Case not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ votesYou: record.votesYou, votesThem: record.votesThem }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Something went wrong.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
