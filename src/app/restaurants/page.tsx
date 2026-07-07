'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlatformShell, PhaseBadge, formatDate } from '@/components/PlatformShell';
import {
  PlatformRestaurantSummary,
  isLoggedIn,
  listRestaurants,
} from '@/lib/api';

export default function RestaurantsPage() {
  const router = useRouter();
  const [items, setItems] = useState<PlatformRestaurantSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    load();
  }, [router]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listRestaurants({ search, phase, limit: 100 });
      setItems(data.restaurants);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PlatformShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Restaurants</h1>
          <p className="text-sm text-slate-400">{total} registered tenants</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, city…"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="">All phases</option>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="pending_payment">Pending payment</option>
          </select>
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Search
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 text-red-400">{error}</p> : null}
      {loading ? <p className="text-slate-400">Loading…</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Restaurant</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ends</th>
              <th className="px-4 py-3 font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/restaurants/${r.id}`}
                    className="font-medium text-emerald-400 hover:underline"
                  >
                    {r.name || 'Unnamed'}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {r.email} · {r.city || '—'}
                  </div>
                </td>
                <td className="px-4 py-3 capitalize">{r.subscription_plan}</td>
                <td className="px-4 py-3">
                  <PhaseBadge phase={r.subscription_phase} blocked={r.is_access_blocked} />
                </td>
                <td className="px-4 py-3">
                  {formatDate(r.subscription_end)}
                  <div className="text-xs text-slate-500">{r.days_remaining}d left</div>
                </td>
                <td className="px-4 py-3">₹{r.monthly_price}/mo</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 ? (
          <p className="px-4 py-8 text-center text-slate-500">No restaurants found</p>
        ) : null}
      </div>
    </PlatformShell>
  );
}
