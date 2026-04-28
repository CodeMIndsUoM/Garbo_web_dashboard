'use client';

import React, { useState } from 'react';

interface LoginProps {
  onLogin?: (opts?: { mustChangePassword?: boolean }) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';
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
      const res = await fetch(`${ API_BASE }/api/auth/login`, {
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

      // extract mustChangePassword if backend provides it (backwards compatible)
      const mustChangePassword = data?.mustChangePassword ?? data?.data?.mustChangePassword ?? false;

      if (!res.ok) {
        setError(data.error || data.message || 'Invalid username or password');
        setLoading(false);
        return;
      }

      // backend returns: { token: "...", role: "...", email: "..." }
      const token = data.token||data.accessToken||data.data?.token;
      if (!token) {
        setError('Login succeeded but no token returned');
        setLoading(false);
        return;
      }

      localStorage.setItem('token', token);
      // Try to extract role and id from token if backend doesn't include them in response
      try {
        // lazy-import to avoid SSR issues
        // @ts-ignore
        const { decodeJwtPayload } = await import('@/lib/jwt');
        const payload = decodeJwtPayload(token);
        const roleFromToken = payload?.role || payload?.roles || payload?.roleName;
        const idFromToken = payload?.sub || payload?.id || payload?.userId;
        const roleToStore = data.role||data.data?.role||roleFromToken||'admin';
        localStorage.setItem('role', roleToStore);
        localStorage.setItem('userId', idFromToken || '');
        localStorage.setItem(
          'admin',
          JSON.stringify({ username: data.email||data.data?.email, role: roleToStore, id: idFromToken || undefined })
        );
        // persist mustChangePassword flag for app-level routing (backwards compatible)
        try { localStorage.setItem('mustChangePassword', JSON.stringify(Boolean(mustChangePassword))); } catch (e) {}
      } catch (e) {
        localStorage.setItem('role', data.role||data.data?.role||'admin');
        localStorage.setItem(
          'admin',
          JSON.stringify({ username: data.email||data.data?.email, role: data.role||data.data?.role||'admin' })
        );
      }
      try {
        const council = data?.council ?? data?.data?.council;
        if (council === null || council === undefined) {
          localStorage.removeItem('council');
        } else {
          localStorage.setItem('council', JSON.stringify(council));
        }
      } catch (e) {}

      // Enforce strict overwrite behavior for `council` returned by backend.
      // Always clear previous council on every login. If backend returns null/undefined,
      // remove `council` from localStorage; otherwise store the returned object.
      try {
        const council = data?.council ?? data?.data?.council;
        if (council === null || council === undefined) {
          localStorage.removeItem('council');
        } else {
          localStorage.setItem('council', JSON.stringify(council));
        }
      } catch (e) {}

      setLoading(false);
      if (onLogin) onLogin({ mustChangePassword: Boolean(mustChangePassword) });
    } catch (err: any) {
      setError('Network error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm md:max-w-md bg-white rounded-lg shadow-md p-6 mx-auto">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900">Sign in to Garbo</h2>
        <p className="text-sm text-gray-500 mb-6">Enter your credentials to continue.</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-200 shadow-sm focus:ring-2 focus:ring-green-500 focus:border-transparent p-2"
              type="text"
              placeholder="john@example.com"
              aria-label="Username"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <div className="relative mt-1">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border-gray-200 shadow-sm focus:ring-2 focus:ring-green-500 focus:border-transparent p-2 pr-10"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                aria-label="Password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={loading}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7 1.05-2.02 2.74-3.69 4.73-4.7" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center rounded-md bg-green-600 text-white px-4 py-2 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
