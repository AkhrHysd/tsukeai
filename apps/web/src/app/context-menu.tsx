"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

type ContextMenuProps = {
  triggerLabel: string;
  timestampLabel: string;
  dateTime: string;
  formattedTime: string;
  children?: ReactNode;
};

export function ContextMenu({
  triggerLabel,
  timestampLabel,
  dateTime,
  formattedTime,
  children,
}: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <details
      className="context-menu"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
      ref={rootRef}
    >
      <summary className="context-menu__trigger" aria-label={triggerLabel}>
        <span aria-hidden="true">...</span>
      </summary>
      <button
        type="button"
        aria-hidden="true"
        className="context-menu__overlay"
        onClick={() => setOpen(false)}
        tabIndex={-1}
      />
      <div className="context-menu__panel">
        <div className="context-menu__timestamp">
          <span className="context-menu__label">{timestampLabel}</span>
          <time className="context-menu__info" dateTime={dateTime}>
            {formattedTime}
          </time>
        </div>
        {children}
      </div>
    </details>
  );
}
