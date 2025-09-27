import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json({
        success: false,
        error: 'Email, password, and name are required',
      }, { status: 400 });
    }

    // Test direct sign up
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
      headers: request.headers,
    });

    return NextResponse.json({
      success: !result.error,
      result: result.error ? { error: result.error } : { user: result.data?.user },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Debug signup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}