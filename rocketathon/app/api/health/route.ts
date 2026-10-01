import { NextResponse } from "next/server";
import { API_URL } from "../../../lib/proxy";

/** Health probe for the client shell. Always 200 so the UI can tell
 *  "service down" apart from "our own route broke". */
export async function GET() {
  try {
    const res = await fetch(`${API_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: `service returned ${res.status}` });
    }
    const body = await res.json();
    return NextResponse.json({ ...body, ok: true });
  } catch {
    return NextResponse.json({
      ok: false,
      reason: `no response from ${API_URL}`,
    });
  }
}
