'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PlatformShell, PhaseBadge, formatDate } from '@/components/PlatformShell';
import {
  PlatformRestaurantDetail,
  SubscriptionSelection,
  deleteRestaurant,
  extendTrial,
  getRestaurant,
  grantSubscription,
  isLoggedIn,
  setRestaurantActive,
  updateSelection,
} from '@/lib/api';
import { BulkImportPanel } from '@/components/BulkImportPanel';

export default function RestaurantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || '');

  const [detail, setDetail] = useState<PlatformRestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [durationDays, setDurationDays] = useState('30');
  const [trialDays, setTrialDays] = useState('15');
  const [selection, setSelection] = useState<SubscriptionSelection | null>(null);
  const [busy, setBusy] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRestaurant(id);
      setDetail(data.restaurant);
      setSelection(data.restaurant.selection);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    if (id) load();
  }, [id, router]);

  const runAction = async (key: string, fn: () => Promise<unknown>) => {
    if (!reason.trim()) {
      setError('Please enter a reason for audit log');
      return;
    }
    setBusy(key);
    setError('');
    setMessage('');
    try {
      const res = (await fn()) as { message?: string };
      setMessage(res.message || 'Done');
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy('');
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    if (!deleteReason.trim()) {
      setError('Please enter a reason for deletion');
      return;
    }
    if (confirmName.trim().toLowerCase() !== detail.name.trim().toLowerCase()) {
      setError('Confirmation name must match the restaurant name exactly');
      return;
    }
    if (
      !window.confirm(
        `Permanently delete "${detail.name}" and ALL its data? This cannot be undone.`
      )
    ) {
      return;
    }

    setBusy('delete');
    setError('');
    setMessage('');
    try {
      const res = await deleteRestaurant(id, {
        reason: deleteReason.trim(),
        confirm_name: confirmName.trim(),
      });
      router.replace('/restaurants');
      router.refresh();
      setMessage(res.message || 'Restaurant deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <PlatformShell>
        <p className="text-slate-400">Loading…</p>
      </PlatformShell>
    );
  }

  if (!detail) {
    return (
      <PlatformShell>
        <p className="text-red-400">{error || 'Restaurant not found'}</p>
        <Link href="/restaurants" className="mt-4 inline-block text-emerald-400">
          ← Back
        </Link>
      </PlatformShell>
    );
  }

  const toggleAddon = (key: keyof SubscriptionSelection) => {
    if (!selection) return;
    const current = selection[key];
    if (typeof current === 'boolean') {
      setSelection({ ...selection, [key]: !current });
    }
  };

  return (
    <PlatformShell>
      <Link href="/restaurants" className="text-sm text-emerald-400 hover:underline">
        ← All restaurants
      </Link>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{detail.name}</h1>
          <p className="text-slate-400">
            {detail.email} · {detail.city || '—'} · Code {detail.restaurant_code}
          </p>
        </div>
        <PhaseBadge phase={detail.subscription_phase} blocked={detail.is_access_blocked} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <InfoCard label="Plan" value={detail.subscription_plan} />
        <InfoCard label="Ends" value={formatDate(detail.subscription_end)} />
        <InfoCard label="Monthly" value={`₹${detail.monthly_price}`} />
        <InfoCard label="Tables" value={`${detail.usage.tables ?? 0} / ${detail.limits.max_tables ?? '—'}`} />
        <InfoCard label="Staff" value={String(detail.usage.staff_and_chefs ?? detail.staff_count)} />
        <InfoCard label="Admin login" value={detail.admin_login_hint || '—'} />
      </div>

      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-lg font-medium text-white">Add-ons & limits</h2>
        <p className="mt-1 text-sm text-slate-400">Toggle features then save selection.</p>
        {selection ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AddonToggle
              label="Kitchen — dine-in"
              checked={selection.kitchen_dine_in}
              onChange={() => toggleAddon('kitchen_dine_in')}
            />
            <AddonToggle
              label="Kitchen — counter"
              checked={selection.kitchen_counter}
              onChange={() => toggleAddon('kitchen_counter')}
            />
            <AddonToggle
              label="Inventory"
              checked={selection.inventory}
              onChange={() => toggleAddon('inventory')}
            />
            <AddonToggle
              label="Extended history"
              checked={selection.history_extended}
              onChange={() => toggleAddon('history_extended')}
            />
            <label className="text-sm text-slate-300">
              Max tables
              <input
                type="number"
                min={0}
                max={50}
                value={selection.max_tables}
                onChange={(e) =>
                  setSelection({ ...selection, max_tables: Number(e.target.value) })
                }
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
              />
            </label>
            <label className="text-sm text-slate-300">
              Operation mode
              <select
                value={selection.operation_mode}
                onChange={(e) =>
                  setSelection({ ...selection, operation_mode: e.target.value })
                }
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
              >
                <option value="dine_in">Dine-in only</option>
                <option value="counter">Counter only</option>
                <option value="both">Both</option>
              </select>
            </label>
          </div>
        ) : null}
        <ActionRow
          reason={reason}
          onReason={setReason}
          onRun={() =>
            selection &&
            runAction('selection', () =>
              updateSelection(id, { reason: reason.trim(), selection })
            )
          }
          label="Save add-ons"
          busy={busy === 'selection'}
        />
      </section>

      <BulkImportPanel restaurantId={id} />

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <ActionCard title="Grant subscription (no payment)">
          <p className="text-sm text-slate-400">
            Activates paid plan using current selection. For pilots & comps.
          </p>
          <label className="mt-3 block text-sm text-slate-300">
            Duration (days)
            <input
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
            />
          </label>
          <ActionRow
            reason={reason}
            onReason={setReason}
            onRun={() =>
              runAction('grant', () =>
                grantSubscription(id, {
                  reason: reason.trim(),
                  billing_cycle: 'monthly',
                  duration_days: Number(durationDays) || 30,
                  selection: selection || undefined,
                })
              )
            }
            label="Grant subscription"
            busy={busy === 'grant'}
          />
        </ActionCard>

        <ActionCard title="Extend trial">
          <label className="mt-3 block text-sm text-slate-300">
            Days
            <input
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
            />
          </label>
          <ActionRow
            reason={reason}
            onReason={setReason}
            onRun={() =>
              runAction('trial', () =>
                extendTrial(id, {
                  reason: reason.trim(),
                  days: Number(trialDays) || 15,
                })
              )
            }
            label="Extend trial"
            busy={busy === 'trial'}
          />
        </ActionCard>
      </section>

      <section className="mt-6">
        <ActionCard title="Account status">
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                runAction('suspend', () =>
                  setRestaurantActive(id, { reason: reason.trim(), is_active: false })
                )
              }
              className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-300 hover:bg-red-950"
            >
              Suspend
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                runAction('reactivate', () =>
                  setRestaurantActive(id, { reason: reason.trim(), is_active: true })
                )
              }
              className="rounded-lg border border-emerald-800 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-950"
            >
              Reactivate
            </button>
          </div>
          <ActionRow
            reason={reason}
            onReason={setReason}
            onRun={() => {}}
            label=""
            busy={false}
            hideButton
          />
        </ActionCard>
      </section>

      <section className="mt-6">
        <ActionCard title="Danger zone">
          <p className="mt-2 text-sm text-red-300">
            Permanently deletes this restaurant, all staff accounts, orders, menu, inventory,
            tables, and audit history. This cannot be undone.
          </p>
          <label className="mt-4 block text-sm text-slate-300">
            Type restaurant name to confirm: <span className="text-white">{detail.name}</span>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="mt-1 w-full rounded border border-red-900 bg-slate-950 px-2 py-1.5 text-white"
              placeholder={detail.name}
            />
          </label>
          <label className="mt-3 block text-sm text-slate-300">
            Reason (required)
            <input
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="mt-1 w-full rounded border border-red-900 bg-slate-950 px-2 py-1.5 text-white"
              placeholder="e.g. Test tenant cleanup"
            />
          </label>
          <button
            type="button"
            disabled={!!busy}
            onClick={handleDelete}
            className="mt-4 rounded-lg border border-red-700 bg-red-950 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-900 disabled:opacity-50"
          >
            {busy === 'delete' ? 'Deleting…' : 'Delete restaurant permanently'}
          </button>
        </ActionCard>
      </section>

      {message ? <p className="mt-4 text-emerald-400">{message}</p> : null}
      {error ? <p className="mt-4 text-red-400">{error}</p> : null}
    </PlatformShell>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-white">{value}</div>
    </div>
  );
}

function ActionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="font-medium text-white">{title}</h2>
      {children}
    </div>
  );
}

function AddonToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
      <span className="text-sm text-slate-200">{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4" />
    </label>
  );
}

function ActionRow({
  reason,
  onReason,
  onRun,
  label,
  busy,
  hideButton,
}: {
  reason: string;
  onReason: (v: string) => void;
  onRun: () => void;
  label: string;
  busy: boolean;
  hideButton?: boolean;
}) {
  return (
    <div className="mt-4 space-y-2">
      <input
        value={reason}
        onChange={(e) => onReason(e.target.value)}
        placeholder="Reason (required for audit log)"
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
      />
      {!hideButton && label ? (
        <button
          type="button"
          disabled={busy}
          onClick={onRun}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? 'Working…' : label}
        </button>
      ) : null}
    </div>
  );
}
