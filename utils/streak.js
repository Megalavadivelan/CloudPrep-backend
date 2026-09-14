// Pure streak math — no I/O, so it's easy to reason about and reuse from
// both the recompute service and (if ever needed) a test file.
//
// A "day" is complete if the user has at least one Schedule item with that
// date whose status is "Finished" — the same rule Calendar.jsx already uses
// to paint a date green, so the streak and the calendar always agree.

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" for a Date, in UTC (see README note on timezone handling). */
export const toDateKey = (date) => date.toISOString().slice(0, 10);

export const todayKey = () => toDateKey(new Date());

const addDays = (dateKey, delta) => {
  const d = new Date(dateKey + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return toDateKey(d);
};

/**
 * @param {string[]} completedDateKeys - distinct "YYYY-MM-DD" dates on which
 *   the user completed at least one task. Order doesn't matter.
 * @returns {{ currentStreak: number, longestStreak: number, streakStartDate: string|null, lastCompletedDate: string|null }}
 */
export const computeStreak = (completedDateKeys) => {
  const dates = [...new Set(completedDateKeys)].sort(); // ascending "YYYY-MM-DD" sorts correctly as strings

  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, streakStartDate: null, lastCompletedDate: null };
  }

  const dateSet = new Set(dates);
  const lastCompletedDate = dates[dates.length - 1];

  // Longest run anywhere in the history.
  let longestStreak = 1;
  let runLength = 1;
  for (let i = 1; i < dates.length; i++) {
    if (addDays(dates[i - 1], 1) === dates[i]) {
      runLength += 1;
    } else {
      runLength = 1;
    }
    longestStreak = Math.max(longestStreak, runLength);
  }

  // Current run: must end today or yesterday to still be "alive" — a user
  // who hasn't completed today's task yet doesn't lose their streak until
  // the day fully passes without a completion.
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const anchor = dateSet.has(today) ? today : dateSet.has(yesterday) ? yesterday : null;

  if (!anchor) {
    return { currentStreak: 0, longestStreak, streakStartDate: null, lastCompletedDate };
  }

  let currentStreak = 1;
  let cursor = anchor;
  while (dateSet.has(addDays(cursor, -1))) {
    cursor = addDays(cursor, -1);
    currentStreak += 1;
  }

  return { currentStreak, longestStreak, streakStartDate: cursor, lastCompletedDate };
};
