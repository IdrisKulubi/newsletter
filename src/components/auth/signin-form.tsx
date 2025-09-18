'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signInAction, signInWithGoogleAction, signInWithMicrosoftAction } from '@/lib/actions/auth/signin';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Signing in...' : 'Sign In'}
    </Button>
  );
}

function SocialButton({ provider, action, children }: { 
  provider: string; 
  action: () => Promise<any>; 
  children: React.ReactNode; 
}) {
  const [isPending, setIsPending] = useState(false);
  
  const handleClick = async () => {
    setIsPending(true);
    try {
      await action();
    } finally {
      setIsPending(false);
    }
  };
  
  return (
    <Button 
      type="button" 
      variant="outline" 
      className="w-full" 
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? `Connecting to ${provider}...` : children}
    </Button>
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
          <SocialButton provider="Google" action={signInWithGoogleAction}>
            Continue with Google
          </SocialButton>
          <SocialButton provider="Microsoft" action={signInWithMicrosoftAction}>
            Continue with Microsoft
          </SocialButton>
        </div>
      </CardContent>
    </Card>
  );
}