const LOCALE = "en-IN";

export function formatDate(
  date: string | Date | null,
  opts?: { month?: "short" | "long"; year?: boolean },
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const format: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: opts?.month ?? "long",
  };
  if (opts?.year !== false) format.year = "numeric";
  return d.toLocaleDateString(LOCALE, format);
}

export function formatDateRange(
  start: string | Date | null,
  end: string | Date | null,
): string {
  if (!start || !end) return "—";
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  const startStr = s.toLocaleDateString(LOCALE, {
    month: "short",
    day: "numeric",
  });
  const endStr = e.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
  }).format(amount / 100);
}
