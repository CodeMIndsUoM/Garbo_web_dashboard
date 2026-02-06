'use client';

import React, { useState } from 'react';

interface LoginProps {
  onLogin?: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: username,
          password: password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Invalid username or password');
        setLoading(false);
        return;
      }
      const admin = data.data;
      localStorage.setItem('role', admin.role || 'admin');
      localStorage.setItem('admin', JSON.stringify({ username: admin.email, role: admin.role }));
      localStorage.setItem('token', 'dummy-token'); // Store a dummy token for backend auth
      setLoading(false);
      if (onLogin) onLogin();
    } catch (err: any) {
      setError('Network error');
      setLoading(false);
    }
  };

  return (
    // Center the card and limit its width so it doesn't span the whole page
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
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-200 shadow-sm focus:ring-2 focus:ring-green-500 focus:border-transparent p-2"
              type="password"
              placeholder="••••••••"
              aria-label="Password"
              disabled={loading}
            />
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

        <p className="text-xs text-gray-400 mt-4">Demo login — connects to backend for authentication.</p>
        <div className="mt-4 text-xs text-gray-500">
          <p>Available test accounts:</p>
          <ul className="list-disc list-inside">
            <li>admin1 / admin123</li>
            <li>admin2 / admin456</li>
            <li>superadmin / super123</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
