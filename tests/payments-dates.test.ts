import { describe, expect, test } from "bun:test";
import { addMonthsAnchored, advanceDue, diffDays, dueLabel, nextOccurrenceOfDay } from "@/lib/payments-shared";

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
