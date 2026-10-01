import { NextResponse } from "next/server";

/**
 * Server-side proxy to the CareFlow FastAPI service.
 *
 * The browser only ever talks to Next routes, which keeps CORS out of the
 * picture and means the backend address is never exposed in the client bundle.
 * AIKTI_API_URL is still honoured so existing .env files keep working.
 *
 * 127.0.0.1 rather than localhost: uvicorn binds IPv4 only, while Windows
 * resolves localhost to ::1 first, so naming the family avoids a doomed IPv6
 * attempt on every request.
 */
export const API_URL =
  process.env.CAREFLOW_API_URL ?? process.env.AIKTI_API_URL ?? "http://127.0.0.1:8000";

const DEFAULT_TIMEOUT = 120_000; // a Gemini-backed analysis can legitimately be slow

/** Turns a transport failure into an actionable message instead of a generic one. */
function describe(err: unknown, timeoutMs: number): string {
  if (err instanceof Error && err.name === "TimeoutError") {
    return `CareFlow's analysis service at ${API_URL} did not respond within ${timeoutMs / 1000}s. It may still be starting up, or a Gemini-backed analysis is slow.`;
  }
  const code = (err as { cause?: { code?: string } })?.cause?.code;
  if (code === "ECONNREFUSED") {
    return `CareFlow cannot reach its analysis service at ${API_URL}: connection refused, so nothing is listening. Start it with the project venv (a global uvicorn has no pydantic_settings and dies on startup): cd services/api; .\\.venv\\Scripts\\python.exe -m uvicorn main:app --reload --port 8000`;
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return `CareFlow cannot resolve the analysis service host ${API_URL}. Check CAREFLOW_API_URL in .env.local.`;
  }
  const detail = code ?? (err instanceof Error ? err.message : String(err));
  return `CareFlow cannot reach its analysis service at ${API_URL} (${detail}).`;
}

export async function forward(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<NextResponse> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      // undici requires this whenever the body is a stream, which is how the
      // multipart upload is passed through untouched.
      duplex: "half",
    } as RequestInit);
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    // Logged so the real cause lands in the Next terminal instead of being lost.
    console.error(`[proxy] ${init.method ?? "GET"} ${path} failed:`, err);
    return NextResponse.json({ detail: describe(err, timeoutMs) }, { status: 503 });
  }
}
