'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlatformShell, formatDate } from '@/components/PlatformShell';
import { SupportScreenshotGallery } from '@/components/SupportScreenshotGallery';
import {
  PlatformSupportIssue,
  SupportIssueStatus,
  isLoggedIn,
  listSupportIssues,
  updateSupportIssue,
} from '@/lib/api';

import { getSupportIssueScreenshots, type SupportIssueScreenshot } from '@/lib/api';

const STATUS_OPTIONS: Array<{ value: SupportIssueStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

function statusClass(status: SupportIssueStatus) {
  if (status === 'resolved' || status === 'closed') return 'bg-emerald-900/50 text-emerald-200';
  if (status === 'in_progress') return 'bg-amber-900/50 text-amber-200';
  return 'bg-blue-900/50 text-blue-200';
}

function statusLabel(status: SupportIssueStatus) {
  return status === 'in_progress'
    ? 'In progress'
    : status.charAt(0).toUpperCase() + status.slice(1);
}

function normalizeResolution(value?: string) {
  return (value || '').trim();
}

function getIssueScreenshots(issue: PlatformSupportIssue) {
  if (issue.screenshots?.length) return issue.screenshots;
  if (issue.screenshot_data_url) {
    return [
      {
        data_url: issue.screenshot_data_url,
        name: issue.screenshot_name || 'screenshot',
        content_type: issue.screenshot_content_type || 'image/jpeg',
      },
    ];
  }
  return [];
}

export default function SupportIssuesPage() {
  const router = useRouter();
  const [items, setItems] = useState<PlatformSupportIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SupportIssueStatus | ''>('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [draftStatus, setDraftStatus] = useState<Record<string, SupportIssueStatus>>({});
  const [draftResolution, setDraftResolution] = useState<Record<string, string>>({});

  const [previewScreenshots, setPreviewScreenshots] = useState<SupportIssueScreenshot[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewIssueId, setPreviewIssueId] = useState<string | null>(null);

  const load = useCallback(async (next?: { search?: string; status?: SupportIssueStatus | '' }) => {
    setLoading(true);
    setError('');
    try {
      const data = await listSupportIssues({
        search: next?.search ?? search,
        status: next?.status ?? status,
        limit: 100,
      });
      setItems(data.issues || []);
      setTotal(data.total || 0);
      const nextStatus: Record<string, SupportIssueStatus> = {};
      const nextResolution: Record<string, string> = {};
      (data.issues || []).forEach((issue) => {
        nextStatus[issue.id] = issue.status;
        nextResolution[issue.id] = issue.resolution_note || '';
      });
      setDraftStatus(nextStatus);
      setDraftResolution(nextResolution);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load support issues');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  const openIssueScreenshots = async (issueId: string) => {
    setError('');
    setMessage('');
    setPreviewLoading(true);
    try {
      const res = await getSupportIssueScreenshots(issueId);
      setPreviewScreenshots(res?.screenshots ?? []);
      setPreviewIndex(0);
      setPreviewIssueId(issueId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load screenshots');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
  }, [router]);

  useEffect(() => {
    if (!isLoggedIn()) return;

    const handle = window.setTimeout(() => {
      load();
    }, 250);

    return () => window.clearTimeout(handle);
  }, [load]);

  const saveIssue = async (issue: PlatformSupportIssue) => {
    const nextStatus = draftStatus[issue.id] || issue.status;
    const nextResolution = normalizeResolution(draftResolution[issue.id]);
    if (
      nextStatus === issue.status &&
      nextResolution === normalizeResolution(issue.resolution_note)
    ) {
      return;
    }

    setBusyId(issue.id);
    setError('');
    setMessage('');
    try {
      const result = await updateSupportIssue(issue.id, {
        status: nextStatus,
        resolution_note: nextResolution,
      });
      setItems((prev) => prev.map((item) => (item.id === issue.id ? result.issue : item)));
      setDraftStatus((prev) => ({ ...prev, [issue.id]: result.issue.status }));
      setDraftResolution((prev) => ({ ...prev, [issue.id]: result.issue.resolution_note || '' }));
      setMessage(result.message || 'Support issue updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId('');
    }
  };

  const hasIssueChanges = (issue: PlatformSupportIssue) => {
    return (
      (draftStatus[issue.id] || issue.status) !== issue.status ||
      normalizeResolution(draftResolution[issue.id]) !== normalizeResolution(issue.resolution_note)
    );
  };

  return (
    <PlatformShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Support Issues</h1>
          <p className="text-sm text-slate-400">{total} customer reports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issue or restaurant…"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SupportIssueStatus | '')}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="mb-4 text-red-400">{error}</p> : null}
      {message ? <p className="mb-4 text-emerald-400">{message}</p> : null}
      {loading ? <p className="text-slate-400">Loading…</p> : null}

      <div className="space-y-4">
        {items.map((issue) => {
          const hasChanges = hasIssueChanges(issue);
          const issueScreenshots = getIssueScreenshots(issue);
          const screenshotCount =
            typeof issue.screenshot_count === 'number'
              ? issue.screenshot_count
              : issueScreenshots.length;

          return (
            <article key={issue.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-white">{issue.title}</h2>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(issue.status)}`}>
                    {statusLabel(issue.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  {issue.category} · {formatDate(issue.created_at)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {issue.restaurant_name || 'Restaurant'} {issue.restaurant_code ? `· ${issue.restaurant_code}` : ''}
                  {issue.reporter_name ? ` · ${issue.reporter_name}` : ''}
                  {issue.reporter_role ? ` (${issue.reporter_role})` : ''}
                </p>
              </div>
              {issue.restaurant_id ? (
                <Link href={`/restaurants/${issue.restaurant_id}`} className="text-sm text-emerald-400 hover:underline">
                  View restaurant
                </Link>
              ) : null}
            </div>

            <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-950/60 p-3 text-sm leading-6 text-slate-200">
              {issue.description}
            </p>

            {issueScreenshots.length > 0 ? (
              <SupportScreenshotGallery screenshots={issueScreenshots} />
            ) : screenshotCount > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openIssueScreenshots(issue.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                  disabled={previewLoading}
                >
                  View screenshots{screenshotCount > 1 ? ` (${screenshotCount})` : ''}
                </button>
              </div>
            ) : null}

            {previewIssueId === issue.id && previewScreenshots.length > 0 ? (
              <div className="mt-4">
                <SupportScreenshotGallery screenshots={previewScreenshots} />
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end">
              <label className="text-sm text-slate-300">
                Status
                <select
                  value={draftStatus[issue.id] || issue.status}
                  onChange={(e) =>
                    setDraftStatus((prev) => ({
                      ...prev,
                      [issue.id]: e.target.value as SupportIssueStatus,
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-white"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Resolution note
                <input
                  value={draftResolution[issue.id] || ''}
                  onChange={(e) =>
                    setDraftResolution((prev) => ({
                      ...prev,
                      [issue.id]: e.target.value,
                    }))
                  }
                  placeholder="Add an update customers can see"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-white"
                />
              </label>
              <button
                type="button"
                disabled={busyId === issue.id || !hasChanges}
                onClick={() => saveIssue(issue)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyId === issue.id ? 'Saving…' : hasChanges ? 'Save' : 'Saved'}
              </button>
            </div>
          </article>
          );
        })}
      </div>

      {!loading && items.length === 0 ? (
        <p className="rounded-xl border border-slate-800 px-4 py-8 text-center text-slate-500">
          No support issues found.
        </p>
      ) : null}
    </PlatformShell>
  );
}
