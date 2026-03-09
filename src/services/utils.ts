import type { StandingsRow, Game, GameResult } from "../types";

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
