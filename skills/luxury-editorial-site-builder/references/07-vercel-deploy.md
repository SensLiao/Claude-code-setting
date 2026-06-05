# 07 — Vercel deploy

## Happy path (first deploy)

```bash
cd <project>
vercel deploy --prod --yes
```

That's it for a static site. The `--yes` flag accepts defaults (personal scope, project name = directory name, no overrides). Build takes ~13 seconds for the canonical 30-40 MB static project. Output:

```
Production: https://<dirname>-<hash>-<user>-projects.vercel.app
Aliased:    https://<dirname>.vercel.app
```

## Subsequent deploys

```bash
vercel deploy --prod --yes
```

Same command. Vercel reuses the project link from `.vercel/project.json`, builds with cache, typically <5s.

## Hidden ops via Vercel REST API

Some operations don't have CLI commands. The token lives at `~/Library/Application Support/com.vercel.cli/auth.json`.

```bash
VTOKEN=$(jq -r '.token' "$HOME/Library/Application Support/com.vercel.cli/auth.json")
TEAM=$(jq -r '.orgId' .vercel/project.json)
PROJ=$(jq -r '.projectId' .vercel/project.json)
```

### Rename project (preserve history)

CLI doesn't have rename. Either delete + recreate (loses deploy history) or PATCH via API:

```bash
curl -sS -X PATCH "https://api.vercel.com/v9/projects/${PROJ}?teamId=${TEAM}" \
  -H "Authorization: Bearer ${VTOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"newname"}'
```

After rename, also update local `.vercel/project.json`'s `projectName` field to match (otherwise CLI commands get confused).

### Disable SSO Protection (CRITICAL after rename)

By default, new Vercel projects enable `ssoProtection: { deploymentType: "all_except_custom_domains" }`. This means the original `*.vercel.app` short alias works fine, but any **newly added** alias returns 401 and requires Vercel SSO login.

After renaming or adding a new alias, disable SSO:

```bash
curl -sS -X PATCH "https://api.vercel.com/v9/projects/${PROJ}?teamId=${TEAM}" \
  -H "Authorization: Bearer ${VTOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"ssoProtection":null}'
```

### Add custom short alias

Vercel renaming a project does NOT auto-create a new short alias. After API rename, manually bind:

```bash
vercel alias set <full-deployment-url> <newname>.vercel.app
```

Where `<full-deployment-url>` is the most recent deployment URL (something like `newname-xyz123-user-projects.vercel.app`). Get it from `vercel ls` or the latest deploy output.

### Remove an alias

```bash
vercel alias rm <oldalias>.vercel.app --yes
```

After rename, this is how you retire the old `<oldname>.vercel.app` so it returns 404 instead of mirroring production.

## Custom domain (e.g., `u2living.com`)

```bash
vercel domains add u2living.com
```

Vercel returns DNS instructions:
- For root: A record pointing to `76.76.21.21`
- For www: CNAME pointing to `cname.vercel-dns.com`

After DNS propagates (~1-5 min), assign:

```bash
vercel alias set <full-deployment-url> u2living.com
```

SSL is automatic via Let's Encrypt. The custom domain is exempt from SSO Protection by default (that's what `all_except_custom_domains` literally means), so no API patch needed for custom domains.

## Full rename + clean slate flow

If you renamed a project (e.g. `morland-atelier` → `u2living`) and want to fully clean up:

```bash
# 1. Rename via API
VTOKEN=$(jq -r '.token' "$HOME/Library/Application Support/com.vercel.cli/auth.json")
TEAM=$(jq -r '.orgId' .vercel/project.json)
PROJ=$(jq -r '.projectId' .vercel/project.json)
curl -sS -X PATCH "https://api.vercel.com/v9/projects/${PROJ}?teamId=${TEAM}" \
  -H "Authorization: Bearer ${VTOKEN}" -H "Content-Type: application/json" \
  -d '{"name":"u2living"}'

# 2. Update local .vercel/project.json
sed -i '' 's/"projectName":"morland-atelier"/"projectName":"u2living"/' .vercel/project.json

# 3. Redeploy to get fresh deployment URL under new name
vercel deploy --prod --yes
# Note the deployment URL output, e.g., u2living-dyjpi73-user-projects.vercel.app

# 4. Bind new short alias
vercel alias set u2living-dyjpi73-user-projects.vercel.app u2living.vercel.app

# 5. Disable SSO Protection (new alias would return 401 otherwise)
curl -sS -X PATCH "https://api.vercel.com/v9/projects/${PROJ}?teamId=${TEAM}" \
  -H "Authorization: Bearer ${VTOKEN}" -H "Content-Type: application/json" \
  -d '{"ssoProtection":null}'

# 6. Verify
curl -s -o /dev/null -w "%{http_code}\n" https://u2living.vercel.app/    # → 200

# 7. Optionally remove old alias
vercel alias rm morland-atelier.vercel.app --yes
```

## When deploy fails

| Error | Cause | Fix |
|---|---|---|
| `Error: No team linked` | First-time setup didn't pick a team | `vercel link` then redeploy |
| `Error: File too large` | Single file > 100 MB (Vercel hobby limit) | Compress video / image; for U2 the H.264 fallback was 14 MB which is fine |
| `Error: Function size exceeds limit` | API routes > 50 MB (won't apply to pure static) | N/A for static |
| Deploy succeeds but `*.vercel.app` returns 401 | SSO Protection on new alias | API PATCH `ssoProtection: null` (see above) |
| Deploy succeeds but old short alias still serves | Vercel doesn't auto-retire on rename | `vercel alias rm <old>.vercel.app --yes` |

## Vercel project quotas (Hobby tier as of 2026-05)

- 100 GB bandwidth/month
- Unlimited static deploys
- 6000 build minutes/month
- 100 MB single-file limit
- Custom domains: unlimited
- SSL: automatic

For an editorial brand site this is essentially unlimited.

## Updating after deploy

For routine content/tweak updates:

```bash
vercel deploy --prod --yes
```

Build takes <5s with cache. Production updates are atomic — old deploy serves until new one ready, then alias flips.

## Preview deploys (don't touch prod)

For testing changes before going live:

```bash
vercel deploy   # no --prod flag
```

Outputs a unique URL like `<dirname>-git-branch-<user>-projects.vercel.app`. Doesn't affect production. Useful for sharing in-progress work with the user.
