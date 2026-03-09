import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../config/firebase";
import { getCurrentUserRole } from "../services/firestore";
import type { UserRole } from "../types";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  teamId: string | null;
  loading: boolean;
  canEdit: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  teamId: null,
  loading: true,
  canEdit: false,
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // In a real app, you'd look up the user's team from a
        // user-level collection or claims. For now, we assume a
        // single team whose ID is stored or hardcoded during onboarding.
        // TODO: Replace with actual team lookup
        const currentTeamId = "default-team";
        setTeamId(currentTeamId);

        const userRole = await getCurrentUserRole(
          currentTeamId,
          firebaseUser.uid
        );
        setRole(userRole);
      } else {
        setRole(null);
        setTeamId(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    user,
    role,
    teamId,
    loading,
    canEdit: role === "admin" || role === "editor",
    isAdmin: role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
