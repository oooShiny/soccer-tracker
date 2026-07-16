import type { StandingsRow, Game, GameResult, Player } from "../types";

// ─── Standings ────────────────────────────────────────────────────
export const calcPoints = (row: StandingsRow): number => row.w * 3 + row.d;

export const sortStandings = (standings: StandingsRow[]): StandingsRow[] =>
  [...standings].sort(
    (a, b) =>
      calcPoints(b) - calcPoints(a) || (b.gf - b.ga) - (a.gf - a.ga)
  );

export const getOurPosition = (standings: StandingsRow[]): number =>
  sortStandings(standings).findIndex((s) => s.team === "Our Team") + 1;

export const positionSuffix = (pos: number): string => {
  if (pos === 1) return "st";
  if (pos === 2) return "nd";
  if (pos === 3) return "rd";
  return "th";
};

// ─── Game Results ─────────────────────────────────────────────────
export const getResult = (game: Game): GameResult => {
  if (game.ourScore == null || game.theirScore == null) return "Upcoming";
  if (game.ourScore > game.theirScore) return "W";
  if (game.ourScore < game.theirScore) return "L";
  return "D";
};

export const getResultColor = (result: GameResult) => {
  const { colors } = require("../theme");
  switch (result) {
    case "W": return colors.accent;
    case "L": return colors.danger;
    case "D": return colors.warn;
    default: return colors.textDim;
  }
};

// ─── Formatting ───────────────────────────────────────────────────
export const formatDate = (dateStr: string): string =>
  new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

export const formatDateLong = (dateStr: string): string =>
  new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// ─── Time Normalization ───────────────────────────────────────────
// Converts any time format to canonical "H:MM AM/PM" format
export const normalizeTime = (time: string): string => {
  if (!time || !time.trim()) return "";
  const t = time.trim();

  // Already canonical: "8:00 PM"
  const match12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm|Am|Pm)$/);
  if (match12) {
    let h = parseInt(match12[1]);
    const m = match12[2];
    const ampm = match12[3].toUpperCase();
    // Normalize 12h to consistent format
    return `${h}:${m} ${ampm}`;
  }

  // 24h format: "20:00" or "20:30"
  const match24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let h = parseInt(match24[1]);
    const m = match24[2];
    const ampm = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  // No-space variant: "8:00PM"
  const matchNoSpace = t.match(/^(\d{1,2}):(\d{2})(AM|PM|am|pm)$/i);
  if (matchNoSpace) {
    const h = parseInt(matchNoSpace[1]);
    const m = matchNoSpace[2];
    const ampm = matchNoSpace[3].toUpperCase();
    return `${h}:${m} ${ampm}`;
  }

  return t; // return as-is if we can't parse
};

// Buckets a game time into a time-of-day category for reporting
export const getTimeOfDayBucket = (time: string): "Morning" | "Afternoon" | "Evening" | "Unknown" => {
  const normalized = normalizeTime(time);
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!match) return "Unknown";
  let h = parseInt(match[1]);
  const period = match[3];
  if (period === "AM") { if (h === 12) h = 0; } else { if (h !== 12) h += 12; }
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
};

// ─── Player Availability ──────────────────────────────────────────
// Date-aware roster filter: a deactivated player is only hidden from games
// dated after their deactivation, so past games can still be corrected.
export const isPlayerAvailableForGame = (player: Player, gameDate: string): boolean => {
  if (player.active !== false) return true;
  if (!player.deactivatedAt) return false;
  return gameDate < player.deactivatedAt;
};

// ─── Season Stats ─────────────────────────────────────────────────
export const computeSeasonRecord = (games: Game[]) => {
  const played = games.filter((g) => g.ourScore != null);
  return {
    w: played.filter((g) => g.ourScore! > g.theirScore!).length,
    d: played.filter((g) => g.ourScore! === g.theirScore!).length,
    l: played.filter((g) => g.ourScore! < g.theirScore!).length,
    gf: played.reduce((s, g) => s + (g.ourScore ?? 0), 0),
    ga: played.reduce((s, g) => s + (g.theirScore ?? 0), 0),
    played: played.length,
    total: games.length,
  };
};

export const getRecentForm = (games: Game[], count: number = 5): GameResult[] =>
  games
    .filter((g) => g.ourScore != null)
    .slice(-count)
    .map(getResult);
