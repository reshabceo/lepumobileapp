# Junction CGM — Developer quick reference

> **Full guide:** See [ABBOTT_CGM_SETUP.md](./ABBOTT_CGM_SETUP.md) for complete end-to-end documentation (Libre app, Monitraq, troubleshooting, India/EU region guidance).

## Deploy

```bash
supabase secrets set JUNCTION_API_KEY=...
supabase secrets set JUNCTION_WEBHOOK_SECRET=whsec_...
supabase secrets set JUNCTION_API_BASE_URL=https://api.sandbox.eu.junction.com   # EU / India
supabase secrets set JUNCTION_LIBRE_PROVIDER=freestyle_libre
supabase secrets set JUNCTION_LIBRE_REGION=in                                    # India

supabase db push
supabase functions deploy create-junction-link
supabase functions deploy junction-webhook --no-verify-jwt
```

## Webhook URL

```
https://YOUR_PROJECT.supabase.co/functions/v1/junction-webhook
```

Events: `provider.connection.created`, `provider.connection.error`, `daily.data.glucose.created`, `daily.data.glucose.updated`, `historical.data.glucose.created`

## India patients

Use **EU Junction team** — US sandbox cannot match India LibreView emails.
