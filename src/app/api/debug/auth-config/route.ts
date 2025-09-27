import { NextResponse } from 'next/server';

export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const config = {
    env: {
      NODE_ENV: process.env.NODE_ENV,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ? '✓ Set' : '✗ Missing',
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || '✗ Missing',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '✗ Missing',
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing',
    },
    auth: {
      baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
      googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
    callbacks: {
      googleCallback: `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/api/auth/callback/google`,
    }
  };

  return NextResponse.json(config, { status: 200 });
}