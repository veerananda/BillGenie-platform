'use client';

import {
  CITY_TIER_OPTIONS,
  PLAN_PRESETS,
  formatInr,
  bandMonthlyForTier,
  type CityTier,
  type DealPlanSource,
  type PlanBand,
} from '@/lib/catalogPlans';

type Props = {
  source: DealPlanSource;
  tier: CityTier;
  onSourceChange: (source: DealPlanSource) => void;
  onTierChange: (tier: CityTier) => void;
  disabled?: boolean;
};

export function DealPlanPresetPicker({
  source,
  tier,
  onSourceChange,
  onTierChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Start from
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Starter / Growth / Scale are view-only catalog presets. Switch to Custom to change price,
          capacity, extras, or add-ons.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_PRESETS.map((preset) => {
            const active = source === preset.id;
            const listPrice =
              preset.id !== 'custom'
                ? bandMonthlyForTier(preset.id as PlanBand, tier)
                : null;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                onClick={() => onSourceChange(preset.id)}
                className={`rounded-xl border px-3 py-3 text-left transition-colors disabled:opacity-50 ${
                  active
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-50'
                    : 'border-slate-700 bg-slate-950/50 text-slate-200 hover:border-slate-500'
                }`}
              >
                <p className="text-sm font-semibold">{preset.title}</p>
                <p className="mt-1 text-xs text-slate-400">{preset.blurb}</p>
                {preset.seats ? (
                  <p className="mt-1 text-[11px] text-slate-500">{preset.seats}</p>
                ) : null}
                {listPrice != null ? (
                  <p className="mt-2 text-xs font-medium text-emerald-300">
                    from {formatInr(listPrice)}/mo
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-medium text-amber-300">Set any price</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {source !== 'custom' ? (
        <label className="block max-w-xs text-xs text-slate-400">
          City tier (catalog list price)
          <select
            value={tier}
            disabled={disabled}
            onChange={(e) => onTierChange(e.target.value as CityTier)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            {CITY_TIER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
