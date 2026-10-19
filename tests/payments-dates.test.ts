import { describe, expect, test } from "bun:test";
import { addMonthsAnchored, advanceDue, diffDays, dueDateAfter, dueLabel, lastStatementDate, nextOccurrenceOfDay } from "@/lib/payments-shared";

describe("fechas de pagos", () => {
  test("los meses cortos usan su último día y luego vuelven al día de referencia", () => {
    expect(addMonthsAnchored("2026-01-31", 1, 31)).toBe("2026-02-28");
    expect(addMonthsAnchored("2026-02-28", 1, 31)).toBe("2026-03-31");
    expect(addMonthsAnchored("2028-01-31", 1, 31)).toBe("2028-02-29");
  });

  test("advanceDue según la frecuencia", () => {
    expect(advanceDue("2026-10-19", "weekly", null)).toBe("2026-10-26");
    expect(advanceDue("2026-10-19", "biweekly", null)).toBe("2026-11-02");
    expect(advanceDue("2026-10-31", "monthly", 31)).toBe("2026-11-30");
    expect(advanceDue("2026-10-19", "yearly", null)).toBe("2027-10-19");
    expect(advanceDue("2026-10-19", "once", null)).toBe("2026-10-19");
  });

  test("diffDays y nextOccurrenceOfDay", () => {
    expect(diffDays("2026-10-25", "2026-10-19")).toBe(6);
    expect(nextOccurrenceOfDay(25, "2026-10-19")).toBe("2026-10-25");
    expect(nextOccurrenceOfDay(10, "2026-10-19")).toBe("2026-11-10");
  });

  test("dueLabel", () => {
    const l = {
      today: "Today",
      tomorrow: "Tomorrow",
      yesterday: "Yesterday",
      inDays: { one: "In {n} day", other: "In {n} days" },
      overdueDays: { one: "{n} day overdue", other: "{n} days overdue" },
    };
    expect(dueLabel(0, l)).toBe("Today");
    expect(dueLabel(3, l)).toBe("In 3 days");
    expect(dueLabel(-1, l)).toBe("Yesterday");
    expect(dueLabel(-4, l)).toBe("4 days overdue");
  });
});

describe("ciclo de tarjeta de crédito", () => {
  test("último corte: este mes si ya pasó, si no el anterior", () => {
    expect(lastStatementDate(15, "2026-10-19")).toBe("2026-10-15");
    expect(lastStatementDate(19, "2026-10-19")).toBe("2026-10-19");
    expect(lastStatementDate(25, "2026-10-19")).toBe("2026-09-25");
    expect(lastStatementDate(28, "2026-01-05")).toBe("2025-12-28");
    // Corte el 31: en meses cortos es su último día
    expect(lastStatementDate(31, "2026-02-28")).toBe("2026-02-28");
    expect(lastStatementDate(31, "2026-03-10")).toBe("2026-02-28");
  });

  test("fecha de pago: el primer día de pago después del corte", () => {
    expect(dueDateAfter("2026-10-15", 5)).toBe("2026-11-05");
    expect(dueDateAfter("2026-10-05", 25)).toBe("2026-10-25");
    expect(dueDateAfter("2026-10-15", 15)).toBe("2026-11-15");
    expect(dueDateAfter("2026-12-20", 10)).toBe("2027-01-10");
    expect(dueDateAfter("2026-01-31", 30)).toBe("2026-02-28");
  });
});
