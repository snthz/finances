"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { PopoverPortal, useAnchoredPopover } from "./popover";

export type SelectOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/**
 * Select propio: botón + lista flotante. Envía su valor con un input oculto,
 * así funciona dentro de cualquier <form>. Con `autoSubmit` envía el form al cambiar.
 */
export function Select({
  name,
  options,
  value,
  defaultValue = "",
  onChange,
  placeholder,
  autoSubmit = false,
  searchable,
  variant = "field",
  id,
  className = "",
  ariaLabel,
  disabled,
}: {
  name?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  autoSubmit?: boolean;
  /** Por defecto se activa con más de 8 opciones */
  searchable?: boolean;
  variant?: "field" | "chip" | "ghost";
  id?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const t = useT().forms.select;
  const [internal, setInternal] = useState(defaultValue);
  const selected = value ?? internal;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [submitPending, setSubmitPending] = useState(false);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const { anchorRef, popRef, open, setOpen, style } = useAnchoredPopover<HTMLButtonElement>();
  const listId = useId();
  const withSearch = searchable ?? options.length > 8;

  const current = options.find((o) => o.value === selected);
  const filtered = useMemo(
    () => (query ? options.filter((o) => norm(`${o.label} ${o.hint ?? ""}`).includes(norm(query))) : options),
    [options, query],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const i = Math.max(0, options.findIndex((o) => o.value === selected));
    setActive(i);
    requestAnimationFrame(() => {
      if (withSearch) searchRef.current?.focus();
      listRef.current?.querySelector<HTMLElement>(`[data-index="${i}"]`)?.scrollIntoView({ block: "nearest" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Envía el form después de que el input oculto tenga el nuevo valor
  useEffect(() => {
    if (!submitPending) return;
    setSubmitPending(false);
    hiddenRef.current?.form?.requestSubmit();
  }, [submitPending]);

  function choose(v: string) {
    if (value === undefined) setInternal(v);
    onChange?.(v);
    setOpen(false);
    anchorRef.current?.focus();
    if (autoSubmit && v !== selected) setSubmitPending(true);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = filtered[active];
      if (o) choose(o.value);
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (!withSearch && e.key.length === 1) {
      const now = Date.now();
      typeahead.current.text = (now - typeahead.current.at < 600 ? typeahead.current.text : "") + e.key.toLowerCase();
      typeahead.current.at = now;
      const i = filtered.findIndex((o) => norm(o.label).startsWith(typeahead.current.text));
      if (i >= 0) setActive(i);
    }
  }

  const triggerClass = {
    field: "input flex items-center gap-2 text-left",
    chip: "chip pr-2.5",
    ghost: "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink",
  }[variant];

  return (
    <>
      {name && <input ref={hiddenRef} type="hidden" name={name} value={selected} />}
      <button
        ref={anchorRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={onKeyDown}
        className={`${triggerClass} ${open && variant === "field" ? "border-ink bg-surface ring-4 ring-ink/5" : ""} ${className}`}
      >
        {current?.icon && <span className="flex shrink-0 text-ink-2">{current.icon}</span>}
        <span className={`min-w-0 flex-1 truncate ${current ? "" : "text-muted"}`}>{current?.label ?? placeholder ?? t.placeholder}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <PopoverPortal open={open} popRef={popRef} style={style}>
        {withSearch && (
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="size-4 text-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={t.search}
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
        )}
        <ul ref={listRef} id={listId} role="listbox" className="overflow-y-auto overscroll-contain p-1.5">
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{t.noResults}</li>}
          {filtered.map((o, i) => {
            const isSel = o.value === selected;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSel}
                data-index={i}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm ${i === active ? "bg-surface-2" : ""}`}
              >
                {o.icon && <span className="flex w-5 shrink-0 justify-center text-ink-2">{o.icon}</span>}
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${isSel ? "font-medium" : ""}`}>{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-muted">{o.hint}</span>}
                </span>
                {isSel && <Check className="size-4 shrink-0" />}
              </li>
            );
          })}
        </ul>
      </PopoverPortal>
    </>
  );
}
