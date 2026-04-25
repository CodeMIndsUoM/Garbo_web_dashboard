 'use client';

import React, { useState } from "react";
import { decodeJwtPayload } from '@/lib/jwt';

const AdminEditPassword: React.FC<{ onPasswordChanged?: () => void }> = ({ onPasswordChanged }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setLoading(true);
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

    // derive email from localStorage.admin or decode token
    let email = '';
    try {
      const adminStr = localStorage.getItem('admin');
      if (adminStr) {
        const adminObj = JSON.parse(adminStr);
        email = adminObj.username || adminObj.email || '';
      }
    } catch (e) {
      // ignore parse errors
    }

    if (!email) {
      const token = localStorage.getItem('token');
      const payload = decodeJwtPayload(token);
      email = payload?.email || payload?.sub || '';
    }

    if (!email) {
      setLoading(false);
      setError('Unable to determine email for password change.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email,
          oldPassword: currentPassword,
          newPassword: newPassword,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.message || json?.error || 'Failed to change password');
        setLoading(false);
        return;
      }

      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      try { localStorage.setItem('mustChangePassword', JSON.stringify(false)); } catch (e) {}
      // trigger parent navigation handler if provided (state-based routing)
      if (onPasswordChanged) {
        try { onPasswordChanged(); } catch (e) {}
      }
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Change Password</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Current Password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">New Password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirm New Password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}
        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition-colors"
          disabled={loading}
        >
          {loading ? "Updating..." : "Change Password"}
        </button>
      </form>
    </div>
  );
};

export default AdminEditPassword;
