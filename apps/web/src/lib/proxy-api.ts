import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "./api-base-url";

export async function proxyApiRequest(request: NextRequest, path: string): Promise<NextResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const url = new URL(path, apiBaseUrl);
  const incomingHeaders = await headers();
  const proxyHeaders = new Headers();
  const contentType = request.headers.get("content-type");
  const cookie = incomingHeaders.get("cookie");

  proxyHeaders.set("Accept", "application/json");

  if (contentType) {
    proxyHeaders.set("Content-Type", contentType);
  }

  if (cookie) {
    proxyHeaders.set("Cookie", cookie);
  }

  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
  const apiResponse = await fetch(url, {
    method: request.method,
    headers: proxyHeaders,
    body,
    cache: "no-store",
  });
  const responseHeaders = new Headers();
  const responseContentType = apiResponse.headers.get("content-type");
  const setCookies =
    "getSetCookie" in apiResponse.headers && typeof apiResponse.headers.getSetCookie === "function"
      ? apiResponse.headers.getSetCookie()
      : [];
  const fallbackSetCookie = apiResponse.headers.get("set-cookie");

  if (responseContentType) {
    responseHeaders.set("Content-Type", responseContentType);
  }

  for (const setCookie of setCookies) {
    responseHeaders.append("Set-Cookie", setCookie);
  }

  if (setCookies.length === 0 && fallbackSetCookie) {
    responseHeaders.append("Set-Cookie", fallbackSetCookie);
  }

  return new NextResponse(await apiResponse.text(), {
    status: apiResponse.status,
    headers: responseHeaders,
  });
}
