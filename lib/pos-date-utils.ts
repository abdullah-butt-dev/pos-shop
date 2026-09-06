/**
 * Utility functions for handling dates in Pakistan Standard Time (PKT, UTC+5 / Asia/Karachi).
 * Ensures that both client and server (which may run in UTC) always evaluate
 * calendar dates against the shop's local timezone.
 */

const PK_TIMEZONE = "Asia/Karachi";

/**
 * Returns a date string formatted as YYYY-MM-DD in the Asia/Karachi timezone.
 */
export function getPakistanDate(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Returns yesterday's date string formatted as YYYY-MM-DD in Asia/Karachi timezone.
 */
export function getPakistanYesterday(): string {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return getPakistanDate(yesterday);
}

/**
 * Returns the start of the current week (Monday) in Asia/Karachi timezone.
 */
export function getPakistanWeekStart(): string {
  const todayStr = getPakistanDate();
  const [year, month, day] = todayStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = d.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the start of the current month (YYYY-MM-01) in Asia/Karachi timezone.
 */
export function getPakistanMonthStart(): string {
  const todayStr = getPakistanDate();
  const [year, month] = todayStr.split("-");
  return `${year}-${month}-01`;
}

