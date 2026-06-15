'use client';

import React, { useState } from "react";
import { decodeJwtPayload } from '@/lib/jwt';

const AdminEditPassword: React.FC<{ onPasswordChanged?: () => void; onLogout?: () => void }> = ({ onPasswordChanged, onLogout }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setLoading(true);
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

    // derive email from sessionStorage.admin or decode token
    let email = '';
    try {
      const adminStr = sessionStorage.getItem('admin');
      if (adminStr) {
        const adminObj = JSON.parse(adminStr);
        email = adminObj.username || adminObj.email || '';
      }
    } catch (e) {
      // ignore parse errors
    }

    if (!email) {
      const token = sessionStorage.getItem('token');
      const payload = decodeJwtPayload(token);
      email = payload?.email || payload?.sub || '';
    }

    if (!email) {
      setLoading(false);
      setError('Unable to determine email for password change.');
      return;
    }

    try {
      const token = sessionStorage.getItem('token');
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
      try { sessionStorage.setItem('mustChangePassword', JSON.stringify(false)); } catch (e) { }
      // trigger parent navigation handler if provided (state-based routing)
      if (onPasswordChanged) {
        try { onPasswordChanged(); } catch (e) { }
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
          <div className="relative">
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              className="w-full border rounded px-3 py-2 pr-10"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((s) => !s)}
              aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              disabled={loading}
            >
              {showCurrentPassword ? (
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
        <div>
          <label className="block text-sm font-medium mb-1">New Password</label>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              className="w-full border rounded px-3 py-2 pr-10"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((s) => !s)}
              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              disabled={loading}
            >
              {showNewPassword ? (
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
        <div>
          <label className="block text-sm font-medium mb-1">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              className="w-full border rounded px-3 py-2 pr-10"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((s) => !s)}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              disabled={loading}
            >
              {showConfirmPassword ? (
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
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}
        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition-colors"
          disabled={loading}
        >
          {loading ? "Updating..." : "Change Password"}
        </button>
        <button
          type="button"
          onClick={() => onLogout && onLogout()}
          className="w-full border border-red-200 text-red-600 py-2 rounded hover:bg-red-50 transition-colors"
        >
          Log Out
        </button>
      </form>
    </div>
  );
};

export default AdminEditPassword;
