"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  title?: string;
  text: string;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "left" | "center" | "right" | "auto";
}

export function InfoTooltip({
  title,
  text,
  className,
  side = "top",
  align = "auto",
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [effectiveAlign, setEffectiveAlign] = useState<
    "left" | "center" | "right"
  >("center");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !containerRef.current) return;

    if (align !== "auto") {
      setEffectiveAlign(align);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const tooltipWidth = 240;
    const screenWidth = typeof window !== "undefined" ? window.innerWidth : 360;

    // If too close to right edge, align right edge of tooltip with trigger
    if (rect.left + tooltipWidth / 2 > screenWidth - 20) {
      setEffectiveAlign("right");
    }
    // If too close to left edge, align left edge of tooltip with trigger
    else if (rect.left - tooltipWidth / 2 < 20) {
      setEffectiveAlign("left");
    } else {
      setEffectiveAlign("center");
    }
  }, [open, align]);

  useEffect(() => {
    if (!open) return;

    function handleOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const getPositionClasses = () => {
    let classes = "";
    if (side === "top") classes += "bottom-full mb-2 ";
    else if (side === "bottom") classes += "top-full mt-2 ";
    else if (side === "left") return "right-full top-1/2 -translate-y-1/2 mr-2";
    else if (side === "right") return "left-full top-1/2 -translate-y-1/2 ml-2";

    if (effectiveAlign === "left") {
      classes += "left-0";
    } else if (effectiveAlign === "right") {
      classes += "right-0";
    } else {
      classes += "left-1/2 -translate-x-1/2";
    }
    return classes;
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label={title || "Information"}
        className="p-1 text-muted-foreground/70 hover:text-foreground active:text-[var(--pos-brand)] transition-colors rounded-full focus:outline-none focus:ring-1 focus:ring-[var(--pos-brand)] cursor-pointer"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute z-50 w-56 sm:w-64 max-w-[calc(100vw-2.5rem)] p-3 rounded-xl border border-[var(--pos-stroke)] bg-[var(--pos-panel)] shadow-xl text-left pointer-events-auto animate-in fade-in zoom-in-95 duration-150",
            getPositionClasses(),
          )}
        >
          {title && (
            <p className="text-xs font-semibold text-foreground mb-1">
              {title}
            </p>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {text}
          </p>
        </div>
      )}
    </div>
  );
}
