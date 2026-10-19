"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { Field } from "./form/controls";
import { Select, type SelectOption } from "./form/select";

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

/** Tipo de cuenta; si es tarjeta de crédito, también el día de corte y el día límite de pago. */
export function AccountTypeFields({ defaultType, typeOptions, statementDay, dueDay, children }: {
  defaultType: string;
  typeOptions: SelectOption[];
  statementDay: number | null;
  dueDay: number | null;
  /** Campo que acompaña al tipo en la misma fila (institución) */
  children: React.ReactNode;
}) {
  const t = useT();
  const f = t.accounts.form;
  const [type, setType] = useState(defaultType);
  const dayOptions = [{ value: "", label: f.dayNotSet }, ...DAYS.map((d) => ({ value: d, label: d }))];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={f.type}>
          <Select name="type" value={type} onChange={setType} options={typeOptions} />
        </Field>
        {children}
      </div>
      {type === "credit_card" && (
        <div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={f.statementDay}>
              <Select name="statementDay" defaultValue={statementDay ? String(statementDay) : ""} options={dayOptions} searchable={false} />
            </Field>
            <Field label={f.dueDay}>
              <Select name="dueDay" defaultValue={dueDay ? String(dueDay) : ""} options={dayOptions} searchable={false} />
            </Field>
          </div>
          <p className="hint">{f.cycleHint}</p>
        </div>
      )}
    </>
  );
}
