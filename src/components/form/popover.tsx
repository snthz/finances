"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Popover anclado a un elemento, renderizado en <body> (no lo recortan los
 * contenedores con overflow, como el cuerpo de un sheet). Se voltea hacia arriba
 * si no hay espacio debajo.
 */
export function useAnchoredPopover<T extends HTMLElement>() {
  const anchorRef = useRef<T>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const width = Math.min(Math.max(r.width, 220), vw - 16);
    const left = Math.min(Math.max(8, r.left), vw - width - 8);
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    const flip = below < 240 && above > below;
    const maxHeight = Math.min(340, Math.max(160, flip ? above : below));
    setStyle(
      flip
        ? { position: "fixed", left, width, bottom: vh - r.top + 6, maxHeight }
        : { position: "fixed", left, width, top: r.bottom + 6, maxHeight },
    );
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        anchorRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return { anchorRef, popRef, open, setOpen, style };
}

export function PopoverPortal({
  open,
  popRef,
  style,
  children,
  className = "",
  ...rest
}: {
  open: boolean;
  popRef: React.RefObject<HTMLDivElement | null>;
  style: React.CSSProperties;
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={popRef}
      style={style}
      className={`animate-pop-in z-[70] flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop ${className}`}
      {...rest}
    >
      {children}
    </div>,
    document.body,
  );
}
