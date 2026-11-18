# Contact form setup — Step 10

The form is implemented but live delivery is **not configured or tested**. No owner email or social destination has been supplied. The endpoint returns 503 for valid inquiries until all required settings are available. It never saves messages or reports a fake success.

Copy `.env.example` to `.env.local` for local use. Supply server-side deployment environment variables for production; never prefix these values with `NEXT_PUBLIC_`:

| Variable | Required value |
| --- | --- |
| `CONTACT_ALLOWED_ORIGIN` | Exact public HTTPS origin, no path or trailing slash. Non-production permits HTTP localhost/127.0.0.1. |
| `RESEND_API_KEY` | Sending-permission Resend API key. |
| `CONTACT_FROM_EMAIL` | Owner-approved single bare mailbox on a Resend-verified sending domain. |
| `CONTACT_TO_EMAIL` | Owner-approved, verified recipient mailbox. Requests cannot override it. |
| `UPSTASH_REDIS_REST_URL` | HTTPS REST root URL ending in `.upstash.io`. |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only Redis token permitted to execute EVAL/INCR/EXPIRE. |

No account was created, paid service configured, or external email sent. Provisioning and verification remain owner/deployment tasks. Public LinkedIn/GitHub/Fiverr/Email links remain nullable in `src/components/layout/navigation-config.ts`; enable only verified destinations. The private delivery recipient is never automatically published as a contact link.

## Delivery behavior

Uses native `fetch` against the [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email), without extra packages. Sender and destination are fixed by environment; the validated visitor mailbox is reply-to. The template is plain text; no user HTML or raw email headers are constructed. A 200 response requires provider HTTP success and a nonempty message ID. UI wording says provider acceptance, explicitly leaving inbox delivery unconfirmed. Rejections, invalid provider responses, timeouts, and absent configuration never display success. On failures the form retains its fields. There are no automatic retries: a timeout can occur after provider acceptance, so repeated manual attempts can duplicate an inquiry. Pending requests are guarded in the client; cross-tab/retry deduplication is not implemented.

Before enabling real traffic, verify both mailboxes and sender-domain ownership with the provider, use a dedicated sending key, review provider retention/privacy settings, test a real submission, and confirm receipt in the destination inbox. The app stores and logs no inquiries, but the email provider and recipient mailbox necessarily process the content. Use dummy data for verification.

## Abuse controls and deployment limits

Only same configured-origin JSON POSTs are accepted; unexpected fields, malformed JSON, invalid field types, a filled/malformed honeypot, and unsupported control characters are rejected. Request streams have a 24 KiB byte cap and a five-second body-read timeout. Upstream infrastructure still needs request/header/time limits because the application cannot prevent all resource consumption before its handler runs. Field maxima: name 100, email 254, inquiry type 30, subject 160, message 5,000 characters.

The shared limiter uses the [Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi) with an atomic Lua INCR/EXPIRE operation: **10 validated, configured submissions per 60-second window across the entire site**. Only one integer counter under `portfolio:contact:v1:global` is stored, expiring after 60 seconds; no IP, name, email, subject, or message is stored in Redis. Use a dedicated Redis database per deployment/environment so unrelated sites do not share a quota. All environments require the limiter; missing configuration or a failed/malformed limiter response fails closed before sending. No in-process limiter is presented as distributed protection.

This modest global quota bounds email volume but can be exhausted by an attacker, temporarily denying legitimate submissions. Origin headers and honeypots are not bot authentication. Configure deployment-level WAF/per-client rate rules and traffic limits before public launch; evaluate CAPTCHA if abuse warrants it. Avoid logging request bodies in hosting/observability tools. Upstash connectivity/credentials and hosting traffic controls are deployment dependencies, not completed service configuration.

## Verification

Run `node --test tests/contact.test.mjs`, `npm.cmd run lint`, and `npm.cmd run build`. Tests transpile the real validation/handler modules with the installed TypeScript compiler and use isolated fake environment values and mocked network responses. They never load local credentials or contact an external service. Passing mock acceptance is not evidence of real email delivery. Actual browser interaction, 320px overflow, keyboard/screen-reader flow, and live email delivery remain pending. Do not launch browser automation without user approval. The earlier unattributed CSP/eval notice remains unresolved.
