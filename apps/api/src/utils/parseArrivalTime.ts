/**
 * Parse an `arrival_time` text string into an absolute UTC Date.
 *
 * Input format examples (case-insensitive on "Today"/"Tomorrow" and "AM"/"PM"):
 *   - "Today, 04:00 PM - 05:00 PM"
 *   - "Tomorrow, 09:00 PM - 10:00 PM"
 *   - "Today, 12:00 AM - 01:00 AM"   (midnight start)
 *   - "Tomorrow, 12:00 PM - 01:00 PM" (noon start)
 *
 * Semantics:
 *   - The parsed time is the START of the slot range.
 *   - "Today" = the IST calendar date of `createdAt`.
 *   - "Tomorrow" = the IST calendar date of `createdAt` + 1 day.
 *   - IST = UTC+5:30.
 *
 * Returns `null` if the input cannot be parsed (unrecognized format, invalid
 * numbers, etc.). The caller should handle null gracefully — typically just
 * leave `slot_time_at` as NULL, which means the cron job won't fire reminders
 * for that order.
 *
 * Pure function — no side effects, no I/O.
 */
export function parseArrivalTime(
    arrivalTime: string | null | undefined,
    createdAt: Date
): Date | null {
    if (!arrivalTime) return null;

    // Match: "Today, 04:00 PM - 05:00 PM" or "Tomorrow, 09:00 PM - 10:00 PM"
    // Captures: day word, hour, minute, AM/PM. The END time of the range is intentionally ignored.
    const match = arrivalTime.match(/^(Today|Tomorrow),\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;

    const dayWord = match[1].toLowerCase();
    let hour = parseInt(match[2], 10);
    const minute = parseInt(match[3], 10);
    const ampm = match[4].toUpperCase();

    if (isNaN(hour) || isNaN(minute)) return null;
    if (minute < 0 || minute > 59) return null;
    if (hour < 1 || hour > 12) return null; // 12-hour clock

    // Convert 12-hour to 24-hour
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    // IST anchor: take the IST calendar date of createdAt as the day reference
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const createdAtIst = new Date(createdAt.getTime() + IST_OFFSET_MS);

    const istYear = createdAtIst.getUTCFullYear();
    const istMonth = createdAtIst.getUTCMonth();
    let istDay = createdAtIst.getUTCDate();

    if (dayWord === 'tomorrow') {
        istDay += 1;
        // Date.UTC handles month/year rollover automatically — no manual handling needed.
    }

    // Construct the IST timestamp by treating the IST components as if UTC,
    // then subtracting the IST offset to get the actual UTC instant.
    const istAsIfUtcMs = Date.UTC(istYear, istMonth, istDay, hour, minute, 0);
    const utcMs = istAsIfUtcMs - IST_OFFSET_MS;

    return new Date(utcMs);
}
