'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PlatformShell, PhaseBadge, BoolBadge, formatDate } from '@/components/PlatformShell';
import {
  CustomDeal,
  PlatformRestaurantDetail,
  SubscriptionSelection,
  approveRestaurant,
  clearCustomDeal,
  deleteRestaurant,
  extendTrial,
  getRestaurant,
  grantSubscription,
  isLoggedIn,
  setCustomDeal,
  setRestaurantActive,
  updateSelection,
} from '@/lib/api';
import { BulkImportPanel } from '@/components/BulkImportPanel';

function emptyDealSelection(base?: SubscriptionSelection | null): SubscriptionSelection {
  return {
    billing_cycle: base?.billing_cycle || 'monthly',
    operation_mode: 'both',
    max_tables: base?.max_tables ?? 10,
    extra_staff: base?.extra_staff ?? 0,
    extra_chefs: base?.extra_chefs ?? 0,
    extra_managers: base?.extra_managers ?? 0,
    history_extended: Boolean(base?.history_extended),
    inventory: Boolean(base?.inventory),
    expenses: Boolean(base?.expenses),
    kitchen_dine_in: true,
    kitchen_counter: true,
  };
}

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
  const [dealMonthly, setDealMonthly] = useState('4999');
  const [dealAnnual, setDealAnnual] = useState('');
  const [dealTables, setDealTables] = useState('40');
  const [dealExtraStaff, setDealExtraStaff] = useState('0');
  const [dealExtraChefs, setDealExtraChefs] = useState('0');
  const [dealExtraManagers, setDealExtraManagers] = useState('0');
  const [dealInventory, setDealInventory] = useState(true);
  const [dealExpenses, setDealExpenses] = useState(true);
  const [dealHistory, setDealHistory] = useState(true);
  const [dealLock, setDealLock] = useState(true);
  const [dealActivate, setDealActivate] = useState(true);
  const [dealDurationDays, setDealDurationDays] = useState('30');
  const [dealNotes, setDealNotes] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  const hydrateDealForm = (restaurant: PlatformRestaurantDetail) => {
    const deal = restaurant.custom_deal;
    const sel = deal?.selection || restaurant.selection;
    setDealMonthly(String(deal?.monthly_price ?? restaurant.monthly_price || 4999));
    setDealAnnual(deal?.annual_price ? String(deal.annual_price) : '');
    setDealTables(String(sel?.max_tables ?? 40));
    setDealExtraStaff(String(sel?.extra_staff ?? 0));
    setDealExtraChefs(String(sel?.extra_chefs ?? 0));
    setDealExtraManagers(String(sel?.extra_managers ?? 0));
    setDealInventory(Boolean(sel?.inventory ?? true));
    setDealExpenses(Boolean(sel?.expenses ?? true));
    setDealHistory(Boolean(sel?.history_extended ?? true));
    setDealLock(deal?.lock_self_serve_changes ?? true);
    setDealNotes(deal?.notes || '');
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRestaurant(id);
      setDetail(data.restaurant);
      setSelection({
        ...emptyDealSelection(data.restaurant.selection),
        ...data.restaurant.selection,
        extra_chefs: data.restaurant.selection.extra_chefs ?? 0,
        expenses: Boolean(data.restaurant.selection.expenses),
      });
      hydrateDealForm(data.restaurant);
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

  const handleApprove = async () => {
    setBusy('approve');
    setError('');
    setMessage('');
    try {
      const res = await approveRestaurant(id, {
        reason: reason.trim() || 'Approved via BillGenie portal',
      });
      setMessage(res.message || 'Restaurant approved');
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
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
        <InfoCard
          label="Plan"
          value={detail.subscription_plan}
          sub={detail.pricing_mode === 'custom' ? 'Custom commercial deal' : 'Catalog pricing'}
        />
        <InfoCard label="Ends" value={formatDate(detail.subscription_end)} />
        <InfoCard
          label="Monthly (incl. 18% GST)"
          value={`₹${detail.monthly_price_with_gst.toLocaleString('en-IN')}`}
          sub={`₹${detail.monthly_price.toLocaleString('en-IN')} + GST`}
        />
        <InfoCard
          label="Orders this month"
          value={detail.month_orders.toLocaleString('en-IN')}
          sub="Dine-in + counter"
        />
        <InfoCard
          label="Revenue this month"
          value={`₹${detail.month_revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          sub="Incl. GST"
        />
        <InfoCard label="Tables" value={`${detail.usage.tables ?? 0} / ${detail.limits.max_tables ?? '—'}`} />
        <InfoCard label="Staff" value={String(detail.usage.staff_and_chefs ?? detail.staff_count)} />
        <InfoCard label="Admin login" value={detail.admin_login_hint || '—'} />
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Email verified</div>
          <div className="mt-1"><BoolBadge value={detail.is_email_verified} trueLabel="verified" falseLabel="unverified" /></div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Approved</div>
          <div className="mt-1"><BoolBadge value={detail.is_approved} trueLabel="approved" falseLabel="pending" /></div>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-amber-900/50 bg-amber-950/20 p-5">
        <h2 className="text-lg font-medium text-white">Custom commercial deal</h2>
        <p className="mt-1 text-sm text-slate-400">
          Negotiated monthly price and capacity for large restaurants. Catalog self-serve
          stays unchanged; only platform can set this.
        </p>
        {detail.pricing_mode === 'custom' && detail.custom_deal ? (
          <p className="mt-2 text-sm text-amber-200">
            Active · ₹{detail.custom_deal.monthly_price.toLocaleString('en-IN')}/mo ·{' '}
            {detail.custom_deal.lock_self_serve_changes
              ? 'self-serve plan changes locked'
              : 'self-serve plan changes allowed'}
            {detail.custom_deal.set_by ? ` · set by ${detail.custom_deal.set_by}` : ''}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No custom deal — using catalog rates.</p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm text-slate-300">
            Monthly price (₹)
            <input
              type="number"
              min={1}
              value={dealMonthly}
              onChange={(e) => setDealMonthly(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
            />
          </label>
          <label className="text-sm text-slate-300">
            Annual price (₹, optional)
            <input
              type="number"
              min={0}
              value={dealAnnual}
              onChange={(e) => setDealAnnual(e.target.value)}
              placeholder="defaults to monthly × 11"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
            />
          </label>
          <label className="text-sm text-slate-300">
            Max tables
            <input
              type="number"
              min={5}
              max={200}
              value={dealTables}
              onChange={(e) => setDealTables(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
            />
          </label>
          <label className="text-sm text-slate-300">
            Extra staff
            <input
              type="number"
              min={0}
              value={dealExtraStaff}
              onChange={(e) => setDealExtraStaff(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
            />
          </label>
          <label className="text-sm text-slate-300">
            Extra chefs
            <input
              type="number"
              min={0}
              value={dealExtraChefs}
              onChange={(e) => setDealExtraChefs(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
            />
          </label>
          <label className="text-sm text-slate-300">
            Extra managers
            <input
              type="number"
              min={0}
              value={dealExtraManagers}
              onChange={(e) => setDealExtraManagers(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
            />
          </label>
          <label className="text-sm text-slate-300">
            Duration days (if activate)
            <input
              type="number"
              min={0}
              value={dealDurationDays}
              onChange={(e) => setDealDurationDays(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
            />
          </label>
          <label className="text-sm text-slate-300 sm:col-span-2">
            Notes
            <input
              value={dealNotes}
              onChange={(e) => setDealNotes(e.target.value)}
              placeholder="e.g. Pilot deal for chain HQ"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
            />
          </label>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <AddonToggle label="Inventory" checked={dealInventory} onChange={() => setDealInventory((v) => !v)} />
          <AddonToggle label="Expenses" checked={dealExpenses} onChange={() => setDealExpenses((v) => !v)} />
          <AddonToggle label="Extended history (2yr)" checked={dealHistory} onChange={() => setDealHistory((v) => !v)} />
          <AddonToggle
            label="Lock self-serve plan changes"
            checked={dealLock}
            onChange={() => setDealLock((v) => !v)}
          />
          <AddonToggle
            label="Activate paid phase now"
            checked={dealActivate}
            onChange={() => setDealActivate((v) => !v)}
          />
        </div>
        <ActionRow
          reason={reason}
          onReason={setReason}
          onRun={() => {
            const deal: CustomDeal = {
              monthly_price: Number(dealMonthly) || 0,
              annual_price: dealAnnual ? Number(dealAnnual) : 0,
              selection: {
                ...emptyDealSelection(selection),
                max_tables: Number(dealTables) || 10,
                extra_staff: Number(dealExtraStaff) || 0,
                extra_chefs: Number(dealExtraChefs) || 0,
                extra_managers: Number(dealExtraManagers) || 0,
                inventory: dealInventory,
                expenses: dealExpenses,
                history_extended: dealHistory,
              },
              lock_self_serve_changes: dealLock,
              notes: dealNotes.trim(),
            };
            return runAction('custom-deal', () =>
              setCustomDeal(id, {
                reason: reason.trim(),
                deal,
                activate: dealActivate,
                duration_days: Number(dealDurationDays) || 0,
              })
            );
          }}
          label="Apply custom deal"
          busy={busy === 'custom-deal'}
        />
        {detail.pricing_mode === 'custom' ? (
          <div className="mt-3">
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                runAction('clear-deal', () =>
                  clearCustomDeal(id, { reason: reason.trim() || 'Clear custom deal' })
                )
              }
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              {busy === 'clear-deal' ? 'Working…' : 'Clear custom deal → catalog'}
            </button>
          </div>
        ) : null}
      </section>

      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-lg font-medium text-white">Catalog add-ons & limits</h2>
        <p className="mt-1 text-sm text-slate-400">
          Catalog-only. Disabled while a custom commercial deal is active — edit or clear the
          deal above instead.
        </p>
        {detail.pricing_mode === 'custom' ? (
          <p className="mt-2 text-sm text-amber-300">
            Custom deal active — catalog selection save is blocked by the API.
          </p>
        ) : null}
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
              label="Expenses"
              checked={Boolean(selection.expenses)}
              onChange={() => toggleAddon('expenses')}
            />
            <AddonToggle
              label="Extended history"
              checked={selection.history_extended}
              onChange={() => toggleAddon('history_extended')}
            />
            <label className="text-sm text-slate-300">
              Plan band / max tables (10=Starter, 18=Growth, 25=Scale)
              <input
                type="number"
                min={10}
                max={25}
                step={1}
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
          label="Save catalog add-ons"
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
              disabled={!!busy || !detail.is_email_verified || detail.is_approved}
              onClick={handleApprove}
              className="rounded-lg border border-emerald-800 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'approve' ? 'Approving…' : 'Approve this restaurant'}
            </button>
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
          {!detail.is_email_verified ? (
            <p className="mt-2 text-xs text-slate-500">
              Email must be verified before you can approve this restaurant.
            </p>
          ) : detail.is_approved ? (
            <p className="mt-2 text-xs text-slate-500">Already approved.</p>
          ) : null}
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

function InfoCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-white">{value}</div>
      {sub ? <div className="text-xs text-slate-500">{sub}</div> : null}
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
