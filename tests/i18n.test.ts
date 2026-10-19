import { describe, expect, test } from "bun:test";
import { LOCALES } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { fmt, plural } from "@/i18n/format";

type Tree = { [k: string]: unknown };

/** Rutas de todas las hojas ("settings.page.title", …) con su valor. */
function leaves(node: unknown, prefix = ""): [string, unknown][] {
  if (node && typeof node === "object" && !Array.isArray(node)) {
    return Object.entries(node as Tree).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  }
  if (Array.isArray(node)) return node.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  return [[prefix, node]];
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("diccionarios", () => {
  const en = new Map(leaves(getDictionary("en")));

  for (const locale of LOCALES) {
    test(`${locale}: mismas claves que inglés y sin textos vacíos`, () => {
      const dict = new Map(leaves(getDictionary(locale)));
      expect([...dict.keys()].sort()).toEqual([...en.keys()].sort());
      for (const [key, value] of dict) {
        // Los fragmentos antes/después de un valor pueden quedar vacíos según el orden de cada idioma
        if (typeof value === "string" && !/(Before|After)$/.test(key)) expect({ key, empty: value.trim() === "" }).toEqual({ key, empty: false });
      }
    });

    test(`${locale}: mismos {marcadores} que inglés`, () => {
      for (const [key, value] of leaves(getDictionary(locale))) {
        const base = en.get(key);
        if (typeof value === "string" && typeof base === "string") {
          expect({ key, vars: placeholders(value) }).toEqual({ key, vars: placeholders(base) });
        }
      }
    });
  }
});

describe("formato", () => {
  test("fmt reemplaza marcadores y deja los desconocidos", () => {
    expect(fmt("Hola {name}, {x}", { name: "Ana" })).toBe("Hola Ana, {x}");
  });
  test("plural", () => {
    const forms = { one: "{n} item", other: "{n} items" };
    expect(plural(1, forms)).toBe("1 item");
    expect(plural(3, forms)).toBe("3 items");
  });
});
