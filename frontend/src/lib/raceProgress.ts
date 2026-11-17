/** Where the athlete is in a typical 26-week race build. */
export const BUILD_WEEKS = 26;

export function buildProgress(daysToRace: number | null) {
  if (daysToRace === null || daysToRace < 0) return null;
  const weeksToGo = Math.floor(daysToRace / 7);
  const started = weeksToGo < BUILD_WEEKS;
  const week = started ? BUILD_WEEKS - weeksToGo : 0;
  return {
    weeksToGo,
    week,
    started,
    /** 0-1 share of the build done. */
    fraction: started ? week / BUILD_WEEKS : 0,
    startsInWeeks: started ? 0 : weeksToGo - BUILD_WEEKS + 1,
  };
}
