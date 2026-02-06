/**
 * Week Calculation Utilities
 *
 * Functions for calculating ISO week numbers and handling UK timezone
 */

import type { WeekInfo } from '../types';

/**
 * Get the ISO week number for a given date
 * ISO weeks start on Monday and week 1 contains the first Thursday of the year
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Set to nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNum;
}

/**
 * Get the ISO week year for a given date
 * This may differ from the calendar year at year boundaries
 */
export function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

/**
 * Get the current week info based on UK timezone
 */
export function getCurrentWeekInfo(): WeekInfo {
  const now = getUKDate();
  const weekNumber = getISOWeekNumber(now);
  const year = getISOWeekYear(now);

  return {
    weekNumber,
    year,
    startDate: getWeekStartDate(weekNumber, year),
    endDate: getWeekEndDate(weekNumber, year),
  };
}

/**
 * Get the previous week info based on UK timezone
 */
export function getPreviousWeekInfo(): WeekInfo {
  const now = getUKDate();
  // Go back 7 days to ensure we're in the previous week
  const previousWeekDate = new Date(now);
  previousWeekDate.setDate(previousWeekDate.getDate() - 7);

  const weekNumber = getISOWeekNumber(previousWeekDate);
  const year = getISOWeekYear(previousWeekDate);

  return {
    weekNumber,
    year,
    startDate: getWeekStartDate(weekNumber, year),
    endDate: getWeekEndDate(weekNumber, year),
  };
}

/**
 * Get the start date (Monday) of a specific ISO week
 */
export function getWeekStartDate(weekNumber: number, year: number): Date {
  // Find January 4th of the year (always in week 1)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Monday = 1, Sunday = 7

  // Find the Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));

  // Add the appropriate number of weeks
  const targetMonday = new Date(week1Monday);
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7);

  return targetMonday;
}

/**
 * Get the end date (Sunday) of a specific ISO week
 */
export function getWeekEndDate(weekNumber: number, year: number): Date {
  const monday = getWeekStartDate(weekNumber, year);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return sunday;
}

/**
 * Get the current date in UK timezone
 */
export function getUKDate(): Date {
  // Get current UTC time
  const now = new Date();

  // Format in UK timezone and parse back
  const ukString = now.toLocaleString('en-GB', { timeZone: 'Europe/London' });
  const [datePart, timePart] = ukString.split(', ');
  const [day, month, year] = datePart.split('/').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);

  return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * Check if we're currently in British Summer Time (BST)
 */
export function isCurrentlyBST(): boolean {
  const now = new Date();
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);

  // Get the offset difference between January and July
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());

  // Check if current offset is less than standard (meaning DST is active)
  // For UK: GMT = UTC+0, BST = UTC+1
  const ukOffset = getUKOffset();
  return ukOffset === 1;
}

/**
 * Get the current UK timezone offset in hours (0 for GMT, 1 for BST)
 */
export function getUKOffset(): number {
  const now = new Date();
  const ukTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  return (ukTime.getTime() - utcTime.getTime()) / (1000 * 60 * 60);
}

/**
 * Format a date as ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format a date for display (e.g., "Mon 5 Feb 2026")
 */
export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
}

/**
 * Check if a week/year combination is the current week
 */
export function isCurrentWeek(weekNumber: number, year: number): boolean {
  const current = getCurrentWeekInfo();
  return current.weekNumber === weekNumber && current.year === year;
}

/**
 * Check if a week/year combination is the previous week
 */
export function isPreviousWeek(weekNumber: number, year: number): boolean {
  const previous = getPreviousWeekInfo();
  return previous.weekNumber === weekNumber && previous.year === year;
}

/**
 * Parse a timestamp string to week/year
 */
export function timestampToWeekInfo(timestamp: string): { weekNumber: number; year: number } {
  const date = new Date(timestamp);
  return {
    weekNumber: getISOWeekNumber(date),
    year: getISOWeekYear(date),
  };
}
