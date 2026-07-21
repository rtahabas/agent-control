import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAllowedRequest } from "@/lib/origin-guard";

/**
 * Refuses cross-site writes to the API.
 *
 * Every route here can act on an agent — start a run, answer a permission
 * prompt, edit settings — so a request that came from somebody else's page has
 * no business reaching one. See origin-guard for why running locally is the
 * reason this is reachable rather than the reason it is safe.
 */
export function proxy(request: NextRequest) {
  const allowed = isAllowedRequest(
    request.method,
    request.headers.get("origin"),
    request.headers.get("host")
  );
  if (allowed) return NextResponse.next();
  return NextResponse.json({ error: "cross-site request refused" }, { status: 403 });
}

export const config = {
  matcher: "/api/:path*",
};
