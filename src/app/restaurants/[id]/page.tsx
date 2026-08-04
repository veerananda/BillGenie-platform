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
  cancelCustomDealRequest,
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
import { DealPlanPresetPicker } from '@/components/DealPlanPresetPicker';
import {
  applyCatalogPlan,
  repriceCatalogPlan,
  type CityTier,
  type DealPlanSource,
  type PlanBand,
} from '@/lib/catalogPlans';

function emptyDealSelection(base?: Partial<SubscriptionSelection> | null): SubscriptionSelection {
  return {
    billing_cycle: base?.billing_cycle || 'quarterly',
    operation_mode: base?.operation_mode || 'both',
    max_tables: Number(base?.max_tables) > 0 ? Number(base?.max_tables) : 10,
    extra_staff: Number(base?.extra_staff) || 0,
    extra_chefs: Number(base?.extra_chefs) || 0,
    extra_managers: Number(base?.extra_managers) || 0,
    history_extended: Boolean(base?.history_extended),
    inventory: Boolean(base?.inventory),
    expenses: Boolean(base?.expenses),
    kitchen_dine_in: base?.kitchen_dine_in !== false,
    kitchen_counter: base?.kitchen_counter !== false,
  };
}

function formatInr(amount: number | null | undefined): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
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
  const [dealMonthly, setDealMonthly] = useState('999');
  const [dealAnnual, setDealAnnual] = useState('');
  const [dealTables, setDealTables] = useState('10');
  const [dealExtraStaff, setDealExtraStaff] = useState('0');
  const [dealExtraChefs, setDealExtraChefs] = useState('0');
  const [dealExtraManagers, setDealExtraManagers] = useState('0');
  const [dealInventory, setDealInventory] = useState(false);
  const [dealExpenses, setDealExpenses] = useState(false);
  const [dealHistory, setDealHistory] = useState(false);
  const [dealLock, setDealLock] = useState(false);
  const [dealActivate, setDealActivate] = useState(true);
  const [dealDurationDays, setDealDurationDays] = useState('30');
  const [dealNotes, setDealNotes] = useState('');
  const [dealPlanSource, setDealPlanSource] = useState<DealPlanSource>('custom');
  const [dealCityTier, setDealCityTier] = useState<CityTier>('tier_2');
  const [busy, setBusy] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  const hydrateDealForm = (restaurant: PlatformRestaurantDetail) => {
    const deal = restaurant.custom_deal;
    const req = restaurant.custom_deal_request;
    const pendingReq = req && String(req.status || '').toLowerCase() === 'pending' ? req : null;
    const sel = emptyDealSelection(
      deal?.selection ||
        (pendingReq
          ? {
              billing_cycle: pendingReq.billing_cycle,
              max_tables: pendingReq.max_tables,
              extra_staff: pendingReq.extra_staff,
              extra_chefs: pendingReq.extra_chefs,
              extra_managers: pendingReq.extra_managers,
              inventory: pendingReq.inventory,
              expenses: pendingReq.expenses,
              history_extended: pendingReq.history_extended,
            }
          : restaurant.selection)
    );
    const hasDeal = Boolean(deal && Number(deal.monthly_price) > 0);
    setDealMonthly(String(deal?.monthly_price ?? restaurant.monthly_price ?? 999));
    setDealAnnual(deal?.annual_price ? String(deal.annual_price) : '');
    setDealTables(String(sel.max_tables || (hasDeal || pendingReq ? 40 : 10)));
    setDealExtraStaff(String(sel.extra_staff));
    setDealExtraChefs(String(sel.extra_chefs));
    setDealExtraManagers(String(sel.extra_managers));
    setDealInventory(Boolean(sel.inventory));
    setDealExpenses(Boolean(sel.expenses));
    setDealHistory(Boolean(sel.history_extended));
    setDealLock(deal?.lock_self_serve_changes ?? false);
    setDealNotes(deal?.notes || pendingReq?.notes || '');
    setDealPlanSource(hasDeal || pendingReq ? 'custom' : 'starter');
    setDealCityTier('tier_2');
    // When fulfilling an app request, leave activate off so they pay in-app.
    if (pendingReq && !hasDeal) {
      setDealActivate(false);
    }
  };

  const applyRestaurantPlanSource = (source: DealPlanSource) => {
    if (source === 'custom') {
      setDealPlanSource('custom');
      return;
    }
    const catalog = applyCatalogPlan(source, dealCityTier, {
      inventory: dealInventory,
      expenses: dealExpenses,
      history_extended: dealHistory,
    });
    setDealPlanSource(source);
    setDealMonthly(catalog.monthly_price);
    setDealAnnual(catalog.annual_price);
    setDealTables(catalog.max_tables);
    setDealExtraStaff(catalog.extra_staff);
    setDealExtraChefs(catalog.extra_chefs);
    setDealExtraManagers(catalog.extra_managers);
    setDealInventory(catalog.inventory);
    setDealExpenses(catalog.expenses);
    setDealHistory(catalog.history_extended);
    setDealNotes(catalog.deal_notes);
  };

  const applyRestaurantCityTier = (tier: CityTier) => {
    setDealCityTier(tier);
    if (dealPlanSource === 'custom') return;
    const catalog = applyCatalogPlan(dealPlanSource, tier, {
      inventory: dealInventory,
      expenses: dealExpenses,
      history_extended: dealHistory,
    });
    setDealMonthly(catalog.monthly_price);
    setDealAnnual(catalog.annual_price);
    setDealTables(catalog.max_tables);
    setDealExtraStaff(catalog.extra_staff);
    setDealExtraChefs(catalog.extra_chefs);
    setDealExtraManagers(catalog.extra_managers);
    setDealNotes(catalog.deal_notes);
  };

  const repriceRestaurantCatalog = (patch: {
    inventory?: boolean;
    expenses?: boolean;
    history_extended?: boolean;
    extra_staff?: string;
    extra_chefs?: string;
    extra_managers?: string;
  }) => {
    if (dealPlanSource === 'custom') return;
    const inventory = patch.inventory ?? dealInventory;
    const expenses = patch.expenses ?? dealExpenses;
    const history_extended = patch.history_extended ?? dealHistory;
    const extra_staff = patch.extra_staff ?? dealExtraStaff;
    const extra_chefs = patch.extra_chefs ?? dealExtraChefs;
    const extra_managers = patch.extra_managers ?? dealExtraManagers;
    const priced = repriceCatalogPlan(dealPlanSource as PlanBand, dealCityTier, {
      inventory,
      expenses,
      history_extended,
      extra_staff,
      extra_chefs,
      extra_managers,
    });
    setDealMonthly(priced.monthly_price);
    setDealAnnual(priced.annual_price);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRestaurant(id);
      const restaurant = data.restaurant;
      setDetail(restaurant);
      // Older tenants may omit selection / new fields (extra_chefs, expenses, pricing_mode).
      setSelection(emptyDealSelection(restaurant.selection));
      hydrateDealForm(restaurant);
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

  const hasPendingRequest = Boolean(detail.custom_deal_request_pending && detail.custom_deal_request);
  const hasActiveCustomDeal =
    (detail.pricing_mode || 'catalog') === 'custom' && Boolean(detail.custom_deal);

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
          value={detail.subscription_plan || '—'}
          sub={
            (detail.pricing_mode || 'catalog') === 'custom'
              ? 'Custom commercial deal'
              : 'Catalog pricing'
          }
        />
        <InfoCard label="Ends" value={formatDate(detail.subscription_end)} />
        <InfoCard
          label="Monthly (incl. 18% GST)"
          value={formatInr(detail.monthly_price_with_gst)}
          sub={`${formatInr(detail.monthly_price)} + GST`}
        />
        <InfoCard
          label="Orders this month"
          value={Number(detail.month_orders || 0).toLocaleString('en-IN')}
          sub="Dine-in + counter"
        />
        <InfoCard
          label="Revenue this month"
          value={formatInr(detail.month_revenue)}
          sub="Incl. GST"
        />
        <InfoCard
          label="Tables"
          value={`${detail.usage?.tables ?? detail.table_count ?? 0} / ${detail.limits?.max_tables ?? '—'}`}
        />
        <InfoCard
          label="Staff"
          value={String(detail.usage?.staff_and_chefs ?? detail.staff_count ?? 0)}
        />
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-white">Custom deal</h2>
            <p className="mt-1 text-sm text-slate-400">
              Negotiated price &amp; capacity. Catalog plans stay available until you apply a deal.
            </p>
          </div>
          {hasActiveCustomDeal ? (
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-200">
              Active deal
            </span>
          ) : hasPendingRequest ? (
            <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-medium text-orange-200">
              Awaiting quote
            </span>
          ) : (
            <span className="rounded-full bg-slate-700/60 px-3 py-1 text-xs font-medium text-slate-300">
              Catalog
            </span>
          )}
        </div>

        {hasPendingRequest && detail.custom_deal_request ? (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-orange-700/50 bg-orange-950/30 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-sm text-orange-100">
              <p className="font-medium">Customer asked for a custom plan</p>
              <p className="mt-1 text-orange-200/80">
                They can still use catalog upgrade/downgrade meanwhile. Paying for a catalog plan
                closes this request automatically. Or decline below if they should stay on catalog
                only.
              </p>
              {detail.custom_deal_request.contact_phone ? (
                <p className="mt-2 text-xs text-orange-200/70">
                  Phone: {detail.custom_deal_request.contact_phone}
                </p>
              ) : null}
              {detail.custom_deal_request.notes ? (
                <p className="mt-1 whitespace-pre-wrap text-xs text-orange-100/80">
                  {detail.custom_deal_request.notes}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={!!busy}
              onClick={async () => {
                if (
                  !window.confirm(
                    'Decline this request? The restaurant can keep using catalog Starter / Growth / Scale.'
                  )
                ) {
                  return;
                }
                const dismissReason =
                  reason.trim() ||
                  'Declined pending custom plan request — continue with catalog';
                setBusy('dismiss-request');
                setError('');
                setMessage('');
                try {
                  const res = await cancelCustomDealRequest(id, { reason: dismissReason });
                  setMessage(res.message || 'Request declined');
                  setReason('');
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Action failed');
                } finally {
                  setBusy('');
                }
              }}
              className="shrink-0 rounded-lg border border-orange-600/60 px-3 py-2 text-sm text-orange-100 hover:bg-orange-900/40 disabled:opacity-50"
            >
              {busy === 'dismiss-request' ? 'Declining…' : 'Decline → catalog'}
            </button>
          </div>
        ) : null}

        {hasActiveCustomDeal && detail.custom_deal ? (
          <p className="mt-3 text-sm text-amber-200/90">
            {formatInr(detail.custom_deal.monthly_price)}/mo
            {detail.custom_deal.set_by ? ` · set by ${detail.custom_deal.set_by}` : ''}
            {detail.custom_deal.lock_self_serve_changes
              ? ' · plan changes locked in app'
              : ' · customer can change plan in app'}
          </p>
        ) : null}

        <div className="mt-5 space-y-5">
          <DealPlanPresetPicker
            source={dealPlanSource}
            tier={dealCityTier}
            disabled={!!busy}
            onSourceChange={applyRestaurantPlanSource}
            onTierChange={applyRestaurantCityTier}
          />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-300">
                Monthly (₹) *
                <input
                  type="number"
                  min={1}
                  value={dealMonthly}
                  onChange={(e) => {
                    setDealPlanSource('custom');
                    setDealMonthly(e.target.value);
                  }}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                />
              </label>
              <label className="text-sm text-slate-300">
                Annual (₹, optional)
                <input
                  type="number"
                  min={0}
                  value={dealAnnual}
                  onChange={(e) => {
                    setDealPlanSource('custom');
                    setDealAnnual(e.target.value);
                  }}
                  placeholder="defaults to monthly × 11"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                />
              </label>
            </div>
            {dealPlanSource !== 'custom' ? (
              <p className="mt-2 text-xs text-slate-500">
                Editing price or tables switches to Custom. Add-ons reprice while a catalog plan is
                selected.
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capacity</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm text-slate-300">
                Tables
                <input
                  type="number"
                  min={5}
                  max={200}
                  value={dealTables}
                  onChange={(e) => {
                    setDealPlanSource('custom');
                    setDealTables(e.target.value);
                  }}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                />
              </label>
              <label className="text-sm text-slate-300">
                Extra staff
                <input
                  type="number"
                  min={0}
                  value={dealExtraStaff}
                  onChange={(e) => {
                    setDealExtraStaff(e.target.value);
                    repriceRestaurantCatalog({ extra_staff: e.target.value });
                  }}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                />
              </label>
              <label className="text-sm text-slate-300">
                Extra chefs
                <input
                  type="number"
                  min={0}
                  value={dealExtraChefs}
                  onChange={(e) => {
                    setDealExtraChefs(e.target.value);
                    repriceRestaurantCatalog({ extra_chefs: e.target.value });
                  }}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                />
              </label>
              <label className="text-sm text-slate-300">
                Extra managers
                <input
                  type="number"
                  min={0}
                  value={dealExtraManagers}
                  onChange={(e) => {
                    setDealExtraManagers(e.target.value);
                    repriceRestaurantCatalog({ extra_managers: e.target.value });
                  }}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                />
              </label>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <AddonToggle
                label="Inventory"
                checked={dealInventory}
                onChange={() => {
                  const next = !dealInventory;
                  setDealInventory(next);
                  repriceRestaurantCatalog({ inventory: next });
                }}
              />
              <AddonToggle
                label="Expenses"
                checked={dealExpenses}
                onChange={() => {
                  const next = !dealExpenses;
                  setDealExpenses(next);
                  repriceRestaurantCatalog({ expenses: next });
                }}
              />
              <AddonToggle
                label="Extended history (2yr)"
                checked={dealHistory}
                onChange={() => {
                  const next = !dealHistory;
                  setDealHistory(next);
                  repriceRestaurantCatalog({ history_extended: next });
                }}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">When you save</p>
            <div className="mt-2 space-y-2">
              <label
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${
                  !dealActivate
                    ? 'border-amber-600/70 bg-amber-950/40 text-amber-50'
                    : 'border-slate-700 bg-slate-950/40 text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="deal-apply-mode"
                  className="mt-1"
                  checked={!dealActivate}
                  onChange={() => setDealActivate(false)}
                />
                <span>
                  <span className="font-medium text-white">Send quote — customer pays in app</span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    Recommended for requests. Emails them when the deal is ready.
                  </span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${
                  dealActivate
                    ? 'border-amber-600/70 bg-amber-950/40 text-amber-50'
                    : 'border-slate-700 bg-slate-950/40 text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="deal-apply-mode"
                  className="mt-1"
                  checked={dealActivate}
                  onChange={() => setDealActivate(true)}
                />
                <span>
                  <span className="font-medium text-white">Activate now — already paid / comp</span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    Turns on paid access immediately. No in-app payment.
                  </span>
                </span>
              </label>
            </div>
            {dealActivate ? (
              <label className="mt-3 block max-w-xs text-sm text-slate-300">
                Access length (days, optional)
                <input
                  type="number"
                  min={0}
                  value={dealDurationDays}
                  onChange={(e) => setDealDurationDays(e.target.value)}
                  placeholder="Uses billing cycle if empty"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                />
              </label>
            ) : null}
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="mt-1"
                checked={dealLock}
                onChange={() => setDealLock((v) => !v)}
              />
                <span>
                  Lock upgrades in the app
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Optional. Blocks mid-cycle upgrades only. Customers can still schedule a catalog
                    downgrade for the next cycle. Pending requests are never locked.
                  </span>
                </span>
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              Internal notes
              <input
                value={dealNotes}
                onChange={(e) => setDealNotes(e.target.value)}
                placeholder="e.g. Pilot for chain HQ"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
              />
            </label>
          </div>
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
          label={dealActivate ? 'Activate custom deal' : 'Save quote & notify'}
          busy={busy === 'custom-deal'}
        />

        {hasActiveCustomDeal ? (
          <div className="mt-4 border-t border-slate-800 pt-4">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => {
                if (
                  !window.confirm(
                    'Remove this custom deal and switch the restaurant back to catalog pricing?'
                  )
                ) {
                  return;
                }
                return runAction('clear-deal', () =>
                  clearCustomDeal(id, { reason: reason.trim() || 'Cleared custom deal → catalog' })
                );
              }}
              className="text-sm text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline disabled:opacity-50"
            >
              {busy === 'clear-deal' ? 'Removing…' : 'Remove deal → back to catalog'}
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
        {Boolean(detail.limits?.is_legacy) ? (
          <p className="mt-2 text-sm text-amber-300">
            Legacy restaurant (pre-subscription config). Limits shown above are grandfathered.
            Saving catalog add-ons will migrate this restaurant onto the current Starter/Growth/Scale
            model.
          </p>
        ) : null}
        {(detail.pricing_mode || 'catalog') === 'custom' ? (
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
                  billing_cycle: 'quarterly',
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
