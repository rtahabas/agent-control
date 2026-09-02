/** Methods that can change something, and so are worth a cross-site check. */
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Whether a request may act on this dashboard.
 *
 * The panel drives real agents, and an agent id is a readable slug like
 * "research-bot". A page you merely visit can POST to a port on your own machine
 * — a `text/plain` body is a "simple request", so no preflight stands in the
 * way and the browser sends it happily. It cannot read the reply, but starting
 * the run is the damage. Running only on your own machine is what makes that
 * reachable, not what prevents it.
 *
 * Browsers attach `Origin` to cross-site requests, so requiring it to name this
 * same server closes that door. A request carrying no `Origin` is not a browser
 * — curl, a script, the Telegram bridge — and those are left alone: blocking
 * them would break local tooling without stopping the attack this guards
 * against.
 */
export function isAllowedRequest(
  method: string,
  origin: string | null,
  host: string | null
): boolean {
  if (!MUTATING.has(method.toUpperCase())) return true;
  if (!origin) return true;
  if (!host) return false;
  return sameServer(origin, host);
}

/**
 * Compares the Origin against the Host the request was addressed to, rather
 * than an allow-list of names. Whatever name the dashboard is opened under, the
 * browser reports it in both headers, so they agree for a same-origin request
 * and disagree for every cross-site one — and there is no list to keep current
 * when the port or hostname changes.
 */
function sameServer(origin: string, host: string): boolean {
  let originHost: string;
  let originPort: string;
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    originHost = u.hostname.toLowerCase();
    originPort = u.port || (u.protocol === "https:" ? "443" : "80");
  } catch {
    return false;
  }

  const [rawHost, rawPort] = splitHost(host.toLowerCase());
  return originHost === stripBrackets(rawHost) && originPort === (rawPort || "80");
}

/** Splits "host:port", tolerating a bracketed IPv6 literal. */
function splitHost(host: string): [string, string] {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    if (end === -1) return [host, ""];
    return [host.slice(0, end + 1), host.slice(end + 2)];
  }
  const idx = host.lastIndexOf(":");
  if (idx === -1) return [host, ""];
  return [host.slice(0, idx), host.slice(idx + 1)];
}

/** URL.hostname reports an IPv6 literal without brackets; Host keeps them. */
function stripBrackets(host: string): string {
  return host.replace(/^\[|\]$/g, "");
}
