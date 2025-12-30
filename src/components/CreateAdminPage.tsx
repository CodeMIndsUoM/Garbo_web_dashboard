import React from 'react';

interface CreateAdminPageProps {
  onBack?: () => void;
}

export default function CreateAdminPage({ onBack }: CreateAdminPageProps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [council, setCouncil] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8080';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim() || !password.trim() || !council.trim()) {
      setError('Email, password, and council are required');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          council: council.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.message || 'Failed to create admin');
      } else if (json.success) {
        setSuccess('Admin created successfully!');
        setEmail('');
        setPassword('');
        setCouncil('');
        if (onBack) setTimeout(onBack, 1000);
      } else {
        setError('Failed to create admin');
      }
    } catch (err: any) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded shadow">
      <div className="flex items-center mb-6">
        {onBack && (
          <button type="button" className="mr-4 text-blue-600 hover:underline" onClick={onBack}>&larr; Back</button>
        )}
        <h2 className="text-2xl font-bold">Create New Admin</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Email</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Password</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Council</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="text"
            value={council}
            onChange={e => setCouncil(e.target.value)}
            required
          />
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}
        <div className="flex justify-center mt-8">
          <button
            type="submit"
            className="bg-black text-white font-bold text-lg px-8 py-3 rounded shadow-lg hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition"
            style={{ minWidth: 180 }}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Admin'}
          </button>
        </div>
      </form>
    </div>
  );
}
