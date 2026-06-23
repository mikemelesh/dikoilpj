export function todayDateInputValue(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function clampDateNotAfterToday(value: string): string {
  const today = todayDateInputValue();
  return value > today ? today : value;
}

export function applyDateRangeRules(
  prev: Record<string, string>,
  key: string,
  value: string,
  dateFromKey: string,
  dateToKey: string,
): Record<string, string> {
  const clamped = value ? clampDateNotAfterToday(value) : "";
  const next = { ...prev, [key]: clamped };

  if (key === dateFromKey && clamped && next[dateToKey] && next[dateToKey] < clamped) {
    next[dateToKey] = clamped;
  }

  if (key === dateToKey && clamped && next[dateFromKey] && next[dateFromKey] > clamped) {
    next[dateFromKey] = clamped;
  }

  return next;
}
