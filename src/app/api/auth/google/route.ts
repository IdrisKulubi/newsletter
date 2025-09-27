import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/config';

export async function GET(req: NextRequest) {
  try {
    const { searchParams, origin } = new URL(req.url);
    const callbackParam = searchParams.get('callbackURL') || '/dashboard';
    const callbackURL = new URL(callbackParam, origin).toString();

    const result = await auth.api.signInSocial({
      body: {
        provider: 'google',
        callbackURL,
      },
      headers: req.headers,
    });

    if (result?.data?.url) {
      return Response.redirect(result.data.url, 302);
    }

    return new Response(
      JSON.stringify({ error: result?.error?.message || 'Failed to initiate Google sign in', details: result }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Unexpected error initiating Google sign in', details: err?.message || String(err) }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
