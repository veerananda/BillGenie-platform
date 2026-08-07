'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlatformShell, PhaseBadge, BoolBadge, formatDate } from '@/components/PlatformShell';
import {
  PlatformRestaurantSummary,
  approveRestaurant,
  getSMTPStatus,
  isLoggedIn,
  listRestaurants,
  testSMTP,
} from '@/lib/api';

export default function RestaurantsPage() {
  const router = useRouter();
  const [items, setItems] = useState<PlatformRestaurantSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState('');
  const [customPendingOnly, setCustomPendingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [approvingId, setApprovingId] = useState('');
  const [smtpBusy, setSmtpBusy] = useState(false);
  const [smtpTo, setSmtpTo] = useState('');
  const [smtpConfig, setSmtpConfig] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    load();
    getSMTPStatus()
      .then(setSmtpConfig)
      .catch(() => setSmtpConfig(null));
  }, [router]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listRestaurants({
        search,
        phase,
        custom_deal_pending: customPendingOnly || undefined,
        limit: 100,
      });
      setItems(data.restaurants);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleSMTPTest = async (sendMail: boolean) => {
    setSmtpBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await testSMTP(sendMail && smtpTo.trim() ? { to: smtpTo.trim() } : {});
      setMessage(res.message);
      if (res.config) setSmtpConfig(res.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SMTP test failed');
    } finally {
      setSmtpBusy(false);
    }
  };

  const handleApprove = async (restaurantId: string) => {
    setApprovingId(restaurantId);
    setError('');
    try {
      await approveRestaurant(restaurantId, { reason: 'Approved via BillGenie portal' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setApprovingId('');
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
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={customPendingOnly}
              onChange={(e) => setCustomPendingOnly(e.target.checked)}
            />
            Custom deal requests
          </label>
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Search
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">SMTP diagnostics</h2>
            <p className="mt-1 text-xs text-slate-400">
              {smtpConfig
                ? smtpConfig.configured === 'true'
                  ? `${smtpConfig.host}:${smtpConfig.port} as ${smtpConfig.user}`
                  : `Not configured — ${smtpConfig.error || 'missing env'}`
                : 'Loading SMTP status…'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={smtpTo}
              onChange={(e) => setSmtpTo(e.target.value)}
              placeholder="Optional test inbox"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              disabled={smtpBusy}
              onClick={() => handleSMTPTest(false)}
              className="rounded-lg border border-sky-800 px-3 py-2 text-sm text-sky-300 hover:bg-sky-950 disabled:opacity-40"
            >
              {smtpBusy ? 'Testing…' : 'Test auth'}
            </button>
            <button
              type="button"
              disabled={smtpBusy || !smtpTo.trim()}
              onClick={() => handleSMTPTest(true)}
              className="rounded-lg border border-amber-800 px-3 py-2 text-sm text-amber-300 hover:bg-amber-950 disabled:opacity-40"
            >
              Send test mail
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="mb-4 text-red-400">{error}</p> : null}
      {message ? <p className="mb-4 text-emerald-400">{message}</p> : null}
      {loading ? <p className="text-slate-400">Loading…</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Restaurant</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Email verified</th>
              <th className="px-4 py-3 font-medium">Approved</th>
              <th className="px-4 py-3 font-medium">Ends</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Orders (month)</th>
              <th className="px-4 py-3 font-medium">Revenue (month)</th>
              <th className="px-4 py-3 font-medium">Actions</th>
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
                <td className="px-4 py-3 capitalize">
                  {r.subscription_plan}
                  {r.custom_deal_request_pending ? (
                    <div className="mt-1 text-xs font-medium text-amber-300">
                      Custom request · {r.requested_max_tables || '?'} tables
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <PhaseBadge phase={r.subscription_phase} blocked={r.is_access_blocked} />
                </td>
                <td className="px-4 py-3">
                  <BoolBadge value={r.is_email_verified} trueLabel="verified" falseLabel="unverified" />
                </td>
                <td className="px-4 py-3">
                  <BoolBadge value={r.is_approved} trueLabel="approved" falseLabel="pending" />
                </td>
                <td className="px-4 py-3">
                  {formatDate(r.subscription_end)}
                  <div className="text-xs text-slate-500">{r.days_remaining}d left</div>
                </td>
                <td className="px-4 py-3">
                  ₹{r.monthly_price_with_gst.toLocaleString('en-IN')}/mo
                  <div className="text-xs text-slate-500">
                    ₹{r.monthly_price.toLocaleString('en-IN')} + 18% GST
                  </div>
                </td>
                <td className="px-4 py-3">{r.month_orders.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3">
                  ₹{r.month_revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  <div className="text-xs text-slate-500">incl. GST</div>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={approvingId === r.id || !r.is_email_verified || r.is_approved}
                    onClick={() => handleApprove(r.id)}
                    className="rounded-lg border border-emerald-800 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {approvingId === r.id ? 'Approving…' : r.is_approved ? 'Approved' : 'Approve'}
                  </button>
                </td>
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
