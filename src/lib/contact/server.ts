// Server entry point: imported only by the API route, never by the contact UI.
import { isEmail, validateInquiry, type Inquiry } from "./validation";

type Environment = Record<string, string | undefined>;
type Fetcher = typeof fetch;
const MAX_BYTES = 24 * 1024;
const unavailable = "Contact submission is currently unavailable. Your inquiry has not been sent. Please try again later.";
const rateScript = "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 60) end; return n";
const reply = (status: number, message: string, extra = {}) => Response.json({ message, ...extra }, {
  status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) },
});

function configuration(env: Environment) {
  const { RESEND_API_KEY: key, CONTACT_FROM_EMAIL: from, CONTACT_TO_EMAIL: to, CONTACT_ALLOWED_ORIGIN: origin,
    UPSTASH_REDIS_REST_URL: redisUrl, UPSTASH_REDIS_REST_TOKEN: redisToken } = env;
  if (!key || /\s/.test(key) || !from || !to || !isEmail(from) || !isEmail(to) || !origin) return null;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.username || parsed.password ||
      (parsed.protocol !== "https:" && !(env.NODE_ENV !== "production" && parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname)))) return null;
    if (!redisUrl || !redisToken || /\s/.test(redisToken)) return null;
    const redis = new URL(redisUrl);
    if (redis.protocol !== "https:" || !redis.hostname.endsWith(".upstash.io") || redis.username || redis.password || redis.pathname !== "/" || redis.search || redis.hash) return null;
    return { key, from, to, origin, redisUrl, redisToken };
  } catch { return null; }
}

async function readPayload(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) throw new RangeError();
  if (!request.body) throw new SyntaxError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 5000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { void reader.cancel().catch(() => {}); throw new RangeError(); }
      chunks.push(value);
    }
    if (timedOut) throw new SyntaxError();
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

async function deliver(inquiry: Inquiry, config: NonNullable<ReturnType<typeof configuration>>, send: Fetcher) {
  // Plain text only: user input is never interpolated into HTML or raw headers.
  const response = await send("https://api.resend.com/emails", {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.from, to: [config.to], reply_to: inquiry.email,
      subject: `[Portfolio] ${inquiry.subject}`,
      text: `Name: ${inquiry.name}\nEmail: ${inquiry.email}\nInquiry: ${inquiry.inquiryType}\n\n${inquiry.message}` }),
  });
  if (!response.ok) return false;
  const result: unknown = await response.json();
  return !!result && typeof result === "object" && "id" in result && typeof result.id === "string" && result.id.length > 0;
}

export async function handleContact(request: Request, env: Environment = process.env, send: Fetcher = fetch): Promise<Response> {
  const origin = request.headers.get("origin");
  // Check against an explicit deployment origin, never an untrusted forwarded host.
  if (!origin || (env.CONTACT_ALLOWED_ORIGIN && origin !== env.CONTACT_ALLOWED_ORIGIN) || request.headers.get("sec-fetch-site") === "cross-site") return reply(403, "This submission origin is not allowed.");
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) return reply(415, "Send a JSON contact form.");
  let payload: unknown;
  try { payload = await readPayload(request); }
  catch (error) { return reply(error instanceof RangeError ? 413 : 400, error instanceof RangeError ? "This inquiry is too large." : "The request could not be read. Please try again."); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return reply(400, "Invalid contact form payload.");
  const data = payload as Record<string, unknown>;
  const allowed = ["name", "email", "inquiryType", "subject", "message", "website"];
  if (Object.keys(data).some((key) => !allowed.includes(key)) || typeof data.website !== "string" || data.website !== "") return reply(400, "The contact form could not be accepted.");
  const validation = validateInquiry(data);
  if (!validation.ok) return reply(422, "Please review the highlighted fields.", { errors: validation.errors });
  const config = configuration(env);
  if (!config) return reply(503, unavailable);
  try {
    // Atomic shared quota: no visitor IP, email, or inquiry content is stored.
    const limited = await send(config.redisUrl, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
      headers: { Authorization: `Bearer ${config.redisToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", rateScript, "1", "portfolio:contact:v1:global"]),
    });
    if (!limited.ok) return reply(503, unavailable);
    const quota: unknown = await limited.json();
    if (!quota || typeof quota !== "object" || !("result" in quota) || typeof quota.result !== "number" || !Number.isSafeInteger(quota.result) || quota.result < 1) return reply(503, unavailable);
    if (quota.result > 10) return reply(429, "Too many inquiries right now. Please wait a minute before trying again.");
    if (!await deliver(validation.data, config, send)) return reply(502, "The email service did not confirm acceptance. Your inquiry may not have been sent. Please try again later.");
    return reply(200, "Your inquiry was accepted by the email service. Thank you for getting in touch. Inbox delivery is not yet confirmed.");
  } catch { return reply(502, "Submission could not be confirmed. Please try again later. If you already submitted, avoid repeated attempts."); }
}
