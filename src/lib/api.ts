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

export type SupportIssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportIssueScreenshot {
  data_url: string;
  name: string;
  content_type: string;
}

export interface PlatformSupportIssue {
  id: string;
  restaurant_id: string;
  restaurant_name?: string;
  restaurant_code?: string;
  user_id?: string;
  reporter_name?: string;
  reporter_role?: string;
  category: 'query' | 'problem' | 'other';
  title: string;
  description: string;
  screenshot_count?: number;
  screenshot_data_url?: string;
  screenshot_name?: string;
  screenshot_content_type?: string;
  screenshots?: SupportIssueScreenshot[];
  status: SupportIssueStatus;
  resolution_note?: string;
  resolved_by?: string;
  resolved_at?: string | null;
  created_at: string;
  updated_at?: string;
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

export async function listSupportIssues(params: {
  search?: string;
  status?: SupportIssueStatus | '';
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.status) q.set('status', params.status);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  return platformFetch<{
    issues: PlatformSupportIssue[];
    total: number;
  }>(`/platform/support-issues?${q.toString()}`);
}

export async function getSupportIssueScreenshots(issueId: string): Promise<{
  screenshots: SupportIssueScreenshot[];
}> {
  return platformFetch<{ screenshots: SupportIssueScreenshot[] }>(
    `/platform/support-issues/${issueId}/screenshots`
  );
}

export async function updateSupportIssue(
  id: string,
  body: { status: SupportIssueStatus; resolution_note?: string }
) {
  return platformFetch<{ message: string; issue: PlatformSupportIssue }>(
    `/platform/support-issues/${id}`,
    { method: 'PUT', body: JSON.stringify(body) }
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

export async function deleteRestaurant(
  id: string,
  body: { reason: string; confirm_name: string }
) {
  return platformFetch<{ message: string }>(`/platform/restaurants/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(body),
  });
}

export interface BulkMenuUploadRow {
  category: string;
  type: string;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  is_readily_available: boolean;
}

export interface BulkRecipeUploadRow {
  category: string;
  type: string;
  ingredient_name: string;
  unit: string;
  quantity: number;
}

export interface BulkRowError {
  row: number;
  field?: string;
  message: string;
}

export interface BulkMenuResult {
  created: number;
  updated: number;
  skipped: number;
  errors: BulkRowError[];
}

export interface BulkRecipesResult {
  menus_updated: number;
  ingredients_created: number;
  recipe_lines_created: number;
  errors: BulkRowError[];
}

export async function bulkUploadMenu(
  id: string,
  body: { reason: string; items: BulkMenuUploadRow[] }
) {
  return platformFetch<{ message: string; result: BulkMenuResult }>(
    `/platform/restaurants/${id}/menu/bulk`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function bulkUploadRecipes(
  id: string,
  body: { reason: string; items: BulkRecipeUploadRow[] }
) {
  return platformFetch<{ message: string; result: BulkRecipesResult }>(
    `/platform/restaurants/${id}/recipes/bulk`,
    { method: 'POST', body: JSON.stringify(body) }
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
