/**
 * Catalog plan presets for platform deal quoting.
 * Keep in sync with restaurant-api subscription_pricing.go
 * and BillGenieApp-new/src/config/subscriptionPricing.ts
 */

export type CityTier = 'tier_1' | 'tier_2' | 'tier_3';
export type PlanBand = 'starter' | 'growth' | 'scale';
export type DealPlanSource = PlanBand | 'custom';

export const ANNUAL_MULTIPLIER = 11;

export const PLAN_STARTER_TABLES = 10;
export const PLAN_GROWTH_TABLES = 18;
export const PLAN_SCALE_TABLES = 25;

export const BAND_SEATS: Record<PlanBand, { staff: number; chefs: number; managers: number }> = {
  starter: { staff: 2, chefs: 1, managers: 1 },
  growth: { staff: 4, chefs: 2, managers: 1 },
  scale: { staff: 5, chefs: 3, managers: 1 },
};

export const PLAN_MONTHLY_BY_TIER: Record<PlanBand, Record<CityTier, number>> = {
  starter: { tier_1: 1199, tier_2: 999, tier_3: 799 },
  growth: { tier_1: 1499, tier_2: 1299, tier_3: 1099 },
  scale: { tier_1: 1899, tier_2: 1599, tier_3: 1399 },
};

export const ADDON_PRICES = {
  history_extended: 99,
  inventory: 299,
  expenses: 79,
  extra_staff: 69,
  extra_chef: 69,
  extra_manager: 99,
} as const;

export const CITY_TIER_OPTIONS: Array<{ id: CityTier; label: string }> = [
  { id: 'tier_1', label: 'Tier 1 (metros)' },
  { id: 'tier_2', label: 'Tier 2' },
  { id: 'tier_3', label: 'Tier 3' },
];

export const PLAN_PRESETS: Array<{
  id: DealPlanSource;
  title: string;
  tables?: number;
  seats?: string;
  blurb: string;
}> = [
  {
    id: 'starter',
    title: 'Starter',
    tables: PLAN_STARTER_TABLES,
    seats: '2 staff · 1 chef · 1 manager',
    blurb: 'Up to 10 tables — catalog baseline',
  },
  {
    id: 'growth',
    title: 'Growth',
    tables: PLAN_GROWTH_TABLES,
    seats: '4 staff · 2 chefs · 1 manager',
    blurb: 'Up to 18 tables',
  },
  {
    id: 'scale',
    title: 'Scale',
    tables: PLAN_SCALE_TABLES,
    seats: '5 staff · 3 chefs · 1 manager',
    blurb: 'Up to 25 tables',
  },
  {
    id: 'custom',
    title: 'Custom',
    blurb: 'Negotiated price and capacity',
  },
];

export function tablesForPlanBand(band: PlanBand): number {
  switch (band) {
    case 'growth':
      return PLAN_GROWTH_TABLES;
    case 'scale':
      return PLAN_SCALE_TABLES;
    default:
      return PLAN_STARTER_TABLES;
  }
}

export function bandMonthlyForTier(band: PlanBand, tier: CityTier): number {
  return PLAN_MONTHLY_BY_TIER[band][tier] ?? PLAN_MONTHLY_BY_TIER[band].tier_2;
}

export function catalogMonthlyTotal(input: {
  band: PlanBand;
  tier: CityTier;
  inventory?: boolean;
  expenses?: boolean;
  history_extended?: boolean;
  extra_staff?: number;
  extra_chefs?: number;
  extra_managers?: number;
}): number {
  let monthly = bandMonthlyForTier(input.band, input.tier);
  if (input.inventory) monthly += ADDON_PRICES.inventory;
  if (input.expenses) monthly += ADDON_PRICES.expenses;
  if (input.history_extended) monthly += ADDON_PRICES.history_extended;
  monthly += Math.max(0, input.extra_staff || 0) * ADDON_PRICES.extra_staff;
  monthly += Math.max(0, input.extra_chefs || 0) * ADDON_PRICES.extra_chef;
  monthly += Math.max(0, input.extra_managers || 0) * ADDON_PRICES.extra_manager;
  return monthly;
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export type CatalogDealFields = {
  monthly_price: string;
  annual_price: string;
  max_tables: string;
  extra_staff: string;
  extra_chefs: string;
  extra_managers: string;
  inventory: boolean;
  expenses: boolean;
  history_extended: boolean;
  deal_notes: string;
};

/** Prefill deal fields from a catalog band (extras start at 0). */
export function applyCatalogPlan(
  band: PlanBand,
  tier: CityTier,
  addons?: Partial<Pick<CatalogDealFields, 'inventory' | 'expenses' | 'history_extended'>>
): CatalogDealFields {
  const inventory = Boolean(addons?.inventory);
  const expenses = Boolean(addons?.expenses);
  const history_extended = Boolean(addons?.history_extended);
  const monthly = catalogMonthlyTotal({
    band,
    tier,
    inventory,
    expenses,
    history_extended,
  });
  const seats = BAND_SEATS[band];
  return {
    monthly_price: String(monthly),
    annual_price: String(monthly * ANNUAL_MULTIPLIER),
    max_tables: String(tablesForPlanBand(band)),
    extra_staff: '0',
    extra_chefs: '0',
    extra_managers: '0',
    inventory,
    expenses,
    history_extended,
    deal_notes: `Catalog ${band} (${tier.replace('_', ' ')}) — includes ${seats.staff} staff, ${seats.chefs} chef(s), ${seats.managers} manager`,
  };
}

/** Reprice a catalog selection after addon toggles (keeps extras as entered). */
export function repriceCatalogPlan(
  band: PlanBand,
  tier: CityTier,
  fields: Pick<
    CatalogDealFields,
    | 'inventory'
    | 'expenses'
    | 'history_extended'
    | 'extra_staff'
    | 'extra_chefs'
    | 'extra_managers'
  >
): Pick<CatalogDealFields, 'monthly_price' | 'annual_price'> {
  const monthly = catalogMonthlyTotal({
    band,
    tier,
    inventory: fields.inventory,
    expenses: fields.expenses,
    history_extended: fields.history_extended,
    extra_staff: Number(fields.extra_staff) || 0,
    extra_chefs: Number(fields.extra_chefs) || 0,
    extra_managers: Number(fields.extra_managers) || 0,
  });
  return {
    monthly_price: String(monthly),
    annual_price: String(monthly * ANNUAL_MULTIPLIER),
  };
}
