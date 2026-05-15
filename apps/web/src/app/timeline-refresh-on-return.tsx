"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const timelineRefreshStorageKey = "tsukeai:timeline-refresh-needed";

export function markTimelineRefreshNeeded() {
  try {
    window.sessionStorage.setItem(timelineRefreshStorageKey, "1");
  } catch {
    // Ignore storage failures; the current route can still refresh directly.
  }
}

export function TimelineRefreshOnReturn() {
  const router = useRouter();

  useEffect(() => {
    function refreshIfNeeded() {
      let shouldRefresh = false;

      try {
        shouldRefresh = window.sessionStorage.getItem(timelineRefreshStorageKey) === "1";

        if (shouldRefresh) {
          window.sessionStorage.removeItem(timelineRefreshStorageKey);
        }
      } catch {
        shouldRefresh = false;
      }

      if (shouldRefresh) {
        router.refresh();
      }
    }

    function refreshOnVisible() {
      if (document.visibilityState === "visible") {
        refreshIfNeeded();
      }
    }

    refreshIfNeeded();
    window.addEventListener("pageshow", refreshIfNeeded);
    window.addEventListener("focus", refreshIfNeeded);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener("pageshow", refreshIfNeeded);
      window.removeEventListener("focus", refreshIfNeeded);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [router]);

  return null;
}
