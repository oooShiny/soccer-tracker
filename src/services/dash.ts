// DaySmart Recreation ("Dash") public JSON:API client + sync planner.
// The API is unauthenticated for reads; every call is scoped by ?company=.
import type { Game, StandingsRow } from "../types";

const API_BASE = "https://api.dashplatform.com/v1";
export const DASH_COMPANY = "nhsportsplex";

interface JsonApiResource<A = any> { id: string; type: string; attributes: A }
interface JsonApiList<A = any> {
  data: JsonApiResource<A>[];
  meta?: { page?: { "current-page": number; "last-page": number } };
}

async function dashGet<T = any>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams({ company: DASH_COMPANY });
  Object.entries(params).forEach(([k, v]) => qs.set(k, String(v)));
  const res = await fetch(`${API_BASE}/${path}?${qs.toString()}`);
  if (!res.ok) throw new Error(`DaySmart API ${res.status} on ${path}`);
  return res.json();
}

async function dashGetAll<A = any>(path: string, params: Record<string, string | number>): Promise<JsonApiResource<A>[]> {
  const out: JsonApiResource<A>[] = [];
  let page = 1;
  for (;;) {
    const r = await dashGet<JsonApiList<A>>(path, { ...params, "page[size]": 100, "page[number]": page });
    out.push(...r.data);
    const last = r.meta?.page?.["last-page"] ?? 1;
    if (page >= last) break;
    page++;
  }
  return out;
}

// Dash stores some names with stray backslashes and HTML entities.
const ENTITIES: Record<string, string> = { amp: "&", rsquo: "’", lsquo: "‘", quot: '"', apos: "'", nbsp: " " };
export const cleanName = (raw: string): string =>
  String(raw)
    .replace(/\\+/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (m, e) =>
      e[0] === "#" ? String.fromCharCode(parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();

// ─── Fetching ─────────────────────────────────────────────────────
export interface DashTeam { id: number; name: string; leagueId: number }
export interface DashGame {
  eventId: number;
  date: string;   // YYYY-MM-DD (facility local)
  time: string;   // "8:30 PM"
  homeId: number;
  awayId: number;
  homeScore: number | null;
  awayScore: number | null;
  isPlayoff: boolean;
}

export async function fetchTeam(teamId: number): Promise<DashTeam> {
  const r = await dashGet<{ data: JsonApiResource }>(`teams/${teamId}`);
  return { id: Number(r.data.id), name: cleanName(r.data.attributes.name), leagueId: r.data.attributes.league_id };
}

export async function fetchLeagueTeams(leagueId: number): Promise<DashTeam[]> {
  const rows = await dashGetAll("teams", { "filter[league_id]": leagueId });
  return rows.map((t) => ({ id: Number(t.id), name: cleanName(t.attributes.name), leagueId }));
}

const to12h = (hhmmss: string): string => {
  const [h, m] = hhmmss.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export async function fetchLeagueGames(leagueId: number): Promise<DashGame[]> {
  const rows = await dashGetAll("events", {
    "filter[league_id]": leagueId,
    "filter[event_type_id]": "g",
    sort: "start",
  });
  return rows
    .filter((e) => e.attributes.publish !== false && e.attributes.hteam_id && e.attributes.vteam_id)
    .map((e) => {
      const a = e.attributes;
      const [date, time] = String(a.start).split("T");
      return {
        eventId: Number(e.id),
        date,
        time: to12h(time),
        homeId: a.hteam_id,
        awayId: a.vteam_id,
        homeScore: a.home_score ?? null,
        awayScore: a.visiting_score ?? null,
        isPlayoff: a.sub_type === "playoff",
      };
    });
}

// ─── Standings ────────────────────────────────────────────────────
// Same convention as the rest of the app: our row is labelled "Our Team".
export function computeStandings(teams: DashTeam[], games: DashGame[], ourTeamId: number): StandingsRow[] {
  const rows = new Map<number, StandingsRow>(
    teams.map((t) => [t.id, { team: t.id === ourTeamId ? "Our Team" : t.name, w: 0, d: 0, l: 0, gf: 0, ga: 0 }])
  );
  for (const g of games) {
    if (g.isPlayoff || g.homeScore == null || g.awayScore == null) continue;
    const home = rows.get(g.homeId);
    const away = rows.get(g.awayId);
    if (home) { home.gf += g.homeScore; home.ga += g.awayScore; }
    if (away) { away.gf += g.awayScore; away.ga += g.homeScore; }
    if (g.homeScore === g.awayScore) {
      if (home) home.d++;
      if (away) away.d++;
    } else {
      const [win, lose] = g.homeScore > g.awayScore ? [home, away] : [away, home];
      if (win) win.w++;
      if (lose) lose.l++;
    }
  }
  return [...rows.values()];
}

// ─── Sync plan ────────────────────────────────────────────────────
export interface GameCreate {
  dashEventId: number; date: string; time: string; opponent: string;
  ourScore: number | null; theirScore: number | null; isPlayoff: boolean;
}
export interface GameUpdate {
  gameId: string;
  changes: Partial<Game>;
  opponentName?: string; // set when a placeholder is adopted; apply step resolves opponentId
}
export interface SyncPlan {
  teamName: string;
  leagueId: number;
  standings: StandingsRow[];
  creates: GameCreate[];
  updates: GameUpdate[];
  unchanged: number;
  adoptedPlaceholders: number;
  leftoverPlaceholders: number; // empty "TBD" games with no Dash match (never deleted)
}

const norm = (s: string) => s.trim().toLowerCase();
// Games auto-created at season creation: opponent "TBD", no scores, nothing recorded.
const isPlaceholder = (g: Game) =>
  (!g.opponent || norm(g.opponent) === "tbd") && g.ourScore == null && g.theirScore == null;
const dayDiff = (a: string, b: string) =>
  Math.abs(Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 86400000;

// Pure function: compares Dash with what's stored locally. Never deletes, and
// never overwrites a score that already exists locally (those may carry goal
// timelines / keeper stats entered by hand).
export function buildSyncPlan(
  ourTeam: DashTeam,
  teams: DashTeam[],
  games: DashGame[],
  seasonId: string,
  existing: Game[]
): SyncPlan {
  const nameById = new Map(teams.map((t) => [t.id, t.name]));
  const seasonGames = existing.filter((g) => g.seasonId === seasonId);
  const byEventId = new Map(seasonGames.filter((g) => g.dashEventId != null).map((g) => [g.dashEventId!, g]));
  const unlinked = seasonGames.filter((g) => g.dashEventId == null);

  const creates: GameCreate[] = [];
  const updates: GameUpdate[] = [];
  let unchanged = 0;
  let adoptedCount = 0;

  for (const dg of games) {
    const isHome = dg.homeId === ourTeam.id;
    if (!isHome && dg.awayId !== ourTeam.id) continue;
    const opponent = nameById.get(isHome ? dg.awayId : dg.homeId) ?? "Unknown";
    const ourScore = isHome ? dg.homeScore : dg.awayScore;
    const theirScore = isHome ? dg.awayScore : dg.homeScore;

    let local = byEventId.get(dg.eventId);
    let adopted = false;
    if (!local) {
      // 1. Hand-entered game: same date and opponent.
      let i = unlinked.findIndex((g) => g.date === dg.date && norm(g.opponent) === norm(opponent));
      // 2. Auto-created placeholder on the same date.
      if (i < 0) i = unlinked.findIndex((g) => g.date === dg.date && isPlaceholder(g));
      // 3. Placeholder within 3 days (season start date wasn't the game weekday).
      if (i < 0) {
        let best = 4;
        unlinked.forEach((g, j) => {
          const d = dayDiff(g.date, dg.date);
          if (isPlaceholder(g) && d < best) { best = d; i = j; }
        });
      }
      if (i >= 0) { local = unlinked.splice(i, 1)[0]; adopted = isPlaceholder(local); if (adopted) adoptedCount++; }
    }

    if (!local) {
      creates.push({ dashEventId: dg.eventId, date: dg.date, time: dg.time, opponent, ourScore, theirScore, isPlayoff: dg.isPlayoff });
      continue;
    }

    const changes: Partial<Game> = {};
    if (adopted) { changes.opponent = opponent; changes.isPlayoff = dg.isPlayoff; }
    if (local.dashEventId !== dg.eventId) changes.dashEventId = dg.eventId;
    if (local.date !== dg.date) changes.date = dg.date;
    if (local.time !== dg.time) changes.time = dg.time;
    if (local.ourScore == null && local.theirScore == null && ourScore != null && theirScore != null) {
      changes.ourScore = ourScore;
      changes.theirScore = theirScore;
    }
    if (Object.keys(changes).length) updates.push({ gameId: local.id, changes, opponentName: adopted ? opponent : undefined });
    else unchanged++;
  }

  return {
    teamName: ourTeam.name,
    leagueId: ourTeam.leagueId,
    standings: computeStandings(teams, games, ourTeam.id),
    creates,
    updates,
    unchanged,
    adoptedPlaceholders: adoptedCount,
    leftoverPlaceholders: unlinked.filter(isPlaceholder).length,
  };
}
