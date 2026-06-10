---
paths:
  - "**/*.html"
  - "**/*.css"
  - "**/*.scss"
  - "**/*.jsx"
  - "**/*.tsx"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/*.astro"
---
> This file extends [common/security.md](../common/security.md) with web-specific security content.

# Web Security Rules

## Row Level Security (Supabase / Postgres)

- Enable RLS on every table — no exceptions; `ALTER TABLE foo ENABLE ROW LEVEL SECURITY;`
- Write a separate policy for each operation × role combination (select/insert/update/delete × anon/authenticated); never collapse them into one permissive policy
- Never include `service_role` key in frontend or client bundles — it bypasses RLS entirely
- Restrict `anon` key to the minimum read permissions required by public surfaces; default-deny all writes
- Bind row ownership with `auth.uid()` in policy `USING` / `WITH CHECK` expressions so users can only touch their own rows
- Test every policy in both directions: a fixture that should be allowed must pass, a fixture that should be denied must be rejected
- Apply the same design discipline to Storage bucket policies as to table RLS — public buckets are opt-in, not default
- RLS migration statements must live in the same PR and same migration file as the table definition they protect; never ship a table without its policies

## Content Security Policy

Always configure a production CSP.

### Nonce-Based CSP

Use a per-request nonce for scripts instead of `'unsafe-inline'`.

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{RANDOM}' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://*.example.com;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
```

Adjust origins to the project. Do not cargo-cult this block unchanged.

## XSS Prevention

- Never inject unsanitized HTML
- Avoid `innerHTML` / `dangerouslySetInnerHTML` unless sanitized first
- Escape dynamic template values
- Sanitize user HTML with a vetted local sanitizer when absolutely necessary

## Third-Party Scripts

- Load asynchronously
- Use SRI when serving from a CDN
- Audit quarterly
- Prefer self-hosting for critical dependencies when practical

## HTTPS and Headers

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Forms

- CSRF protection on state-changing forms
- Rate limiting on submission endpoints
- Validate client and server side
- Prefer honeypots or light anti-abuse controls over heavy-handed CAPTCHA defaults
