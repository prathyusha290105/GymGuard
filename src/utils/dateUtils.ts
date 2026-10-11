import { MembershipStatus } from '../types';

/**
 * Format a Date to YYYY-MM-DD, respecting the gym's specific timezone if specified
 */
export function formatDateISO(date: Date = new Date(), timezone?: string): string {
  if (timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(date);
    } catch {
      // Fallback to local time if timezone invalid
    }
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculate the number of days remaining until end date (inclusive)
 */
export function getDaysRemaining(endDateStr: string, fromDateStr: string = formatDateISO()): number {
  if (!endDateStr) return -999;
  const start = new Date(fromDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  const diffTime = end.getTime() - start.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Compute the exact membership status according to the GymGuard business logic
 */
export function computeMembershipStatus(
  startDateStr: string,
  endDateStr: string,
  currentStatusOverride?: MembershipStatus,
  todayStr: string = formatDateISO()
): MembershipStatus {
  if (currentStatusOverride === 'FROZEN') return 'FROZEN';
  if (currentStatusOverride === 'SUSPENDED') return 'SUSPENDED';
  if (currentStatusOverride === 'CANCELLED') return 'CANCELLED';

  if (!startDateStr || !endDateStr) return 'EXPIRED';

  if (todayStr < startDateStr) {
    return 'NOT_STARTED';
  }

  if (todayStr > endDateStr) {
    return 'EXPIRED';
  }

  const daysLeft = getDaysRemaining(endDateStr, todayStr);
  if (daysLeft <= 7 && daysLeft >= 0) {
    return 'EXPIRING_SOON';
  }

  return 'ACTIVE';
}

/**
 * Format an ISO timestamp to human friendly time e.g., 09:32 AM
 */
export function formatTimeDisplay(isoString?: string): string {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Format an ISO timestamp to human friendly date e.g., Oct 15, 2026
 */
export function formatDateDisplay(isoString?: string): string {
  if (!isoString) return '---';
  const d = new Date(isoString.includes('T') ? isoString : isoString + 'T00:00:00');
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Calculate formatted duration string e.g. "1h 24m" or "42m"
 */
export function formatDuration(minutes?: number): string {
  if (minutes === undefined || minutes === null) return '0m';
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hrs}h ${mins}m`;
}
