"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/i18n/client";

/**
 * Botón destructivo en dos pasos: el primer toque pide confirmación
 * en el mismo botón; el segundo envía el form.
 */
export function ConfirmButton({
  children,
  confirmLabel,
  className = "btn-danger",
  confirmClassName = "btn bg-bad text-white",
  form,
}: {
  children: React.ReactNode;
  confirmLabel?: React.ReactNode;
  className?: string;
  confirmClassName?: string;
  /** Compatibilidad: texto de confirmación (ya no se usa el diálogo nativo) */
  message?: string;
  /** id del <form> a enviar cuando el botón está fuera de él */
  form?: string;
}) {
  const t = useT();
  const { pending } = useFormStatus();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="submit"
      form={form}
      disabled={pending}
      className={armed ? confirmClassName : className}
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
    >
      {pending ? "…" : armed ? (confirmLabel ?? t.forms.confirmAgain) : children}
    </button>
  );
}
