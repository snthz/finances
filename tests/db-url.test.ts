import { describe, expect, test } from "bun:test";
import { parseDatabaseUrl } from "@/db";

describe("parseDatabaseUrl", () => {
  test("quita ?schema= y lo usa como search_path", () => {
    expect(parseDatabaseUrl("postgresql://u:p@db:5432/finances?schema=public")).toEqual({
      url: "postgresql://u:p@db:5432/finances",
      searchPath: "public",
    });
  });
  test("conserva otros parámetros", () => {
    const r = parseDatabaseUrl("postgresql://u:p@db:5432/finances?sslmode=require&schema=app");
    expect(r.url).toBe("postgresql://u:p@db:5432/finances?sslmode=require");
    expect(r.searchPath).toBe("app");
  });
  test("sin schema no cambia la URL", () => {
    const raw = "postgres://u:p@db:5432/finances";
    expect(parseDatabaseUrl(raw)).toEqual({ url: raw, searchPath: undefined });
  });
});
