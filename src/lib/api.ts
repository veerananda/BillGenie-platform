const BACKEND_API_BASE_URL =
  process.env.PLATFORM_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://billgenie-api.fly.dev';

/** Browser uses same-origin proxy to avoid CORS; server could call backend directly. */
function platformApiRoot(): string {
  if (typeof window !== 'undefined') {
    return '/api/platform';
  }
  return `${BACKEND_API_BASE_URL}/platform`;
}

export interface PlatformRestaurantSummary {
  id: string;
  restaurant_code: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string;
  city: string;
  subscription_plan: string;
  subscription_phase: string;
  subscription_end: string;
  days_remaining: number;
  is_active: boolean;
  is_access_blocked: boolean;
  monthly_price: number;
  admin_count: number;
  staff_count: number;
  table_count: number;
  created_at: string;
}

export interface SubscriptionSelection {
  billing_cycle: string;
  operation_mode: string;
  max_tables: number;
  extra_staff: number;
  extra_managers: number;
  history_extended: boolean;
  inventory: boolean;
  kitchen_dine_in: boolean;
  kitchen_counter: boolean;
}

export interface PlatformRestaurantDetail extends PlatformRestaurantSummary {
  selection: SubscriptionSelection;
  limits: Record<string, unknown>;
  usage: Record<string, number>;
  has_ever_paid: boolean;
  start_mode: string;
  is_self_service: boolean;
  counter_service_modes: string;
  admin_login_hint?: string;
  recent_renewals: Array<{
    id: string;
    status: string;
    total_inr: number;
    billing_cycle: string;
    created_at: string;
  }>;
}

function platformHeaders(): HeadersInit {
  if (typeof window === 'undefined') {
    return { 'Content-Type': 'application/json' };
  }
  const apiKey = sessionStorage.getItem('platform_api_key') || '';
  const actor = sessionStorage.getItem('platform_actor') || 'creator';
  return {
    'Content-Type': 'application/json',
    'X-Platform-Api-Key': apiKey,
    'X-Platform-Actor': actor,
  };
}

async function platformFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith('/platform/')
    ? path.slice('/platform'.length)
    : path;
  const res = await fetch(`${platformApiRoot()}${normalizedPath}`, {
    ...init,
    headers: {
      ...platformHeaders(),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function listRestaurants(params: {
  search?: string;
  phase?: string;
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.phase) q.set('phase', params.phase);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  return platformFetch<{
    restaurants: PlatformRestaurantSummary[];
    total: number;
  }>(`/platform/restaurants?${q.toString()}`);
}

export async function getRestaurant(id: string) {
  return platformFetch<{ restaurant: PlatformRestaurantDetail }>(
    `/platform/restaurants/${id}`
  );
}

export async function grantSubscription(
  id: string,
  body: {
    reason: string;
    billing_cycle?: string;
    duration_days?: number;
    selection?: Partial<SubscriptionSelection>;
  }
) {
  return platformFetch<{ message: string }>(
    `/platform/restaurants/${id}/grant-subscription`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function extendTrial(
  id: string,
  body: { reason: string; days?: number }
) {
  return platformFetch<{ message: string }>(
    `/platform/restaurants/${id}/extend-trial`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function updateSelection(
  id: string,
  body: { reason: string; selection: SubscriptionSelection }
) {
  return platformFetch<{ message: string }>(
    `/platform/restaurants/${id}/selection`,
    { method: 'PUT', body: JSON.stringify(body) }
  );
}

export async function setRestaurantActive(
  id: string,
  body: { reason: string; is_active: boolean }
) {
  return platformFetch<{ message: string }>(
    `/platform/restaurants/${id}/active`,
    { method: 'PUT', body: JSON.stringify(body) }
  );
}

export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(sessionStorage.getItem('platform_api_key'));
}

export function saveSession(apiKey: string, actor: string) {
  sessionStorage.setItem('platform_api_key', apiKey);
  sessionStorage.setItem('platform_actor', actor || 'creator');
}

export function clearSession() {
  sessionStorage.removeItem('platform_api_key');
  sessionStorage.removeItem('platform_actor');
}
