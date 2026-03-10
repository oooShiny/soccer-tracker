import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type {
  Season,
  Game,
  Player,
  TeamMember,
  StandingsRow,
  KeeperAppearance,
  GameScorer,
  GameAssist,
  UserRole,
} from "../types";

// ─── Collection Refs ──────────────────────────────────────────────
const teamRef = (teamId: string) => doc(db, "teams", teamId);
const seasonsRef = (teamId: string) => collection(db, "teams", teamId, "seasons");
const gamesRef = (teamId: string) => collection(db, "teams", teamId, "games");
const playersRef = (teamId: string) => collection(db, "teams", teamId, "players");
const membersRef = (teamId: string) => collection(db, "teams", teamId, "members");

// ─── Seasons ──────────────────────────────────────────────────────
export const subscribeToSeasons = (
  teamId: string,
  callback: (seasons: Season[]) => void
): Unsubscribe => {
  const q = query(seasonsRef(teamId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const seasons = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as Timestamp)?.toDate(),
    })) as Season[];
    callback(seasons);
  });
};

export const createSeason = async (
  teamId: string,
  data: Omit<Season, "id" | "createdAt">
) => {
  return addDoc(seasonsRef(teamId), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const updateSeason = async (
  teamId: string,
  seasonId: string,
  data: Partial<Season>
) => {
  const { id, ...rest } = data as any;
  return updateDoc(doc(seasonsRef(teamId), seasonId), rest);
};

export const updateStandings = async (
  teamId: string,
  seasonId: string,
  standings: StandingsRow[]
) => {
  return updateDoc(doc(seasonsRef(teamId), seasonId), { standings });
};

// ─── Games ────────────────────────────────────────────────────────
export const subscribeToGames = (
  teamId: string,
  callback: (games: Game[]) => void
): Unsubscribe => {
  const q = query(gamesRef(teamId), orderBy("date", "desc"));
  return onSnapshot(q, (snap) => {
    const games = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as Timestamp)?.toDate(),
    })) as Game[];
    callback(games);
  });
};

export const getGamesBySeason = (
  teamId: string,
  seasonId: string,
  callback: (games: Game[]) => void
): Unsubscribe => {
  const q = query(
    gamesRef(teamId),
    where("seasonId", "==", seasonId),
    orderBy("date", "asc")
  );
  return onSnapshot(q, (snap) => {
    const games = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as Timestamp)?.toDate(),
    })) as Game[];
    callback(games);
  });
};

export const createGame = async (
  teamId: string,
  data: Omit<Game, "id" | "createdAt">,
  uid: string
) => {
  return addDoc(gamesRef(teamId), {
    ...data,
    createdAt: serverTimestamp(),
    updatedBy: uid,
  });
};

export const updateGame = async (
  teamId: string,
  gameId: string,
  data: Partial<Game>,
  uid: string
) => {
  const { id, ...rest } = data as any;
  return updateDoc(doc(gamesRef(teamId), gameId), {
    ...rest,
    updatedBy: uid,
  });
};

export const deleteGame = async (teamId: string, gameId: string) => {
  return deleteDoc(doc(gamesRef(teamId), gameId));
};

// ─── Players ──────────────────────────────────────────────────────
export const subscribeToPlayers = (
  teamId: string,
  callback: (players: Player[]) => void
): Unsubscribe => {
  const q = query(playersRef(teamId), orderBy("name", "asc"));
  return onSnapshot(q, (snap) => {
    const players = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Player[];
    callback(players);
  });
};

export const createPlayer = async (
  teamId: string,
  data: Omit<Player, "id">
) => {
  return addDoc(playersRef(teamId), data);
};

export const updatePlayer = async (
  teamId: string,
  playerId: string,
  data: Partial<Player>
) => {
  const { id, ...rest } = data as any;
  return updateDoc(doc(playersRef(teamId), playerId), rest);
};

// ─── Members ──────────────────────────────────────────────────────
export const subscribeToMembers = (
  teamId: string,
  callback: (members: (TeamMember & { uid: string })[]) => void
): Unsubscribe => {
  return onSnapshot(membersRef(teamId), (snap) => {
    const members = snap.docs.map((d) => ({
      uid: d.id,
      ...d.data(),
      joinedAt: (d.data().joinedAt as Timestamp)?.toDate(),
    })) as (TeamMember & { uid: string })[];
    callback(members);
  });
};

export const getCurrentUserRole = async (
  teamId: string,
  uid: string
): Promise<UserRole | null> => {
  const snap = await getDoc(doc(membersRef(teamId), uid));
  if (!snap.exists()) return null;
  return snap.data().role as UserRole;
};

export const addMember = async (
  teamId: string,
  uid: string,
  data: Omit<TeamMember, "joinedAt">
) => {
  const { updateDoc: ud } = await import("firebase/firestore");
  const ref = doc(membersRef(teamId), uid);
  // Use set to create with specific ID
  const { setDoc } = await import("firebase/firestore");
  return setDoc(ref, {
    ...data,
    joinedAt: serverTimestamp(),
  });
};

export const updateMemberRole = async (
  teamId: string,
  uid: string,
  role: UserRole
) => {
  return updateDoc(doc(membersRef(teamId), uid), { role });
};

export const removeMember = async (teamId: string, uid: string) => {
  return deleteDoc(doc(membersRef(teamId), uid));
};

// ─── Invites ──────────────────────────────────────────────────────
const invitesRef = (teamId: string) => collection(db, "teams", teamId, "invites");

export interface Invite {
  id: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  createdAt: Date;
}

export const subscribeToInvites = (
  teamId: string,
  callback: (invites: Invite[]) => void
): Unsubscribe => {
  return onSnapshot(invitesRef(teamId), (snap) => {
    const invites = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as Timestamp)?.toDate(),
    })) as Invite[];
    callback(invites);
  });
};

export const createInvite = async (
  teamId: string,
  email: string,
  role: UserRole,
  invitedBy: string
) => {
  return addDoc(invitesRef(teamId), {
    email: email.toLowerCase().trim(),
    role,
    invitedBy,
    createdAt: serverTimestamp(),
  });
};

export const deleteInvite = async (teamId: string, inviteId: string) => {
  return deleteDoc(doc(invitesRef(teamId), inviteId));
};

export const claimInvite = async (
  teamId: string,
  invite: Invite,
  uid: string,
  displayName: string
) => {
  // Create the member document
  const { setDoc: sd } = await import("firebase/firestore");
  await sd(doc(membersRef(teamId), uid), {
    email: invite.email,
    displayName,
    role: invite.role,
    joinedAt: serverTimestamp(),
    invitedBy: invite.invitedBy,
  });
  // Delete the invite
  await deleteDoc(doc(invitesRef(teamId), invite.id));
};

export const findInviteByEmail = async (
  teamId: string,
  email: string
): Promise<Invite | null> => {
  const q = query(invitesRef(teamId), where("email", "==", email.toLowerCase().trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data(), createdAt: (d.data().createdAt as Timestamp)?.toDate() } as Invite;
};
