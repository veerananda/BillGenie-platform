'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession } from '@/lib/api';

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    clearSession();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/restaurants" className="text-lg font-semibold text-emerald-400">
              BillGenie Platform
            </Link>
            <nav className="text-sm text-slate-400">
              <div className="flex items-center gap-4">
                <Link
                  href="/restaurants"
                  className={
                    pathname?.startsWith('/restaurants')
                      ? 'text-white'
                      : 'hover:text-white'
                  }
                >
                  Restaurants
                </Link>
                <Link
                  href="/support-issues"
                  className={
                    pathname?.startsWith('/support-issues')
                      ? 'text-white'
                      : 'hover:text-white'
                  }
                >
                  Support Issues
                </Link>
              </div>
            </nav>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

function phaseBadgeClass(phase: string, blocked: boolean) {
  if (blocked) return 'bg-red-900/50 text-red-200';
  if (phase === 'active') return 'bg-emerald-900/50 text-emerald-200';
  if (phase === 'trial') return 'bg-amber-900/50 text-amber-200';
  if (phase === 'pending_payment') return 'bg-orange-900/50 text-orange-200';
  return 'bg-slate-800 text-slate-300';
}

export function PhaseBadge({
  phase,
  blocked,
}: {
  phase: string;
  blocked: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${phaseBadgeClass(phase, blocked)}`}
    >
      {blocked ? 'blocked' : phase || 'unknown'}
    </span>
  );
}

export function BoolBadge({ value, trueLabel, falseLabel }: { value: boolean; trueLabel: string; falseLabel: string }) {
  const cls = value ? 'bg-emerald-900/50 text-emerald-200' : 'bg-slate-800 text-slate-300';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {value ? trueLabel : falseLabel}
    </span>
  );
}

export function formatDate(value: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
