import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth } from "../config/firebase";
import { getCurrentUserRole, findInviteByEmail, claimInvite } from "../services/firestore";
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
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null, role: null, teamId: null, loading: true,
  canEdit: false, isAdmin: false,
  signIn: async () => {}, signUp: async () => {}, signOut: async () => {},
  authError: null,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps { children: React.ReactNode; }

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
          // Check if user is already a member
          let userRole = await getCurrentUserRole(TEAM_ID, firebaseUser.uid);

          // If not a member, check for a pending invite and auto-claim
          if (!userRole && firebaseUser.email) {
            const invite = await findInviteByEmail(TEAM_ID, firebaseUser.email);
            if (invite) {
              await claimInvite(TEAM_ID, invite, firebaseUser.uid, firebaseUser.email.split("@")[0]);
              userRole = invite.role;
            }
          }

          setRole(userRole);
        } catch (err) {
          console.error("Failed to fetch role:", err);
          setRole(null);
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
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") setAuthError("Invalid email or password");
      else if (code === "auth/user-not-found") setAuthError("No account found. Try signing up instead.");
      else if (code === "auth/too-many-requests") setAuthError("Too many attempts. Try again later.");
      else setAuthError(err?.message || "Sign in failed");
      throw err;
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    setAuthError(null);
    try {
      // Create the Firebase Auth account first so we're authenticated for Firestore reads
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      
      // Now check for invite (we're signed in so Firestore allows the read)
      const invite = await findInviteByEmail(TEAM_ID, email);
      if (!invite) {
        // No invite found — delete the auth account we just created
        await cred.user.delete();
        setAuthError("No invite found for this email. Ask your team admin for an invite.");
        return;
      }
      
      // Claim the invite (creates the member doc and deletes the invite)
      await claimInvite(TEAM_ID, invite, cred.user.uid, displayName);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") setAuthError("An account with this email already exists. Try signing in.");
      else if (code === "auth/weak-password") setAuthError("Password must be at least 6 characters.");
      else if (!authError) setAuthError(err?.message || "Sign up failed");
      throw err;
    }
  };

  const signOut = async () => { await firebaseSignOut(auth); };

  const value: AuthContextType = {
    user, role, teamId, loading,
    canEdit: role === "admin" || role === "editor",
    isAdmin: role === "admin",
    signIn, signUp, signOut, authError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
