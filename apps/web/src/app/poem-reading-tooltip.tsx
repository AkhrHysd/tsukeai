"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

type TooltipPosition = {
  left: number;
  top: number;
};

type PoemReadingTooltipProps = {
  text: string;
  readingText?: string;
  className?: string;
};

const VIEWPORT_MARGIN = 12;
const TOOLTIP_GAP = 8;

export function PoemReadingTooltip({ text, readingText, className }: PoemReadingTooltipProps) {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLParagraphElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const hasReading = Boolean(readingText);

  useLayoutEffect(() => {
    if (!open || !hasReading) {
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      const tooltip = tooltipRef.current;
      if (!anchor || !tooltip) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const maxLeft = Math.max(
        VIEWPORT_MARGIN,
        window.innerWidth - tooltipRect.width - VIEWPORT_MARGIN,
      );
      const preferredLeft = anchorRect.left;
      const left = Math.min(Math.max(preferredLeft, VIEWPORT_MARGIN), maxLeft);
      const topAbove = anchorRect.top - tooltipRect.height - TOOLTIP_GAP;
      const topBelow = anchorRect.bottom + TOOLTIP_GAP;
      const maxTop = Math.max(
        VIEWPORT_MARGIN,
        window.innerHeight - tooltipRect.height - VIEWPORT_MARGIN,
      );
      const preferredTop = topAbove >= VIEWPORT_MARGIN ? topAbove : topBelow;
      const top = Math.min(Math.max(preferredTop, VIEWPORT_MARGIN), maxTop);

      setPosition({ left, top });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, hasReading]);

  const show = () => {
    if (hasReading) {
      setOpen(true);
    }
  };
  const hide = () => {
    setOpen(false);
    setPosition(null);
  };

  return (
    <p
      aria-describedby={open && hasReading ? tooltipId : undefined}
      className={["poem-tooltip", className].filter(Boolean).join(" ")}
      data-has-reading={hasReading ? "true" : "false"}
      onBlur={hide}
      onFocus={show}
      onMouseEnter={show}
      onMouseLeave={hide}
      ref={anchorRef}
      tabIndex={hasReading ? 0 : undefined}
    >
      {text}
      {open && hasReading ? (
        <span
          className="poem-tooltip__bubble"
          id={tooltipId}
          ref={tooltipRef}
          role="tooltip"
          style={
            position
              ? {
                  left: position.left,
                  top: position.top,
                }
              : { visibility: "hidden" }
          }
        >
          {readingText}
        </span>
      ) : null}
    </p>
  );
}
