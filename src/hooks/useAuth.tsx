import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth } from "../config/firebase";
import { getCurrentUserRole } from "../services/firestore";
import type { UserRole } from "../types";

// Your team ID from the seed script
const TEAM_ID = "racks-and-sacks";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  teamId: string | null;
  loading: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  teamId: null,
  loading: true,
  canEdit: false,
  isAdmin: false,
  signIn: async () => {},
  signOut: async () => {},
  authError: null,
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
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        setTeamId(TEAM_ID);
        try {
          const userRole = await getCurrentUserRole(TEAM_ID, firebaseUser.uid);
          setRole(userRole);
        } catch (err) {
          console.error("Failed to fetch role:", err);
          setRole("viewer"); // Fallback to viewer if role lookup fails
        }
      } else {
        setRole(null);
        setTeamId(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setAuthError("Invalid email or password");
      } else if (code === "auth/user-not-found") {
        setAuthError("No account found with this email");
      } else if (code === "auth/too-many-requests") {
        setAuthError("Too many attempts. Try again later.");
      } else {
        setAuthError(err?.message || "Sign in failed");
      }
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const value: AuthContextType = {
    user,
    role,
    teamId,
    loading,
    canEdit: role === "admin" || role === "editor",
    isAdmin: role === "admin",
    signIn,
    signOut,
    authError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
