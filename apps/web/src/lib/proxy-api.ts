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

  const response = new NextResponse(await apiResponse.text(), {
    status: apiResponse.status,
    headers: responseHeaders,
  });

  for (const setCookie of setCookies) {
    applySetCookie(response, setCookie);
  }

  if (setCookies.length === 0 && fallbackSetCookie) {
    applySetCookie(response, fallbackSetCookie);
  }

  return response;
}

function applySetCookie(response: NextResponse, setCookie: string) {
  const parsed = parseSetCookie(setCookie);

  if (!parsed) {
    return;
  }

  response.cookies.set(parsed.name, parsed.value, {
    httpOnly: parsed.httpOnly,
    secure: parsed.secure,
    sameSite: parsed.sameSite,
    path: parsed.path,
    maxAge: parsed.maxAge,
  });
}

function parseSetCookie(setCookie: string) {
  const parts = setCookie.split(";").map((part) => part.trim());
  const [nameValue, ...attributes] = parts;

  if (!nameValue) {
    return undefined;
  }

  const separatorIndex = nameValue.indexOf("=");

  if (separatorIndex <= 0) {
    return undefined;
  }

  const parsed: {
    name: string;
    value: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
    path: string;
    maxAge?: number;
  } = {
    name: nameValue.slice(0, separatorIndex),
    value: nameValue.slice(separatorIndex + 1),
    httpOnly: false,
    secure: false,
    sameSite: "lax",
    path: "/",
  };

  for (const attribute of attributes) {
    const [rawName, rawValue] = attribute.split("=");

    if (!rawName) {
      continue;
    }

    const name = rawName.toLowerCase();
    const value = rawValue?.trim();

    if (name === "httponly") {
      parsed.httpOnly = true;
      continue;
    }

    if (name === "secure") {
      parsed.secure = true;
      continue;
    }

    if (name === "path" && value) {
      parsed.path = value;
      continue;
    }

    if (name === "max-age" && value) {
      parsed.maxAge = Number.parseInt(value, 10);
      continue;
    }

    if (name === "samesite" && value) {
      const sameSite = value.toLowerCase();

      if (sameSite === "strict" || sameSite === "none") {
        parsed.sameSite = sameSite;
      }
    }
  }

  return parsed;
}
