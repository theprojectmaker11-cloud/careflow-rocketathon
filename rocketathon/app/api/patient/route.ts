import { NextResponse, type NextRequest } from "next/server";
import { forward } from "../../../lib/proxy";

/**
 * Patient lookup. `?mrn=` returns the patient record; `?mrn=…&labs=1` returns
 * their lab history, which the Reports view turns into reference-range tables.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mrn = params.get("mrn")?.trim();
  if (!mrn) {
    return NextResponse.json({ detail: "Provide ?mrn=<medical record number>." }, { status: 400 });
  }
  const id = encodeURIComponent(mrn);
  if (params.get("labs") === "1") {
    const limit = Math.min(Number(params.get("limit") ?? 25) || 25, 100);
    return forward(`/api/patients/${id}/labs?limit=${limit}`);
  }
  return forward(`/api/patients/${id}`);
}
