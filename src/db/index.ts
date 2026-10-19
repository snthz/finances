import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;

// Reutiliza la conexión entre recargas en desarrollo y entre bundles del mismo proceso.
// Drizzle se crea por cada versión del esquema: tras agregar una columna en desarrollo,
// la instancia vieja no la leería.
const g = globalThis as unknown as { __financeSql?: postgres.Sql; __financeDbs?: WeakMap<object, DB> };

/**
 * Algunos paneles (o URLs copiadas de Prisma) agregan `?schema=public`. postgres.js enviaría `schema`
 * como parámetro de conexión y Postgres lo rechaza ("unrecognized configuration parameter"):
 * se quita de la URL y se usa como search_path.
 */
export function parseDatabaseUrl(raw: string) {
  try {
    const url = new URL(raw);
    const schemaParam = url.searchParams.get("schema");
    if (!schemaParam) return { url: raw, searchPath: undefined };
    url.searchParams.delete("schema");
    return { url: url.toString(), searchPath: schemaParam };
  } catch {
    return { url: raw, searchPath: undefined };
  }
}

function connection() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL no está configurada");
  const { url, searchPath } = parseDatabaseUrl(raw);
  return (g.__financeSql ??= postgres(url, {
    max: 10,
    idle_timeout: 30,
    onnotice: () => {},
    ...(searchPath ? { connection: { search_path: searchPath } } : {}),
  }));
}

function instance() {
  const map = (g.__financeDbs ??= new WeakMap());
  let db = map.get(schema);
  if (!db) {
    db = drizzle(connection(), { schema });
    map.set(schema, db);
  }
  return db;
}

// Lazy para que `next build` no necesite la base de datos
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const inst = instance();
    const value = Reflect.get(inst, prop);
    return typeof value === "function" ? value.bind(inst) : value;
  },
});

export function sqlClient() {
  return connection();
}

export { schema };
