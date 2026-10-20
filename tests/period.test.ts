import { describe, expect, test } from "bun:test";
import { elapsedDays, isYmd, periodBuckets, periodRange, shiftPeriod, weekdayOccurrences } from "@/lib/period";

describe("periodos de estadísticas", () => {
  test("rangos de día, semana (lunes a domingo), mes y año", () => {
    expect(periodRange("day", "2026-10-20")).toEqual({ from: "2026-10-20", to: "2026-10-20" });
    expect(periodRange("week", "2026-10-20")).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(periodRange("week", "2026-10-25")).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(periodRange("month", "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(periodRange("year", "2026-10-20")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  test("desplazar periodos devuelve el primer día del destino", () => {
    expect(shiftPeriod("day", "2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftPeriod("week", "2026-10-22", -1)).toBe("2026-10-12");
    expect(shiftPeriod("month", "2026-01-31", -1)).toBe("2025-12-01");
    expect(shiftPeriod("month", "2026-12-15", 1)).toBe("2027-01-01");
    expect(shiftPeriod("year", "2026-10-20", -1)).toBe("2025-01-01");
  });

  test("barras por día en semana/mes, por mes en año y ninguna en un día", () => {
    expect(periodBuckets("day", periodRange("day", "2026-10-20"))).toBeNull();
    expect(periodBuckets("week", periodRange("week", "2026-10-20"))?.keys).toHaveLength(7);
    const month = periodBuckets("month", periodRange("month", "2026-02-03"))!;
    expect(month.unit).toBe("day");
    expect(month.keys.at(-1)).toBe("2026-02-28");
    const year = periodBuckets("year", periodRange("year", "2026-05-01"))!;
    expect(year).toEqual({ unit: "month", keys: expect.arrayContaining(["2026-01", "2026-12"]) });
    expect(year.keys).toHaveLength(12);
  });

  test("días transcurridos se cortan en hoy", () => {
    const oct = periodRange("month", "2026-10-01");
    expect(elapsedDays(oct, "2026-10-20")).toBe(20);
    expect(elapsedDays(oct, "2026-11-05")).toBe(31);
    expect(elapsedDays(oct, "2026-09-30")).toBe(0);
  });

  test("ocurrencias de cada día de la semana (lunes primero)", () => {
    // Octubre 2026 empieza en jueves y tiene 31 días: jueves, viernes y sábado aparecen 5 veces
    expect(weekdayOccurrences(periodRange("month", "2026-10-01"))).toEqual([4, 4, 4, 5, 5, 5, 4]);
    expect(weekdayOccurrences({ from: "2026-10-19", to: "2026-10-20" })).toEqual([1, 1, 0, 0, 0, 0, 0]);
  });

  test("valida fechas reales", () => {
    expect(isYmd("2026-02-29")).toBe(false);
    expect(isYmd("2028-02-29")).toBe(true);
    expect(isYmd("2026-1-01")).toBe(false);
    expect(isYmd(undefined)).toBe(false);
  });
});
