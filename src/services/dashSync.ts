import type { Game, Season } from "../types";
import { fetchTeam, fetchLeagueTeams, fetchLeagueGames, buildSyncPlan, type SyncPlan } from "./dash";
import { createGame, updateGame, updateSeason, updateStandings, findOrCreateOpponent } from "./firestore";

// Read-only: fetch from DaySmart and diff against local games.
export async function previewDashSync(season: Season, existingGames: Game[]): Promise<SyncPlan> {
  if (!season.dashTeamId) throw new Error("This season has no DaySmart team ID.");
  const ourTeam = await fetchTeam(season.dashTeamId);
  const [teams, games] = await Promise.all([
    fetchLeagueTeams(ourTeam.leagueId),
    fetchLeagueGames(ourTeam.leagueId),
  ]);
  return buildSyncPlan(ourTeam, teams, games, season.id, existingGames);
}

// Writes the plan: creates/updates games and replaces the season standings.
export async function applyDashSync(teamId: string, season: Season, plan: SyncPlan, uid: string) {
  for (const c of plan.creates) {
    const opponentId = await findOrCreateOpponent(teamId, c.opponent);
    await createGame(teamId, {
      seasonId: season.id,
      date: c.date,
      time: c.time,
      opponent: c.opponent,
      opponentId,
      dashEventId: c.dashEventId,
      ourScore: c.ourScore,
      theirScore: c.theirScore,
      scorers: [],
      assists: [],
      goalTimeline: [],
      keeperAppearances: [],
      absentPlayerIds: [],
      isPlayoff: c.isPlayoff,
      notes: "",
      updatedBy: uid,
    }, uid);
  }
  for (const u of plan.updates) {
    const changes = { ...u.changes };
    if (u.opponentName) changes.opponentId = await findOrCreateOpponent(teamId, u.opponentName);
    await updateGame(teamId, u.gameId, changes, uid);
  }
  await updateStandings(teamId, season.id, plan.standings);
  await updateSeason(teamId, season.id, { dashLastSyncAt: new Date().toISOString() });
}
