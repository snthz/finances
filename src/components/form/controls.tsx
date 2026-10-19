"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";
import { fmt, useT } from "@/i18n/client";
import { CATEGORY_ICONS, CategoryIcon, DEFAULT_CATEGORY_ICON, isCategoryIcon } from "../category-icon";
import { PopoverPortal, useAnchoredPopover } from "./popover";

/** Etiqueta + control + ayuda */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className = "",
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

/** Grupo de opciones tipo "pastilla" (radio). Controlado con `value`/`onChange` o libre con `defaultValue`. */
export function Segmented({
  name,
  options,
  value,
  defaultValue,
  onChange,
  size = "md",
}: {
  name: string;
  options: { value: string; label: React.ReactNode }[];
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  size?: "sm" | "md";
}) {
  const [internal, setInternal] = useState(defaultValue ?? options[0]?.value);
  const current = value ?? internal;
  const id = useId();
  return (
    <div role="radiogroup" className={`grid gap-1 rounded-xl bg-surface-2 p-1`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <label key={o.value} className="relative cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={current === o.value}
            onChange={() => {
              if (value === undefined) setInternal(o.value);
              onChange?.(o.value);
            }}
            className="peer sr-only"
            id={`${id}-${o.value}`}
          />
          <span
            className={`flex items-center justify-center gap-1.5 rounded-[10px] font-medium text-ink-2 transition peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-[0_1px_3px_rgba(0,0,0,0.12)] peer-focus-visible:ring-2 peer-focus-visible:ring-ink/30 ${
              size === "sm" ? "h-8 text-xs" : "h-9 text-sm"
            }`}
          >
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Interruptor on/off. Es un checkbox real, así que se envía con el form. */
export function Switch({
  name,
  defaultChecked,
  checked,
  onChange,
  label,
  hint,
}: {
  name?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-[26px] w-[44px] shrink-0 rounded-full bg-surface-3 transition-colors duration-200 peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ink/30 after:absolute after:top-[3px] after:left-[3px] after:size-5 after:rounded-full after:bg-white after:shadow-[0_1px_3px_rgba(0,0,0,0.25)] after:transition-transform after:duration-200 peer-checked:after:translate-x-[18px] dark:peer-checked:after:bg-[#0a0a0a]"
      />
    </label>
  );
}

/**
 * Lista de valores como chips (Enter o coma para agregar). Se envía como texto separado por comas.
 * Controlado con `value`/`onChange` o libre con `defaultValue`.
 */
export function TagInput({
  name,
  defaultValue = [],
  value,
  onChange,
  placeholder,
  normalize = (s) => s.trim(),
  inputMode,
  mono,
  id,
}: {
  name: string;
  defaultValue?: string[];
  value?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  normalize?: (s: string) => string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  mono?: boolean;
  id?: string;
}) {
  const t = useT();
  const [internal, setInternal] = useState<string[]>(defaultValue);
  const tags = value ?? internal;
  const setTags = (fn: (t: string[]) => string[]) => {
    const next = fn(tags);
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const parts = raw
      .split(",")
      .map(normalize)
      .filter(Boolean);
    if (!parts.length) return;
    setTags((t) => Array.from(new Set([...t, ...parts])));
    setDraft("");
  }

  return (
    <div
      className="flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-transparent bg-surface-2 px-2 py-1.5 transition focus-within:border-ink focus-within:bg-surface focus-within:ring-4 focus-within:ring-ink/5"
      onClick={(e) => (e.currentTarget.querySelector("input:not([type=hidden])") as HTMLInputElement | null)?.focus()}
    >
      <input type="hidden" name={name} value={[...tags, ...(draft.trim() ? [normalize(draft)] : [])].filter(Boolean).join(",")} />
      {tags.map((tag) => (
        <span key={tag} className={`inline-flex h-7 items-center gap-1 rounded-lg bg-surface px-2 text-[13px] shadow-[0_0_0_1px_var(--line)] ${mono ? "font-mono text-xs" : ""}`}>
          {tag}
          <button
            type="button"
            aria-label={fmt(t.ui.tagInput.remove, { tag })}
            onClick={() => setTags((x) => x.filter((v) => v !== tag))}
            className="-mr-0.5 rounded p-0.5 text-muted hover:text-ink"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        inputMode={inputMode}
        onChange={(e) => {
          if (e.target.value.includes(",")) commit(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && tags.length) {
            setTags((x) => x.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={tags.length ? "" : placeholder}
        className={`h-7 min-w-24 flex-1 bg-transparent px-1.5 text-[15px] outline-none placeholder:text-muted ${mono ? "font-mono text-sm" : ""}`}
      />
    </div>
  );
}

/** Selector de ícono para las categorías (íconos de línea, con búsqueda). */
export function IconPicker({
  name,
  defaultValue = DEFAULT_CATEGORY_ICON,
  value: controlled,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (icon: string) => void;
}) {
  const [internal, setInternal] = useState(isCategoryIcon(defaultValue) ? defaultValue : DEFAULT_CATEGORY_ICON);
  const value = controlled !== undefined && isCategoryIcon(controlled) ? controlled : internal;
  const setValue = (v: string) => {
    if (controlled === undefined) setInternal(v);
    onChange?.(v);
  };
  const t = useT();
  const labels = t.ui.iconPicker.labels;
  const [query, setQuery] = useState("");
  const { anchorRef, popRef, open, setOpen, style } = useAnchoredPopover<HTMLButtonElement>();
  const simplify = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  const q = simplify(query);
  const entries = Object.keys(CATEGORY_ICONS)
    .map((key) => [key, labels[key] ?? key] as const)
    .filter(([key, label]) => !q || key.includes(q) || simplify(label).includes(q));
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <button
        ref={anchorRef}
        type="button"
        aria-label={t.ui.iconPicker.choose}
        onClick={() => {
          setQuery("");
          setOpen(!open);
        }}
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 transition hover:bg-surface-3 ${open ? "outline outline-ink ring-4 ring-ink/5" : ""}`}
      >
        <CategoryIcon name={value} className="size-5" />
      </button>
      <PopoverPortal open={open} popRef={popRef} style={{ ...style, width: 312 }}>
        <div className="border-b border-line p-2">
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.ui.iconPicker.searchPlaceholder} className="input h-9 text-sm" />
        </div>
        <div className="grid grid-cols-7 gap-1 overflow-y-auto p-2">
          {entries.map(([key, label]) => (
            <button
              key={key}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => {
                setValue(key);
                setOpen(false);
              }}
              className={`flex size-10 items-center justify-center rounded-xl transition ${key === value ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
            >
              <CategoryIcon name={key} className="size-4.5" />
            </button>
          ))}
          {entries.length === 0 && <p className="col-span-7 py-6 text-center text-sm text-muted">{t.ui.iconPicker.noResults}</p>}
        </div>
      </PopoverPortal>
    </>
  );
}

/** Fecha con atajos "Hoy" y "Ayer". */
export function DateField({ name, defaultValue, today, yesterday, id }: { name: string; defaultValue: string; today: string; yesterday: string; id?: string }) {
  const t = useT();
  const [value, setValue] = useState(defaultValue);
  const chip = (v: string, label: string) => (
    <button
      type="button"
      onClick={() => setValue(v)}
      className={`h-8 rounded-lg px-3 text-xs font-medium transition ${value === v ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-2">
      <input id={id} type="date" name={name} required value={value} onChange={(e) => setValue(e.target.value)} className="input" />
      <div className="flex gap-1.5">
        {chip(today, t.ui.dateField.today)}
        {chip(yesterday, t.ui.dateField.yesterday)}
      </div>
    </div>
  );
}

/**
 * Chips seleccionables (uno o varios). Se envía como texto separado por comas en un input oculto.
 * Controlado con `value`/`onChange` o libre con `defaultValue`.
 */
export function ChipGroup({
  name,
  options,
  multiple = false,
  value,
  defaultValue = [],
  onChange,
}: {
  name?: string;
  options: { value: string; label: React.ReactNode; icon?: React.ReactNode }[];
  multiple?: boolean;
  value?: string[];
  defaultValue?: string[];
  onChange?: (v: string[]) => void;
}) {
  const [internal, setInternal] = useState<string[]>(defaultValue);
  const selected = value ?? internal;
  function toggle(v: string) {
    const next = multiple ? (selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]) : [v];
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }
  return (
    <div className="flex flex-wrap gap-1.5" role={multiple ? "group" : "radiogroup"}>
      {name && <input type="hidden" name={name} value={selected.join(",")} />}
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={on}
            onClick={() => toggle(o.value)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition active:scale-[0.97] ${
              on ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink"
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
