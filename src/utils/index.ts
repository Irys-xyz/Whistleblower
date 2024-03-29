import { type PathLike, promises } from "fs";

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export const checkPath = async (path: PathLike): Promise<boolean> => {
  return promises
    .stat(path)
    .then((_) => true)
    .catch((_) => false);
};

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
export function fmtErrorConcise(e: any): string | undefined {
  return e?.stack ?? e?.message ?? e.toString();
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

export async function chunked<T = any, R = any>(
  src: T[],
  sink: (items: T[]) => Promise<R>,
  opts?: { chunkLength?: number },
): Promise<R[]> {
  const chunkLength = opts?.chunkLength ?? 50;
  const results: R[] = [];
  for (let i = 0; i < src.length; i += chunkLength) {
    results.push(await sink(src.slice(i, i + chunkLength)));
  }
  return results;
}
