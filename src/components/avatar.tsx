import { Bird, Cat, Coffee, Dog, Fish, Flame, Ghost, Leaf, Moon, Mountain, Panda, Rabbit, Rocket, Snail, Squirrel, Sun, Turtle, Zap, type LucideIcon } from "lucide-react";

/** Avatares predeterminados (se guardan como "icon:<nombre>") */
export const AVATAR_ICONS: Record<string, LucideIcon> = {
  cat: Cat,
  dog: Dog,
  panda: Panda,
  rabbit: Rabbit,
  bird: Bird,
  fish: Fish,
  squirrel: Squirrel,
  turtle: Turtle,
  snail: Snail,
  ghost: Ghost,
  rocket: Rocket,
  zap: Zap,
  flame: Flame,
  leaf: Leaf,
  mountain: Mountain,
  sun: Sun,
  moon: Moon,
  coffee: Coffee,
};

export function isValidAvatar(v: string) {
  if (v.startsWith("icon:")) return v.slice(5) in AVATAR_ICONS;
  return /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 400_000;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** Foto, ícono predeterminado o iniciales. `size` en px. */
export function Avatar({ name, avatar, size = 32, className = "" }: { name: string; avatar?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size };
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`;
  if (avatar?.startsWith("data:image/")) {
    return <img src={avatar} alt={name} style={style} className={`${base} object-cover`} />;
  }
  const Icon = avatar?.startsWith("icon:") ? AVATAR_ICONS[avatar.slice(5)] : undefined;
  if (Icon) {
    return (
      <span style={style} className={`${base} bg-ink text-bg`} aria-label={name}>
        <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.8} />
      </span>
    );
  }
  return (
    <span style={{ ...style, fontSize: size * 0.38 }} className={`${base} bg-surface-3 font-semibold text-ink`} aria-label={name}>
      {initials(name)}
    </span>
  );
}
