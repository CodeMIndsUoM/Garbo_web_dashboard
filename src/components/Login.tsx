'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/layout/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiBase } from '@/lib/api';
import { typography } from '@/theme';

interface LoginProps {
  onLogin?: (opts?: { mustChangePassword?: boolean }) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const email = username.trim();
      const pwd = password;
      const res = await fetch(`${getApiBase()}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: pwd,
        }),
      });

      const data = await res.json();
      const mustChangePassword = data?.mustChangePassword ?? data?.data?.mustChangePassword ?? false;

      if (!res.ok) {
        setError(data.error || data.message || 'Invalid username or password');
        setLoading(false);
        return;
      }

      const token = data.token || data.accessToken || data?.data?.token;
      if (!token) {
        setError('Login succeeded but no token returned');
        setLoading(false);
        return;
      }

      sessionStorage.setItem('token', token);
      try {
        const { decodeJwtPayload } = await import('@/lib/jwt');
        const payload = decodeJwtPayload(token);
        const roleFromToken = payload?.role || payload?.roles || payload?.roleName;
        const idFromToken = payload?.sub || payload?.id || payload?.userId;
        const roleToStore = data.role || data.data?.role || roleFromToken || 'admin';
        sessionStorage.setItem('role', roleToStore);
        sessionStorage.setItem('userId', idFromToken || '');
        sessionStorage.setItem(
          'admin',
          JSON.stringify({ username: data.email || data.data?.email, role: roleToStore, id: idFromToken || undefined })
        );
        try {
          sessionStorage.setItem('mustChangePassword', JSON.stringify(Boolean(mustChangePassword)));
        } catch {
          /* ignore */
        }
      } catch {
        sessionStorage.setItem('role', data.role || data.data?.role || 'admin');
        sessionStorage.setItem(
          'admin',
          JSON.stringify({ username: data.email || data.data?.email, role: data.role || data.data?.role || 'admin' })
        );
      }

      try {
        const council = data?.council ?? data?.data?.council;
        if (council === null || council === undefined) {
          sessionStorage.removeItem('council');
        } else {
          sessionStorage.setItem('council', JSON.stringify(council));
        }
      } catch {
        /* ignore */
      }

      setLoading(false);
      if (onLogin) onLogin({ mustChangePassword: Boolean(mustChangePassword) });
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle="Enter your credentials to access the admin dashboard.">
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="login-email" className={typography.label}>
            Email
          </Label>
          <Input
            id="login-email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            type="email"
            autoComplete="username"
            placeholder="admin@council.gov"
            aria-label="Email"
            disabled={loading}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password" className={typography.label}>
            Password
          </Label>
          <div className="relative">
            <Input
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              aria-label="Password"
              disabled={loading}
              className="h-11 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              disabled={loading}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="brand" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
