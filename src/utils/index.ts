export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Generates a list of dates from `start` to `end` inclusive
 *
 * @param start
 * @param end
 */
export function generateDateRange(start: Date, end: Date, intervalMs = 24 * 60 * 60 * 1000): Date[] {
  const normalizedStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const normalizedEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const dateArray: Date[] = [];
  let currentDate = normalizedStart;
  while (currentDate <= normalizedEnd) {
    dateArray.push(new Date(currentDate));
    currentDate = new Date(currentDate.getTime() + intervalMs);
  }
  return dateArray;
}

export function fmtError(e: Error): string {
  return `${e.name}: ${e.message + " " + e.stack}`;
}

export function between(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}

export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}
