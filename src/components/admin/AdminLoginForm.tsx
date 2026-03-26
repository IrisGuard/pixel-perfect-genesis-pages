import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Shield, Factory, Lock, UserPlus } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

const AdminLoginForm: React.FC = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [slotAvailable, setSlotAvailable] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAdminAuth();

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/admin-dashboard`;

  useEffect(() => {
    checkAdminSlot();
  }, []);

  const checkAdminSlot = async () => {
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_admin_slot' }),
      });
      const data = await res.json();
      setSlotAvailable(data.available === true);
      if (data.available) setIsRegisterMode(true);
    } catch {
      setSlotAvailable(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !email || !password || !confirmPassword) {
      setError('Όλα τα πεδία είναι υποχρεωτικά');
      return;
    }
    if (password !== confirmPassword) {
      setError('Οι κωδικοί δεν ταιριάζουν');
      return;
    }
    if (password.length < 8) {
      setError('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_admin',
          email: email.trim(),
          username: username.trim(),
          password,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setIsLoading(false);
        return;
      }

      // Auto-login after registration
      const success = await login(
        data.admin.username,
        data.admin.email,
        data.sessionToken,
        '',
        ''
      );

      if (!success) {
        setError('Registration successful but login failed. Try logging in.');
        setIsRegisterMode(false);
      }
    } catch (err: any) {
      setError('Registration failed: ' + err.message);
    }
    setIsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email και κωδικός είναι υποχρεωτικά');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login_admin',
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setIsLoading(false);
        return;
      }

      const success = await login(
        data.admin.username,
        data.admin.email,
        data.sessionToken,
        '',
        ''
      );

      if (!success) {
        setError('Login failed.');
      }
    } catch (err: any) {
      setError('Login failed: ' + err.message);
    }
    setIsLoading(false);
  };

  if (slotAvailable === null) {
    return (
      <Card className="w-full max-w-md mx-auto border border-border bg-card">
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground mt-4 text-sm">Connecting...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto border border-border bg-card shadow-2xl">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center text-2xl text-foreground gap-3">
          <Factory className="w-8 h-8 text-primary" />
          {isRegisterMode ? 'Create Admin Account' : 'Admin Login'}
        </CardTitle>
        <div className="flex items-center justify-center text-sm text-muted-foreground gap-1">
          <Shield className="w-4 h-4" />
          {isRegisterMode ? 'One-time setup — account locks after creation' : 'Secure Factory Control Center'}
        </div>
        {isRegisterMode && (
          <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
            <p className="text-xs text-amber-400 flex items-center gap-1 justify-center">
              <Lock className="w-3 h-3" />
              ⚠️ Μόνο 1 admin λογαριασμός — μετά κλειδώνει!
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {isRegisterMode && (
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-foreground">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isRegisterMode && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-background border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                {isRegisterMode ? 'Creating account...' : 'Logging in...'}
              </span>
            ) : isRegisterMode ? (
              <span className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Create Admin Account
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4" /> Login
              </span>
            )}
          </Button>

          {!isRegisterMode && slotAvailable && (
            <button
              type="button"
              onClick={() => setIsRegisterMode(true)}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              No account yet? Create one
            </button>
          )}

          {isRegisterMode && !slotAvailable && (
            <button
              type="button"
              onClick={() => setIsRegisterMode(false)}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Already have an account? Login
            </button>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default AdminLoginForm;
