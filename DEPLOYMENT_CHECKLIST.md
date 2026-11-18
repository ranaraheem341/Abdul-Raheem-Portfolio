# Deployment checklist — Step 15

Prepared 2026-11-16. **Preparation complete; public release blocked.** No deployment is authorized by this checklist. Steps 01–14 remain preserved in `PROGRESS.md`.

## Vercel prerequisites

- [ ] Owner approves deployment explicitly after outstanding release checks. Do not import/connect a repository, trigger a build, promote, or change DNS during this preparation; these can publish automatically.
- [ ] Select the intended Vercel account/project and production branch. Root Directory: repository root. `vercel.json` sets Next.js, `npm ci`, and `npm run build`. Keep framework-managed output/routing; do not use static export because `/api/contact` needs a Node.js function. Keep the lockfile and install build/dev dependencies.
- [ ] Select Node.js **26.x** in Project Settings to match this workspace's tested Node v26.13.1 (Next.js requires >=20.9.0). Vercel manages patch versions; its Linux build/runtime still require verification. No package/runtime version or dependency was changed here.
- [ ] Supply the production variables below before building; use Vercel's environment settings, not checked-in values. Changes require a new deployment; `SITE_URL` specifically requires rebuilding static metadata. Do not override `NODE_ENV` or add `NEXT_PUBLIC_` to any contact value.
- [ ] Choose one owner-approved HTTPS canonical domain, confirm DNS ownership/TLS, and redirect alternate public hosts to it before testing contact. The handler accepts exactly one configured origin; it does not infer trust from forwarded hosts or Vercel URL variables.
- [ ] Keep Preview environments protected with Vercel Authentication; use access protection for any prelaunch production candidate too. Leave Preview `SITE_URL` unset (noindex) and contact credentials unset by default. A contact-enabled preview needs a separate exact preview origin, test recipient/sender, dedicated keys and Redis database. Never share production quota/credentials with Preview. Do not disable access controls or weaken CSP to accommodate preview tooling.

Configuration references: [Vercel static configuration](https://vercel.com/docs/project-configuration/vercel-json), [supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [deployment protection](https://vercel.com/docs/deployment-protection). These settings are prepared locally; account/plan settings have not been inspected or changed.

## Required production environment

| Variable | Exact requirement | Missing/invalid behavior |
| --- | --- | --- |
| `SITE_URL` | Owner's HTTPS public origin; no credentials, path beyond `/`, query or fragment. Use the same origin as contact, without trailing slash for consistency. Set at build time. | Missing: noindex, omitted canonical/OG/Person URL and sitemap discovery, empty sitemap. Malformed/disallowed value throws during metadata generation/build. Not a build-time required-value gate: owner must check it. |
| `CONTACT_ALLOWED_ORIGIN` | Same exact HTTPS public origin, **no trailing slash**, path, query, fragment or credentials. | Valid submission with incomplete configuration: 503 without sending. Missing/unmatched request Origin: 403. |
| `RESEND_API_KEY` | Dedicated sending-permission key, no whitespace; retain server-side only. | Missing: 503 before any service request; invalid live credentials never report acceptance. |
| `CONTACT_FROM_EMAIL` | One bare sender mailbox on an owner-controlled, Resend-verified domain; complete provider DNS verification. | Missing/invalid syntax: 503. Domain verification is a provider prerequisite, not established by syntax validation. |
| `CONTACT_TO_EMAIL` | One owner-approved, verified destination mailbox. Separate from the public email link. | Missing/invalid syntax: 503; request data cannot replace the recipient. |
| `UPSTASH_REDIS_REST_URL` | HTTPS REST root on a hostname ending `.upstash.io`, no credentials, extra path, query or fragment. | Missing/invalid: 503 before any service request. |
| `UPSTASH_REDIS_REST_TOKEN` | Dedicated database REST token, no whitespace, permits EVAL/INCR/EXPIRE. | Missing: 503. Failed/malformed Redis HTTP response: 503 before email. Network exceptions/timeouts: 502 with unconfirmed wording, never success. |

Provider failures/unconfirmed email acceptance return 502. Only provider success with a message ID returns 200; it explicitly does not claim inbox receipt. The shared quota is 10 configured, valid submissions per 60 seconds, globally; excess returns 429 with `Retry-After: 60`. Source and existing tests verify fail-closed behavior; real credentials, connectivity and delivery remain unverified. See `CONTACT_SETUP.md` for limits, retention and timeout/duplicate-send caveats.

## Owner information checklist

- [ ] Verified public LinkedIn, GitHub and Fiverr URLs, plus approval of the public email address: `src/components/layout/navigation-config.ts`. Do not publish the private delivery recipient automatically.
- [ ] Original approved, public-safe CV PDF under `public/resume/`, approved download filename and evidence references; then configure `resume` in `src/components/credentials/credentials-data.ts`. Keep it null until the actual approved file exists.
- [ ] Education: qualification, institution, field, attendance dates, accurate completion status, supporting evidence and public-display approval.
- [ ] Credentials: name, issuer, accurate completed/in-progress status, applicable issue/expiry dates, evidence and approval; publish credential IDs/URLs only with separate approval. Records must satisfy the existing verified/evidence gate in `credentials-data.ts`.
- [ ] Approved project evidence remains outstanding from Step 14. Current honest empty states and disabled actions may remain if the owner accepts them; never invent content to populate them.

## Security and release gates

- [ ] Preserve `next.config.ts` protections: no X-Powered-By; CSP same-origin defaults, no unsafe-eval, no inline event handlers, no frames/objects/base changes, same-origin form actions; nosniff, DENY framing, referrer/permissions policies, and one-year production HSTS. Static hydration currently requires existing inline script/style allowances; this baseline is not complete inline-XSS protection. Do not add domains or relax directives to hide a warning.
- [ ] Confirm effective HTTPS/CDN headers on homepage **and API errors**, with no conflicting hosting overrides. HSTS only takes effect over HTTPS; do not add preload/includeSubDomains without reviewing every affected host.
- [ ] Verify hosting WAF/per-client rate controls and body/header/time limits before public traffic. App limits: 24 KiB streamed body, five-second body read, five-second Redis and ten-second email timeouts. Allow sufficient function duration for these sequential operations (at least 30 seconds); confirm supported project limits. Hosting controls must protect requests before the handler runs. Origin is spoofable by non-browser clients; the global quota can be exhausted by attackers. No WAF/paid-service configuration was performed.
- [ ] Confirm private logs do not capture inquiry bodies/secrets and review hosting, Redis, provider and mailbox access/retention. Keep secrets outside source control; rotate any exposed credential.
- [ ] Complete outstanding manual browser acceptance: 320/375/400px, tablet/desktop, reflow/overflow/header/anchors, keyboard/menu/resize, form focus/status/loading, screen reader, hydration/console and actual CSP enforcement. Investigate the historical unattributed CSP/eval warning without weakening policy. No browser checks were performed in Step 15.

## Verification commands and acceptance

From the repository root in PowerShell, after approved environment setup, run each once for a release candidate:

```powershell
node --version
npm.cmd ci
npm.cmd run lint
npm.cmd run build
node --test tests/contact.test.mjs
git diff --check
```

Do not run `npm ci` on this existing workspace merely to repeat validation; it is the clean checkout/hosting install prerequisite. All commands must exit 0. Contact tests mock both services and never verify inbox delivery. A successful build with no `SITE_URL` is intentionally possible and is **not** launch approval.

For a local production review, use `npm.cmd run start -- --port 3001` in a separate terminal; stop it with Ctrl+C afterward. After an explicitly approved deployment, use the actual canonical HTTPS origin for `$releaseOrigin` below. These read-only probes do not send email:

```powershell
$releaseOrigin = Read-Host 'Verified canonical HTTPS origin, no trailing slash'
curl.exe --fail-with-body -sS -D - "$releaseOrigin/" -o NUL
curl.exe --fail-with-body -sS "$releaseOrigin/robots.txt"
curl.exe --fail-with-body -sS "$releaseOrigin/sitemap.xml"
curl.exe -sS -D - -X POST "$releaseOrigin/api/contact" -H 'Content-Type: application/json' --data-binary '{}'
```

Expect homepage/robots/sitemap 200; the last probe intentionally omits Origin and must return 403 with `Cache-Control: no-store` and security headers (curl itself does not enforce the expected status). Verify canonical/OG/Person URLs match the real origin, indexing is enabled, sitemap has exactly the homepage, and robots advertises it while excluding `/api/`. On a protected candidate, authenticate through approved access rather than disabling protection; an access-gate response does not verify application headers.

With owner-approved test traffic after deployment: send one dummy inquiry through the form and confirm Redis limiting and actual inbox receipt; do not treat provider acceptance alone as delivery. Validate missing-service/limiter/provider failure behavior in an isolated environment using the existing tests, not by removing live production services. Controlled quota verification needs an isolated database/test mailbox to avoid exhausting public capacity or sending unwanted mail. Confirm 429/Retry-After and that no email is sent when Redis rejects. Finish the manual browser gates above before launch acceptance.

## Rollback — future operator procedure, not executed

1. Before an approved release, record the current known-good deployment ID/URL, canonical domain assignments, environment variable names/versions (no secret values in this file), and hosting/security settings. Retain that deployment and confirm operator rollback access.
2. If a release breaks delivery, SEO, security headers or runtime behavior, pause further automatic releases. In Vercel project Overview, select **Instant Rollback**, choose the known-good production deployment, review affected domains, then confirm. Check available rollback targets/permissions before release; do not assume every historical deployment is eligible. See [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback).
3. Rollback restores a prior build/configuration; project environment edits are not retroactively applied to it. Verify that build's SITE_URL, contact origin, credential validity and effective headers. Provider/DNS/WAF changes are external and need separate restoration. Never restore a revoked/leaked key; build a corrected candidate with a safe replacement. Redis counters and already accepted emails cannot be undone by rollback; do not clear the limiter or resend inquiries automatically.
4. Repeat homepage/SEO/header probes and one approved dummy inbox check. Record the incident and fix before the next release. For the **first deployment**, if there is no known-good target, keep/reapply deployment access protection and remove public exposure through approved hosting/domain controls until a corrected candidate is verified. No Git reset, force push or automatic redeployment is part of this preparation.

## Step 15 validation record

`npm.cmd run lint`: PASS; `npm.cmd run build`: PASS (static homepage/SEO routes, dynamic contact); `node --test tests/contact.test.mjs`: PASS, 13 tests, 0 failures. Each ran once after adding `vercel.json`. Missing/unsafe contact configuration and failed limiter/provider cases pass with mocked services; live delivery remains unverified. Step 14's HTTP/SEO/security results are reused without rerunning those checks. No application code, security policy, owner content or service credentials changed. No deployment, paid-service setup, browser, commit or push performed.

## Admin 05 deployment additions (2026-11-17)

These additions supersede the earlier static content configuration instructions for managed database content. Historical Step 15 validation remains historical; current Admin 05 results are in `PROGRESS.md`.

- [ ] Apply Supabase migrations 001-005 in order and run all five owner SQL acceptance scripts from `SUPABASE_SETUP.md`. Review the published database rows before enabling public reads; migration 003/004 preserved existing record rows as published. Publish profile explicitly. Existing unclassified media stays private.
- [ ] Set server-only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for text integration. Keep `SUPABASE_ADMIN_USER_ID` and the matching private allowlist for admin access. Add `SUPABASE_SECRET_KEY` only for approved photo/CV/screenshots; it is a privileged server-only asset download credential. Do not use public-prefixed names or ship keys in source. Missing text configuration serves safe original fallback; missing asset secret hides managed files.
- [ ] Enter owner-approved links, profile, experience, skills, projects, education and certifications through `/admin`, then publish. Upload and inspect an actual public-safe photo/CV/screenshots, then publish each separately. Publishing constitutes display approval; it does not independently verify achievements or sanitize PDFs. Static evidence-gated records remain only the unconfigured fallback. Private contact delivery addresses are never automatically published.
- [ ] Confirm hosting supports dynamic homepage rendering and `/api/media/[id]`. Preserve no-store on public asset responses and dynamic HTML; disable CDN/hosting overrides that cache them. Do not use static export or image optimization for these managed files. Keep the bucket private; never add public/signed URL delivery. Successful publication/revocation invalidates the root layout; a fresh request reads current published state. Open pages require reload/navigation.
- [ ] Verify anonymous draft/archive/tombstone/legacy denial through metadata APIs and known asset UUIDs, approved file display/download, replacement withdrawal and project archival. Direct Storage APIs and signed URL creation must remain denied to anonymous/non-admin clients. A previously downloaded file cannot be recalled. Verify the server secret never appears in HTML, JavaScript, redirects, errors or logs.
- [ ] Preserve `SITE_URL`, SEO/indexing, CSP, contact origin/Redis/provider gates and manual acceptance requirements above. Public integration does not resolve missing owner facts, live RLS/Storage/CRUD verification, delivery verification or historical browser checks.

Current focused validation command: `node --test tests/admin-auth.test.mjs tests/admin-profile.test.mjs tests/admin-records.test.mjs tests/admin-media.test.mjs tests/contact.test.mjs tests/public-portfolio.test.mjs`, alongside `npm.cmd run lint` and `npm.cmd run build`. Boundary mocks and SQL source assertions do not replace live Supabase acceptance. No deployment, commit or push was performed.
