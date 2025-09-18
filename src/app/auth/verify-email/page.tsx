import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';
import Link from 'next/link';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We've sent a verification link to your email address. Please click the link to verify your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            Didn't receive the email? Check your spam folder or{' '}
            <Link href="/auth/signin" className="font-medium text-blue-600 hover:text-blue-500">
              try signing in again
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}