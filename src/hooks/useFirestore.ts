import { useEffect, useState } from "react";
import {
  subscribeToSeasons,
  subscribeToGames,
  subscribeToPlayers,
  subscribeToMembers,
} from "../services/firestore";
import type { Season, Game, Player, TeamMember } from "../types";

// ─── Generic Firestore Subscription Hook ──────────────────────────
function useFirestoreSubscription<T>(
  teamId: string | null,
  subscribeFn: (teamId: string, cb: (data: T[]) => void) => () => void
): { data: T[]; loading: boolean } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeFn(teamId, (items) => {
      setData(items);
      setLoading(false);
    });

    return unsubscribe;
  }, [teamId]);

  return { data, loading };
}

// ─── Typed Hooks ──────────────────────────────────────────────────
export const useSeasons = (teamId: string | null) =>
  useFirestoreSubscription<Season>(teamId, subscribeToSeasons);

export const useGames = (teamId: string | null) =>
  useFirestoreSubscription<Game>(teamId, subscribeToGames);

export const usePlayers = (teamId: string | null) =>
  useFirestoreSubscription<Player>(teamId, subscribeToPlayers);

export const useMembers = (teamId: string | null) =>
  useFirestoreSubscription<TeamMember & { uid: string }>(
    teamId,
    subscribeToMembers
  );
