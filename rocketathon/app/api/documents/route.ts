import { forward } from "../../../lib/proxy";

/** Multipart upload is streamed through untouched so the image never hits disk twice. */
export async function POST(request: Request) {
  // The boundary lives in the Content-Type header, so it has to travel with the
  // stream; without it FastAPI cannot parse the form and rejects the upload.
  const contentType = request.headers.get("content-type");
  return forward(
    "/api/documents",
    {
      method: "POST",
      body: request.body,
      ...(contentType ? { headers: { "Content-Type": contentType } } : {}),
    },
    180_000,
  );
}
