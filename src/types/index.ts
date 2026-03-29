// ─── Firestore Document Types ─────────────────────────────────────
// These match the data model defined in the architecture doc.

export type UserRole = "admin" | "editor" | "viewer";

export interface TeamMember {
  email: string;
  displayName: string;
  role: UserRole;
  joinedAt: Date;
  invitedBy: string; // uid
}

export interface StandingsRow {
  team: string; // "Our Team" for your team, opponent name otherwise
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
}

export type SeasonStatus = "Active" | "Completed";
export type SeasonResult = "Promoted" | "Relegated" | "Stayed" | null;

export interface Season {
  id: string;
  name: string;
  teamName: string;
  division: string;
  status: SeasonStatus;
  startDate: string; // ISO date
  endDate: string;
  result: SeasonResult;
  standings: StandingsRow[];
  createdAt: Date;
}

export interface KeeperAppearance {
  playerId: string;
  minutes: number;
  goalsAgainst: number;
  saves: number;
}

export interface GameScorer {
  playerId: string;
  goals: number;
}

export interface GameAssist {
  playerId: string;
  count: number;
}

export interface Game {
  id: string;
  seasonId: string;
  date: string; // ISO date
  time: string; // e.g. "8:30 PM" or ""
  opponent: string;
  ourScore: number | null;
  theirScore: number | null;
  scorers: GameScorer[];
  assists: GameAssist[];
  keeperAppearances: KeeperAppearance[];
  absentPlayerIds: string[]; // players who missed this game
  notes: string; // post-game recap
  createdAt: Date;
  updatedBy: string; // uid
}

export interface KeeperStats {
  appearances: number;
  minutesPlayed: number;
  goalsAgainst: number;
  saves: number;
  cleanSheets: number;
}

export interface Player {
  id: string;
  name: string;
  number: number;
  positions: string[];
  canPlayKeeper: boolean;
  goals: number;
  assists: number;
  gamesPlayed: number;
  keeperStats: KeeperStats | null;
  active: boolean;
}

// ─── Computed / UI Types ──────────────────────────────────────────
export type GameResult = "W" | "D" | "L" | "Upcoming";

export interface SeasonWithGames extends Season {
  games: Game[];
  record: { w: number; d: number; l: number; gf: number; ga: number };
}
