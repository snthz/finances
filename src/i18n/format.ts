// Interpolación y plurales para los textos del diccionario.

/** fmt("Hola {name}", { name: "Ana" }) → "Hola Ana" */
export function fmt(template: string, vars: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export type Plural = { one: string; other: string };

/** plural(3, { one: "{n} item", other: "{n} items" }) → "3 items" */
export function plural(n: number, forms: Plural, vars: Record<string, string | number> = {}) {
  return fmt(n === 1 ? forms.one : forms.other, { n, ...vars });
}
