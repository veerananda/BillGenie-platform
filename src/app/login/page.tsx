'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { listRestaurants, saveSession } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [actor, setActor] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      saveSession(apiKey.trim(), actor.trim() || 'creator');
      await listRestaurants({ limit: 1 });
      router.replace('/restaurants');
    } catch (err) {
      sessionStorage.removeItem('platform_api_key');
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-white">BillGenie Platform</h1>
        <p className="mt-2 text-sm text-slate-400">
          Creators only. Use your platform ops API key from Fly secrets.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Ops API key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-500"
              placeholder="PLATFORM_OPS_API_KEY"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Your name (audit log)</label>
            <input
              type="text"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-500"
              placeholder="e.g. Veera"
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
