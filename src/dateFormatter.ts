/**
 * Formats a byte count into a human-readable size string.
 */
export type TimeZoneOffset = 'system' | string;

interface DisplayTimeZone {
  fixedOffsetMinutes?: number;
  timeZone?: string;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/**
 * Formats a Date object into either a relative or full timestamp.
 */
export function formatDate(
  date: Date,
  format: 'relative' | 'full',
  timeZoneOffset: TimeZoneOffset = 'system'
): string {
  switch (format) {
    case 'relative':
      return relativeTime(date);
    case 'full':
    default:
      return fullDate(date, resolveTimeZoneOffset(timeZoneOffset));
  }
}

function fullDate(date: Date, displayTimeZone: DisplayTimeZone): string {
  const displayDate = toDisplayDate(date, displayTimeZone);
  return displayDate.toLocaleString(undefined, {
    timeZone: getIntlTimeZone(displayTimeZone),
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getCurrentTimeZone(): string | undefined {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function getIntlTimeZone(displayTimeZone: DisplayTimeZone): string | undefined {
  return displayTimeZone.fixedOffsetMinutes === undefined ? displayTimeZone.timeZone : 'UTC';
}

function toDisplayDate(date: Date, displayTimeZone: DisplayTimeZone): Date {
  if (displayTimeZone.fixedOffsetMinutes === undefined) {
    return date;
  }

  return new Date(date.getTime() + displayTimeZone.fixedOffsetMinutes * 60_000);
}

function resolveTimeZoneOffset(timeZoneOffset: TimeZoneOffset): DisplayTimeZone {
  const normalized = timeZoneOffset.trim();
  if (!normalized || normalized === 'system') {
    return { timeZone: getCurrentTimeZone() };
  }

  const match = normalized.match(/^UTC([+-])(\d{1,2})(?::([0-5]\d))?$/i);
  if (!match) {
    return { timeZone: getCurrentTimeZone() };
  }

  const sign = match[1] === '+' ? 1 : -1;
  const hours = Number.parseInt(match[2], 10);
  const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
  if (hours > 14 || (hours === 14 && minutes > 0)) {
    return { timeZone: getCurrentTimeZone() };
  }

  const totalMinutes = sign * (hours * 60 + minutes);
  return { fixedOffsetMinutes: totalMinutes };
}

function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
}
