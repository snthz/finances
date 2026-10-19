"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n/client";

/** Campo de contraseña con botón para mostrarla u ocultarla. */
export function PasswordInput({ className = "", ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const t = useT().forms.password;
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`input pr-11 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t.hide : t.show}
        aria-pressed={visible}
        className="absolute inset-y-0 right-1 my-auto flex size-9 items-center justify-center rounded-lg text-muted transition hover:text-ink"
      >
        {visible ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
      </button>
    </div>
  );
}
