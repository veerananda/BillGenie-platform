# BillGenie Platform Console

Internal web app for BillGenie creators to manage restaurant tenants: subscriptions, trials, add-ons, and account status.

## Stack

- **UI:** Next.js 16 + TypeScript + Tailwind
- **API:** Existing Go API at `/platform/*` on `restaurant-api`

## Setup

```bash
cd billgenie-platform
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000/login

## Environment

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | API base URL (default: `https://billgenie-api.fly.dev`) |

## Backend requirement

Set on Fly / local API:

```bash
PLATFORM_OPS_API_KEY=<long-random-secret>
```

Sign in to the console with that key. Optional header `X-Platform-Actor` is sent as your name for audit logs.

## API routes (creators only)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/platform/restaurants` | List/search tenants |
| GET | `/platform/restaurants/:id` | Tenant detail |
| POST | `/platform/restaurants/:id/grant-subscription` | Comp / pilot activation |
| POST | `/platform/restaurants/:id/extend-trial` | Extend trial |
| PUT | `/platform/restaurants/:id/selection` | Update add-ons & limits |
| PUT | `/platform/restaurants/:id/active` | Suspend / reactivate |

All actions require `reason` and are written to `audit_logs`.

## Security notes

- Do not commit API keys or expose the console publicly without SSO/VPN.
- Rotate `PLATFORM_OPS_API_KEY` periodically.
- Prefer IP allowlist on Fly for `/platform` in production.
