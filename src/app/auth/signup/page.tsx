import { SignUpForm } from '@/components/auth/signup-form';
import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';

export default async function SignUpPage() {
  // Check if user is already authenticated on the server side
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    
    if (session?.user) {
      redirect('/dashboard');
    }
  } catch (error) {
    // User is not authenticated, continue to show signup page
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Newsletter Platform</h1>
          <p className="mt-2 text-gray-600">Create your account</p>
        </div>
        
        <SignUpForm />
        
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/signin" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}