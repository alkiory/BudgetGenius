export type TimeOfDay = "morning" | "afternoon" | "night";

export const MAX_GREETINGS_PER_PERIOD = 7;

/**
 * Classifies the local hour into a time-of-day bucket for dashboard greetings.
 * - morning: 05:00 - 11:59
 * - afternoon: 12:00 - 18:59
 * - night: 19:00 - 04:59
 */
export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 19) return "afternoon";
  return "night";
}

/**
 * Picks one greeting from up to `MAX_GREETINGS_PER_PERIOD` candidates.
 */
export function pickRandomGreeting(
  messages: readonly string[],
  randomFn: () => number = Math.random,
): string {
  if (!Array.isArray(messages) || messages.length === 0) return "";
  const pool = messages.slice(0, MAX_GREETINGS_PER_PERIOD);
  const clamped = Math.min(Math.max(randomFn(), 0), 0.999999999999);
  const index = Math.floor(clamped * pool.length);
  return pool[index] ?? pool[0] ?? "";
}
