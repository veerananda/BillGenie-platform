'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlatformShell, formatDate } from '@/components/PlatformShell';
import { DealPlanPresetPicker } from '@/components/DealPlanPresetPicker';
import {
  applyCatalogPlan,
  repriceCatalogPlan,
  type CityTier,
  type DealPlanSource,
  type PlanBand,
} from '@/lib/catalogPlans';
import {
  AccountInviteStatus,
  PlatformAccountInvite,
  isLoggedIn,
  listAccountInvites,
  setAccountInviteDeal,
} from '@/lib/api';

const STATUS_OPTIONS: Array<{ value: AccountInviteStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'requested', label: 'Requested' },
  { value: 'priced', label: 'Priced' },
  { value: 'registered', label: 'Registered' },
  { value: 'closed', label: 'Closed' },
];

function statusClass(status: AccountInviteStatus) {
  if (status === 'registered') return 'bg-emerald-900/50 text-emerald-200';
  if (status === 'priced') return 'bg-amber-900/50 text-amber-200';
  if (status === 'closed') return 'bg-slate-700 text-slate-200';
  return 'bg-blue-900/50 text-blue-200';
}

type DealDraft = {
  plan_source: DealPlanSource;
  city_tier: CityTier;
  reason: string;
  monthly_price: string;
  annual_price: string;
  max_tables: string;
  extra_staff: string;
  extra_chefs: string;
  extra_managers: string;
  inventory: boolean;
  expenses: boolean;
  history_extended: boolean;
  lock_self_serve_changes: boolean;
  deal_notes: string;
  internal_note: string;
};

function emptyDeal(invite?: PlatformAccountInvite): DealDraft {
  const hasExisting = Boolean(invite?.monthly_price && invite.monthly_price > 0);
  if (hasExisting) {
    const monthly = String(invite!.monthly_price);
    const annual =
      invite!.annual_price && invite!.annual_price > 0
        ? String(invite!.annual_price)
        : String(Number(monthly) * 11);
    return {
      plan_source: 'custom',
      city_tier: 'tier_2',
      reason: 'Negotiated account invite deal',
      monthly_price: monthly,
      annual_price: annual,
      max_tables: String(invite!.max_tables || 10),
      extra_staff: String(invite!.extra_staff || 0),
      extra_chefs: String(invite!.extra_chefs || 0),
      extra_managers: String(invite!.extra_managers || 0),
      inventory: Boolean(invite!.inventory),
      expenses: Boolean(invite!.expenses),
      history_extended: Boolean(invite!.history_extended),
      lock_self_serve_changes: Boolean(invite!.lock_self_serve_changes),
      deal_notes: invite!.deal_notes || '',
      internal_note: invite!.internal_note || '',
    };
  }

  const catalog = applyCatalogPlan('starter', 'tier_2');
  return {
    plan_source: 'starter',
    city_tier: 'tier_2',
    reason: 'Catalog starter account invite deal',
    ...catalog,
    lock_self_serve_changes: false,
    internal_note: '',
  };
}

export default function AccountInvitesPage() {
  const router = useRouter();
  const [items, setItems] = useState<PlatformAccountInvite[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AccountInviteStatus | ''>('requested');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [drafts, setDrafts] = useState<Record<string, DealDraft>>({});
  const [issuedTokens, setIssuedTokens] = useState<Record<string, string>>({});

  const load = useCallback(
    async (next?: { search?: string; status?: AccountInviteStatus | '' }) => {
      setLoading(true);
      setError('');
      try {
        const data = await listAccountInvites({
          search: next?.search ?? search,
          status: next?.status ?? status,
          limit: 100,
        });
        setItems(data.invites || []);
        setTotal(data.total || 0);
        const nextDrafts: Record<string, DealDraft> = {};
        (data.invites || []).forEach((invite) => {
          nextDrafts[invite.id] = emptyDeal(invite);
        });
        setDrafts(nextDrafts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invites');
      } finally {
        setLoading(false);
      }
    },
    [search, status]
  );

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    void load();
  }, [load, router]);

  const updateDraft = (id: string, patch: Partial<DealDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || emptyDeal()), ...patch },
    }));
  };

  const applyPlanSource = (invite: PlatformAccountInvite, source: DealPlanSource) => {
    const current = drafts[invite.id] || emptyDeal(invite);
    if (source === 'custom') {
      updateDraft(invite.id, {
        plan_source: 'custom',
        reason: current.reason || 'Custom negotiated account invite deal',
      });
      return;
    }
    const catalog = applyCatalogPlan(source, current.city_tier, {
      inventory: current.inventory,
      expenses: current.expenses,
      history_extended: current.history_extended,
    });
    updateDraft(invite.id, {
      plan_source: source,
      ...catalog,
      reason: `Catalog ${source} account invite deal`,
    });
  };

  const applyCityTier = (invite: PlatformAccountInvite, tier: CityTier) => {
    const current = drafts[invite.id] || emptyDeal(invite);
    if (current.plan_source === 'custom') {
      updateDraft(invite.id, { city_tier: tier });
      return;
    }
    const catalog = applyCatalogPlan(current.plan_source, tier, {
      inventory: current.inventory,
      expenses: current.expenses,
      history_extended: current.history_extended,
    });
    updateDraft(invite.id, {
      city_tier: tier,
      ...catalog,
    });
  };

  const updateCatalogAwareField = (
    invite: PlatformAccountInvite,
    patch: Partial<DealDraft>
  ) => {
    const current = drafts[invite.id] || emptyDeal(invite);
    const next = { ...current, ...patch };
    if (next.plan_source !== 'custom') {
      const priced = repriceCatalogPlan(next.plan_source as PlanBand, next.city_tier, next);
      next.monthly_price = priced.monthly_price;
      next.annual_price = priced.annual_price;
    }
    updateDraft(invite.id, next);
  };

  const saveDeal = async (invite: PlatformAccountInvite) => {
    const draft = drafts[invite.id] || emptyDeal(invite);
    const monthly = Number(draft.monthly_price);
    if (!draft.reason.trim()) {
      setError('Reason is required');
      return;
    }
    if (!Number.isFinite(monthly) || monthly < 1) {
      setError('Monthly price must be at least 1');
      return;
    }

    setBusyId(invite.id);
    setError('');
    setMessage('');
    try {
      const result = await setAccountInviteDeal(invite.id, {
        reason: draft.reason.trim(),
        monthly_price: monthly,
        annual_price: Number(draft.annual_price) || monthly * 11,
        max_tables: Number(draft.max_tables) || 10,
        extra_staff: Number(draft.extra_staff) || 0,
        extra_chefs: Number(draft.extra_chefs) || 0,
        extra_managers: Number(draft.extra_managers) || 0,
        inventory: draft.inventory,
        expenses: draft.expenses,
        history_extended: draft.history_extended,
        lock_self_serve_changes: draft.lock_self_serve_changes,
        deal_notes: draft.deal_notes,
        internal_note: draft.internal_note,
      });
      setIssuedTokens((prev) => ({ ...prev, [invite.id]: result.register_token }));
      setMessage(
        `Deal saved for login ${result.login_id}. Copy the register token below — it is shown once.`
      );
      setExpandedId(invite.id);
      await load({ status: '' });
      setStatus('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set deal');
    } finally {
      setBusyId('');
    }
  };

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied`);
    } catch {
      setError(`Could not copy ${label}`);
    }
  };

  return (
    <PlatformShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Account Invites</h1>
          <p className="text-sm text-slate-400">
            {total} pre-register requests — set deal pricing and issue a one-time register token
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load({ search });
            }}
            placeholder="Search login ID, name, phone…"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <select
            value={status}
            onChange={(e) => {
              const next = e.target.value as AccountInviteStatus | '';
              setStatus(next);
              void load({ status: next });
            }}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 text-red-400">{error}</p> : null}
      {message ? <p className="mb-4 text-emerald-400">{message}</p> : null}
      {loading ? <p className="text-slate-400">Loading…</p> : null}

      <div className="space-y-4">
        {items.map((invite) => {
          const draft = drafts[invite.id] || emptyDeal(invite);
          const open = expandedId === invite.id;
          const token = issuedTokens[invite.id];
          const canPrice = invite.status === 'requested' || invite.status === 'priced';
          return (
            <article
              key={invite.id}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-medium text-white">{invite.restaurant_name}</h2>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(invite.status)}`}
                >
                  {invite.status}
                </span>
                <button
                  type="button"
                  onClick={() => void copyText('Login ID', invite.login_id)}
                  className="rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-mono text-emerald-200 hover:bg-emerald-900/70"
                >
                  Login {invite.login_id}
                </button>
                {invite.source ? (
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                    {invite.source}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-300">
                {invite.name} · {invite.phone}
              </p>
              <p className="mt-1 text-sm text-slate-400">{invite.address}</p>
              {(invite.city || invite.state) && (
                <p className="text-sm text-slate-500">
                  {[invite.city, invite.state].filter(Boolean).join(', ')}
                </p>
              )}
              {invite.notes ? (
                <p className="mt-2 text-sm text-slate-300">Notes: {invite.notes}</p>
              ) : null}
              {invite.monthly_price > 0 ? (
                <p className="mt-2 text-sm text-amber-200">
                  Deal ₹{invite.monthly_price.toLocaleString('en-IN')}/mo ·{' '}
                  {invite.max_tables} tables
                  {invite.has_register_token ? ' · token issued' : ''}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Requested {formatDate(invite.created_at)}
                {invite.updated_by ? ` · last updated by ${invite.updated_by}` : ''}
              </p>

              {token ? (
                <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3">
                  <p className="text-xs text-emerald-300">Register token (copy now — shown once)</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="break-all text-sm text-emerald-100">{token}</code>
                    <button
                      type="button"
                      onClick={() => void copyText('Register token', token)}
                      className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-200"
                    >
                      Copy token
                    </button>
                  </div>
                </div>
              ) : null}

              {canPrice ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? '' : invite.id)}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
                  >
                    {open ? 'Hide pricing' : invite.status === 'priced' ? 'Re-issue token' : 'Set deal & issue token'}
                  </button>
                </div>
              ) : null}

              {open && canPrice ? (
                <div className="mt-4 space-y-4">
                  <DealPlanPresetPicker
                    source={draft.plan_source}
                    tier={draft.city_tier}
                    disabled={busyId === invite.id}
                    onSourceChange={(source) => applyPlanSource(invite, source)}
                    onTierChange={(tier) => applyCityTier(invite, tier)}
                  />

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="text-xs text-slate-400 sm:col-span-2 lg:col-span-3">
                      Reason
                      <input
                        value={draft.reason}
                        onChange={(e) => updateDraft(invite.id, { reason: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Monthly ₹{draft.plan_source !== 'custom' ? ' (from catalog + add-ons)' : ''}
                      <input
                        value={draft.monthly_price}
                        onChange={(e) =>
                          updateDraft(invite.id, {
                            plan_source: 'custom',
                            monthly_price: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Annual ₹
                      <input
                        value={draft.annual_price}
                        onChange={(e) =>
                          updateDraft(invite.id, {
                            plan_source: 'custom',
                            annual_price: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Max tables
                      <input
                        value={draft.max_tables}
                        onChange={(e) =>
                          updateDraft(invite.id, {
                            plan_source: 'custom',
                            max_tables: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Extra staff
                      <input
                        value={draft.extra_staff}
                        onChange={(e) =>
                          updateCatalogAwareField(invite, { extra_staff: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Extra chefs
                      <input
                        value={draft.extra_chefs}
                        onChange={(e) =>
                          updateCatalogAwareField(invite, { extra_chefs: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Extra managers
                      <input
                        value={draft.extra_managers}
                        onChange={(e) =>
                          updateCatalogAwareField(invite, { extra_managers: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-300 sm:col-span-2 lg:col-span-3">
                      {(
                        [
                          ['inventory', 'Inventory'],
                          ['expenses', 'Expenses'],
                          ['history_extended', 'Extended history'],
                          ['lock_self_serve_changes', 'Lock self-serve changes'],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draft[key]}
                            onChange={(e) => {
                              if (key === 'lock_self_serve_changes') {
                                updateDraft(invite.id, { [key]: e.target.checked });
                                return;
                              }
                              updateCatalogAwareField(invite, { [key]: e.target.checked });
                            }}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {draft.plan_source !== 'custom' ? (
                      <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
                        Editing price or tables switches this deal to Custom. Add-ons and extras
                        reprice automatically while a catalog plan is selected.
                      </p>
                    ) : null}
                    <label className="text-xs text-slate-400 sm:col-span-2 lg:col-span-3">
                      Deal notes (customer-facing)
                      <input
                        value={draft.deal_notes}
                        onChange={(e) => updateDraft(invite.id, { deal_notes: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-slate-400 sm:col-span-2 lg:col-span-3">
                      Internal note
                      <input
                        value={draft.internal_note}
                        onChange={(e) => updateDraft(invite.id, { internal_note: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busyId === invite.id}
                      onClick={() => void saveDeal(invite)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 sm:col-span-2 lg:col-span-3"
                    >
                      {busyId === invite.id ? 'Saving…' : 'Save deal & issue register token'}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
        {!loading && items.length === 0 ? (
          <p className="text-slate-400">No invites match this filter.</p>
        ) : null}
      </div>
    </PlatformShell>
  );
}
