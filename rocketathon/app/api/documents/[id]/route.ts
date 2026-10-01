import { forward } from "../../../../lib/proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return forward(`/api/documents/${encodeURIComponent(id)}`, {}, 30_000);
}
