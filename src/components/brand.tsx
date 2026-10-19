/** Marca: "Finances" con la firma "by FallxnStudio" debajo. */
export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = {
    sm: { icon: "size-6 rounded-md", name: "text-[15px]", by: "text-[9px]" },
    md: { icon: "size-8 rounded-lg", name: "text-base", by: "text-[10px]" },
    lg: { icon: "size-11 rounded-xl", name: "text-xl", by: "text-[11px]" },
  }[size];
  return (
    <span className="flex items-center gap-2.5">
      <img src="/icon.svg" alt="" className={`${s.icon} shrink-0`} />
      <span className="flex flex-col leading-none">
        <span className={`${s.name} font-semibold tracking-tight text-ink`}>Finances</span>
        <span className={`${s.by} -mt-px tracking-wide text-muted`}>
          by Fallxn<strong className="font-bold text-ink-2">Studio</strong>
        </span>
      </span>
    </span>
  );
}
