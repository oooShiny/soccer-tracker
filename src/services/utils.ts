import type { StandingsRow, Game, GameResult, Player } from "../types";

// ─── Player availability ──────────────────────────────────────────
// Player wasn't on the roster for the game's season at all
export const isInactiveForGame = (g: Game, p: Player): boolean =>
  (p.inactiveSeasonIds || []).includes(g.seasonId);

// Player was on the roster but didn't play
export const isAbsentFromGame = (g: Game, p: Player): boolean =>
  (g.absentPlayerIds || []).includes(p.id);

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

// ─── Live Game Detection ──────────────────────────────────────────
// A game counts as "live" from shortly before kickoff until it should be over.
const LIVE_BEFORE_MIN = 15;
const LIVE_AFTER_MIN = 90;

const parseTimeToMinutes = (time: string): number | null => {
  const m = normalizeTime(time).match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
  if (!m) return null;
  let h = parseInt(m[1]) % 12;
  if (m[3] === "PM") h += 12;
  return h * 60 + parseInt(m[2]);
};

const localIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const isGameLive = (game: Game, now: Date = new Date()): boolean => {
  if (game.date !== localIsoDate(now)) return false;
  const start = parseTimeToMinutes(game.time);
  if (start == null) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= start - LIVE_BEFORE_MIN && nowMin <= start + LIVE_AFTER_MIN;
};

// ─── Player Display Names ─────────────────────────────────────────
// First names only, adding the last-name initial when two players share a first name.
export const buildShortNames = (players: Player[]): Record<string, string> => {
  const first = (p: Player) => p.name.trim().split(/\s+/)[0];
  const counts: Record<string, number> = {};
  for (const p of players) { const f = first(p).toLowerCase(); counts[f] = (counts[f] || 0) + 1; }
  const out: Record<string, string> = {};
  for (const p of players) {
    const parts = p.name.trim().split(/\s+/);
    const f = parts[0];
    out[p.id] = counts[f.toLowerCase()] > 1 && parts.length > 1 ? `${f} ${parts[parts.length - 1][0]}.` : f;
  }
  return out;
};

// ─── Goalkeeper Stats ─────────────────────────────────────────────
// `apps` is fractional: a keeper who played 50% of a game is credited half a game.
export interface KeeperEntry { playerId: string; name: string; number: number; apps: number; ga: number; gaPerApp: number; cleanSheets: number; }
export function computeKeeperLeaderboard(games: Game[], players: Player[]): KeeperEntry[] {
  const keeperMap: Record<string, { apps: number; ga: number; cleanSheets: number }> = {};

  for (const game of games) {
    if (game.ourScore == null) continue;
    for (const ka of game.keeperAppearances) {
      if (!keeperMap[ka.playerId]) keeperMap[ka.playerId] = { apps: 0, ga: 0, cleanSheets: 0 };
      // Use pct if available, fall back to minutes/90 for legacy data
      const pct = ka.pct != null ? ka.pct : (ka.minutes ? Math.round((ka.minutes / 90) * 100) : 100);
      keeperMap[ka.playerId].apps += pct / 100;
      keeperMap[ka.playerId].ga += ka.goalsAgainst;
      if (ka.goalsAgainst === 0 && pct >= 45) keeperMap[ka.playerId].cleanSheets++;
    }
  }

  return Object.entries(keeperMap).map(([id, d]) => {
    const p = players.find(pl => pl.id === id);
    return {
      playerId: id, name: p?.name || "Unknown", number: p?.number || 0,
      apps: Math.round(d.apps * 100) / 100, ga: d.ga, // round away float drift (e.g. 0.33 + 0.67)
      gaPerApp: d.apps > 0 ? d.ga / d.apps : 0,
      cleanSheets: d.cleanSheets,
    };
  }).sort((a, b) => a.gaPerApp - b.gaPerApp || b.apps - a.apps); // lower GA/G is better; more apps breaks ties
}

// Fractional keeper games: whole numbers as-is, otherwise one decimal (e.g. 3.5)
export const formatKeeperGames = (apps: number): string =>
  Number.isInteger(apps) ? String(apps) : apps.toFixed(1);
