import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';

export async function GET(request: NextRequest) {
  try {
    // Test session retrieval
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    return NextResponse.json({
      success: true,
      session: session ? {
        user: session.user,
        sessionId: session.session?.id,
      } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Debug auth error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password are required',
      }, { status: 400 });
    }

    // Test direct sign in
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: request.headers,
    });

    return NextResponse.json({
      success: !result.error,
      result: result.error ? { error: result.error } : { user: result.data?.user },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Debug signin error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}