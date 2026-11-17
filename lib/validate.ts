// A "domain" here must be a bare hostname: no scheme, no path, no port, no
// private/loopback IP, no localhost. This is the server-side SSRF guard —
// the client can send anything, so this must not trust it.
const HOSTNAME_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

const PRIVATE_OR_LOOPBACK = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\.0\.0\.0$/,
  /^169\.254\./, // link-local
  /^::1$/,
  /\.local$/i,
  /\.internal$/i,
];

export function validateDomain(input: string): { ok: true; domain: string } | { ok: false; reason: string } {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (/[:/?#]/.test(trimmed)) return { ok: false, reason: "must be a bare hostname, no scheme/path/port (e.g. acme.com, not https://acme.com/pricing)" };
  if (!HOSTNAME_RE.test(trimmed)) return { ok: false, reason: "not a valid hostname" };
  if (PRIVATE_OR_LOOPBACK.some((re) => re.test(trimmed))) return { ok: false, reason: "private/loopback hosts are not allowed" };
  return { ok: true, domain: trimmed };
}
