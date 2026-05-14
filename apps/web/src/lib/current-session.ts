import type { CurrentSessionResponseDto } from "@tsukeai/shared";
import { headers } from "next/headers";
import { getApiBaseUrl } from "./api-base-url";

export async function getCurrentSession(): Promise<CurrentSessionResponseDto> {
  const apiBaseUrl = getApiBaseUrl();
  const url = new URL("/api/sessions/current", apiBaseUrl);
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const headersInit = new Headers({
    Accept: "application/json",
  });

  if (cookie) {
    headersInit.set("Cookie", cookie);
  }

  try {
    const response = await fetch(url, {
      headers: headersInit,
      cache: "no-store",
    });

    if (!response.ok) {
      return { authenticated: false };
    }

    return (await response.json()) as CurrentSessionResponseDto;
  } catch {
    return { authenticated: false };
  }
}
