/**
 * Formats a Date object into a human-readable string.
 *
 * @param date   - The date to format
 * @param format - "short" | "relative" | "full"
 */
export function formatDate(date: Date, format: 'short' | 'relative' | 'full'): string {
  switch (format) {
    case 'relative':
      return relativeTime(date);
    case 'full':
      return date.toLocaleString();
    case 'short':
    default:
      return shortDate(date);
  }
}

function shortDate(date: Date): string {
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  const datePart = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });

  const timePart = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${datePart}, ${timePart}`;
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
