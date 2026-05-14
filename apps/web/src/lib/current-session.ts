import type { CurrentSessionResponseDto } from "@tsukeai/shared";
import { cookies } from "next/headers";
import { getApiBaseUrl } from "./api-base-url";

export async function getCurrentSession(): Promise<CurrentSessionResponseDto> {
  if (process.env.DEV_MOCK === "1") {
    return {
      authenticated: true,
      account: { id: "dev-mock-user", displayName: "開発ユーザー", handle: "dev" },
    };
  }

  const apiBaseUrl = getApiBaseUrl();
  const url = new URL("/api/sessions/current", apiBaseUrl);
  const requestCookies = await cookies();
  const cookie = requestCookies
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
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
