'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signInAction } from '@/lib/actions/auth/signin';
import { signIn } from '@/lib/auth/client';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Signing in...' : 'Sign In'}
    </Button>
  );
}

function GoogleSignInButton() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleGoogleSignIn = async () => {
    setIsPending(true);
    setError(null);
    
    try {
      // Preferred: use BetterAuth client to initiate social sign-in
      await signIn.social({ provider: 'google', callbackURL: '/dashboard' });
    } catch (err) {
      // Fallback: use server endpoint to initiate OAuth if client call fails
      try {
        window.location.assign('/api/auth/google?callbackURL=/dashboard');
      } catch (err2) {
        console.error('Google sign in error:', err2);
        setError('Failed to sign in with Google. Please try again.');
        setIsPending(false);
      }
    }
  };
  
  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button 
        type="button" 
        variant="outline" 
        className="w-full" 
        onClick={handleGoogleSignIn}
        disabled={isPending}
      >
        {isPending ? 'Connecting to Google...' : 'Continue with Google'}
      </Button>
    </>
  );
}

export function SignInForm() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await signInAction(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              required
            />
          </div>
          
          <SubmitButton />
        </form>
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <GoogleSignInButton />
        </div>
      </CardContent>
    </Card>
  );
}
