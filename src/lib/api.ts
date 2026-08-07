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
  is_email_verified: boolean;
  is_approved: boolean;
  monthly_price: number;
  monthly_price_with_gst: number;
  admin_count: number;
  staff_count: number;
  table_count: number;
  month_orders: number;
  month_revenue: number;
  created_at: string;
  custom_deal_request_pending?: boolean;
  requested_max_tables?: number;
}

export interface CustomDealRequest {
  max_tables: number;
  extra_staff: number;
  extra_chefs: number;
  extra_managers: number;
  inventory: boolean;
  expenses: boolean;
  history_extended: boolean;
  billing_cycle: string;
  notes?: string;
  contact_phone?: string;
  status: string;
  requested_at?: string | null;
}

export interface SubscriptionSelection {
  billing_cycle: string;
  operation_mode: string;
  max_tables: number;
  extra_staff: number;
  extra_chefs: number;
  extra_managers: number;
  history_extended: boolean;
  inventory: boolean;
  expenses: boolean;
  kitchen_dine_in: boolean;
  kitchen_counter: boolean;
}

export interface CustomLimitsOverride {
  max_tables?: number;
  max_staff?: number;
  max_chefs?: number;
  max_managers?: number;
  history_days?: number;
  inventory?: boolean;
  expenses?: boolean;
  kitchen_dine_in?: boolean;
  kitchen_counter?: boolean;
  dine_in_enabled?: boolean;
  counter_enabled?: boolean;
}

export interface CustomDeal {
  monthly_price: number;
  annual_price?: number;
  selection: SubscriptionSelection;
  limits_override?: CustomLimitsOverride | null;
  lock_self_serve_changes: boolean;
  notes?: string;
  set_by?: string;
  set_at?: string | null;
}

export interface PlatformRestaurantDetail extends PlatformRestaurantSummary {
  selection?: SubscriptionSelection | null;
  limits?: Record<string, unknown> | null;
  usage?: Record<string, number> | null;
  has_ever_paid: boolean;
  start_mode: string;
  pricing_mode?: string;
  custom_deal?: CustomDeal | null;
  custom_deal_request?: CustomDealRequest | null;
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
  custom_deal_pending?: boolean;
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.phase) q.set('phase', params.phase);
  if (params.custom_deal_pending) q.set('custom_deal_pending', 'true');
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

export type CustomPlanLeadStatus = 'pending' | 'contacted' | 'converted' | 'closed';

export interface PlatformCustomPlanLead {
  id: string;
  name: string;
  phone: string;
  restaurant_name: string;
  address: string;
  city?: string;
  state?: string;
  notes?: string;
  source?: string;
  status: CustomPlanLeadStatus;
  internal_note?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export async function listCustomPlanLeads(params: {
  search?: string;
  status?: CustomPlanLeadStatus | '';
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.status) q.set('status', params.status);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  return platformFetch<{
    leads: PlatformCustomPlanLead[];
    total: number;
  }>(`/platform/custom-plan-leads?${q.toString()}`);
}

export async function updateCustomPlanLead(
  id: string,
  body: { status: CustomPlanLeadStatus; internal_note?: string }
) {
  return platformFetch<{ message: string; lead: PlatformCustomPlanLead }>(
    `/platform/custom-plan-leads/${id}`,
    { method: 'PUT', body: JSON.stringify(body) }
  );
}

export type AccountInviteStatus = 'requested' | 'priced' | 'registered' | 'closed';

export interface PlatformAccountInvite {
  id: string;
  login_id: string;
  name: string;
  phone: string;
  restaurant_name: string;
  address: string;
  city?: string;
  state?: string;
  notes?: string;
  source?: string;
  status: AccountInviteStatus;
  internal_note?: string;
  monthly_price: number;
  annual_price: number;
  max_tables: number;
  extra_staff: number;
  extra_chefs: number;
  extra_managers: number;
  inventory: boolean;
  expenses: boolean;
  history_extended: boolean;
  lock_self_serve_changes: boolean;
  deal_notes?: string;
  has_register_token: boolean;
  register_token_expires_at?: string;
  restaurant_id?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export async function listAccountInvites(params: {
  search?: string;
  status?: AccountInviteStatus | '';
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.status) q.set('status', params.status);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  return platformFetch<{
    invites: PlatformAccountInvite[];
    total: number;
  }>(`/platform/account-invites?${q.toString()}`);
}

export async function setAccountInviteDeal(
  id: string,
  body: {
    reason: string;
    monthly_price: number;
    annual_price?: number;
    max_tables?: number;
    extra_staff?: number;
    extra_chefs?: number;
    extra_managers?: number;
    inventory?: boolean;
    expenses?: boolean;
    history_extended?: boolean;
    lock_self_serve_changes?: boolean;
    deal_notes?: string;
    internal_note?: string;
  }
) {
  return platformFetch<{
    message: string;
    invite: PlatformAccountInvite;
    register_token: string;
    login_id: string;
  }>(`/platform/account-invites/${id}/set-deal`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
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

export async function setCustomDeal(
  id: string,
  body: {
    reason: string;
    deal: CustomDeal;
    activate?: boolean;
    duration_days?: number;
  }
) {
  return platformFetch<{ message: string }>(
    `/platform/restaurants/${id}/custom-deal`,
    { method: 'PUT', body: JSON.stringify(body) }
  );
}

export async function clearCustomDeal(id: string, body: { reason: string }) {
  return platformFetch<{ message: string }>(
    `/platform/restaurants/${id}/custom-deal`,
    { method: 'DELETE', body: JSON.stringify(body) }
  );
}

export async function cancelCustomDealRequest(id: string, body: { reason: string }) {
  return platformFetch<{ message: string }>(
    `/platform/restaurants/${id}/cancel-custom-deal-request`,
    { method: 'POST', body: JSON.stringify(body) }
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

export async function approveRestaurant(id: string, body: { reason: string }) {
  return platformFetch<{ message: string }>(
    `/platform/restaurants/${id}/approve`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function resendVerificationEmail(id: string, body?: { reason?: string }) {
  return platformFetch<{ message: string }>(
    `/platform/restaurants/${id}/resend-verification`,
    { method: 'POST', body: JSON.stringify(body || {}) }
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
