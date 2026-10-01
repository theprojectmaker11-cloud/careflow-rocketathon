import { NextResponse, type NextRequest } from "next/server";
import { forward } from "../../../lib/proxy";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json(
      { detail: "Provide ?session_id=<id>." },
      { status: 400 },
    );
  }
  return forward(`/api/sessions/${encodeURIComponent(sessionId)}/history`, {}, 30_000);
}
