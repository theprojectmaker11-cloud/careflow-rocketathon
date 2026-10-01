import { forward } from "../../../lib/proxy";

export async function POST(request: Request) {
  const body = await request.text();
  return forward(
    "/api/ask",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    },
    180_000,
  );
}
