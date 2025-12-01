# Supabase Edge Functions

This directory contains Supabase Edge Functions that run on Deno runtime.

## Available Functions

### `auto-release-payments`

Automatically releases payments for jobs that have passed their 10-day review period.

**Trigger:** Scheduled via pg_cron (every 15 minutes)  
**Runtime:** Deno  
**Documentation:** [AUTO_RELEASE_EDGE_FUNCTION_COMPLETE.md](../../AUTO_RELEASE_EDGE_FUNCTION_COMPLETE.md)

---

## Development

### Prerequisites

```bash
npm install -g supabase
```

### Local Testing

```bash
# Start all functions
npx supabase functions serve

# Start specific function
npx supabase functions serve auto-release-payments
```

### Deploy

```bash
# Deploy all functions
npx supabase functions deploy

# Deploy specific function
npx supabase functions deploy auto-release-payments
```

---

## Environment Variables

Set via Supabase Dashboard or CLI:

```bash
npx supabase secrets set VARIABLE_NAME=value
```

**Required for auto-release-payments:**
- `CRON_SECRET` - Authentication token
- `APP_URL` - Production app URL
- `SERVICE_AUTH_TOKEN` - Internal API token
- `ADMIN_WALLET` - Admin notification wallet

---

## Logs

View logs in real-time:

```bash
npx supabase functions logs auto-release-payments --tail
```

---

## More Info

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)


