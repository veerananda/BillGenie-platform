'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlatformShell, formatDate } from '@/components/PlatformShell';
import {
  CustomPlanLeadStatus,
  PlatformCustomPlanLead,
  isLoggedIn,
  listCustomPlanLeads,
  updateCustomPlanLead,
} from '@/lib/api';

const STATUS_OPTIONS: Array<{ value: CustomPlanLeadStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

function statusClass(status: CustomPlanLeadStatus) {
  if (status === 'converted') return 'bg-emerald-900/50 text-emerald-200';
  if (status === 'contacted') return 'bg-amber-900/50 text-amber-200';
  if (status === 'closed') return 'bg-slate-700 text-slate-200';
  return 'bg-blue-900/50 text-blue-200';
}

export default function CustomPlanLeadsPage() {
  const router = useRouter();
  const [items, setItems] = useState<PlatformCustomPlanLead[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CustomPlanLeadStatus | ''>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [draftStatus, setDraftStatus] = useState<Record<string, CustomPlanLeadStatus>>({});
  const [draftNote, setDraftNote] = useState<Record<string, string>>({});

  const load = useCallback(
    async (next?: { search?: string; status?: CustomPlanLeadStatus | '' }) => {
      setLoading(true);
      setError('');
      try {
        const data = await listCustomPlanLeads({
          search: next?.search ?? search,
          status: next?.status ?? status,
          limit: 100,
        });
        setItems(data.leads || []);
        setTotal(data.total || 0);
        const nextStatus: Record<string, CustomPlanLeadStatus> = {};
        const nextNote: Record<string, string> = {};
        (data.leads || []).forEach((lead) => {
          nextStatus[lead.id] = lead.status;
          nextNote[lead.id] = lead.internal_note || '';
        });
        setDraftStatus(nextStatus);
        setDraftNote(nextNote);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load leads');
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

  const saveLead = async (lead: PlatformCustomPlanLead) => {
    setBusyId(lead.id);
    setError('');
    setMessage('');
    try {
      await updateCustomPlanLead(lead.id, {
        status: draftStatus[lead.id] || lead.status,
        internal_note: draftNote[lead.id] || '',
      });
      setMessage('Lead updated');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lead');
    } finally {
      setBusyId('');
    }
  };

  return (
    <PlatformShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Custom Plan Leads</h1>
          <p className="text-sm text-slate-400">
            {total} signup inquiries — no account created yet
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load({ search });
            }}
            placeholder="Search name, phone, restaurant…"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <select
            value={status}
            onChange={(e) => {
              const next = e.target.value as CustomPlanLeadStatus | '';
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
        {items.map((lead) => {
          const dirty =
            draftStatus[lead.id] !== lead.status ||
            (draftNote[lead.id] || '') !== (lead.internal_note || '');
          return (
            <article
              key={lead.id}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-medium text-white">{lead.restaurant_name}</h2>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(lead.status)}`}
                >
                  {lead.status}
                </span>
                {lead.source ? (
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                    {lead.source}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-300">
                {lead.name} · {lead.phone}
              </p>
              <p className="mt-1 text-sm text-slate-400">{lead.address}</p>
              {(lead.city || lead.state) && (
                <p className="text-sm text-slate-500">
                  {[lead.city, lead.state].filter(Boolean).join(', ')}
                </p>
              )}
              {lead.notes ? (
                <p className="mt-2 text-sm text-slate-300">Notes: {lead.notes}</p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Submitted {formatDate(lead.created_at)}
                {lead.updated_by ? ` · last updated by ${lead.updated_by}` : ''}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto]">
                <select
                  value={draftStatus[lead.id] || lead.status}
                  onChange={(e) =>
                    setDraftStatus((prev) => ({
                      ...prev,
                      [lead.id]: e.target.value as CustomPlanLeadStatus,
                    }))
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  {STATUS_OPTIONS.filter((o) => o.value).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={draftNote[lead.id] || ''}
                  onChange={(e) =>
                    setDraftNote((prev) => ({ ...prev, [lead.id]: e.target.value }))
                  }
                  placeholder="Internal note"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  disabled={!dirty || busyId === lead.id}
                  onClick={() => void saveLead(lead)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  {busyId === lead.id ? 'Saving…' : 'Save'}
                </button>
              </div>
            </article>
          );
        })}
        {!loading && items.length === 0 ? (
          <p className="text-slate-400">No leads match this filter.</p>
        ) : null}
      </div>
    </PlatformShell>
  );
}
