"use client";

import type { CurrentSessionResponseDto } from "@tsukeai/shared";
import Link from "next/link";

type AppShellActionsProps = {
  initialSession: CurrentSessionResponseDto;
};

export function AppShellActions({ initialSession }: AppShellActionsProps) {
  if (!initialSession.authenticated) {
    return null;
  }

  return (
    <Link href="/compose" className="fab" aria-label="歌を追加">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </Link>
  );
}
