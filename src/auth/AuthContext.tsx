import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  auth,
  db,
  loginWithEmail,
  signupWithEmail,
  loginWithGoogle,
  logoutFirebase,
  onAuthStateChanged,
  syncUserToFirestore,
  checkIsAdmin,
  UserRole,
  UserRecord,
} from "../player/firebase";

interface AuthContextType {
  user: User | null;
  userRecord: UserRecord | null;
  role: UserRole | null;
  loading: boolean;
  isAdmin: boolean;
  login: (e: string, p: string) => Promise<UserRecord | null>;
  signup: (e: string, p: string) => Promise<UserRecord | null>;
  loginGoogle: () => Promise<UserRecord | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const rec = await syncUserToFirestore(firebaseUser);
          setUserRecord(rec);
          setRole(rec.role);
        } catch {
          const fallbackRole: UserRole = checkIsAdmin(firebaseUser.email) ? "admin" : "listener";
          setRole(fallbackRole);
        }
      } else {
        setUserRecord(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const login = async (e: string, p: string) => {
    const rec = await loginWithEmail(e, p);
    if (rec) {
      setUserRecord(rec);
      setRole(rec.role);
    }
    return rec;
  };

  const signup = async (e: string, p: string) => {
    const rec = await signupWithEmail(e, p);
    if (rec) {
      setUserRecord(rec);
      setRole(rec.role);
    }
    return rec;
  };

  const loginGoogle = async () => {
    const rec = await loginWithGoogle();
    if (rec) {
      setUserRecord(rec);
      setRole(rec.role);
    }
    return rec;
  };

  const logout = async () => {
    await logoutFirebase();
    setUserRecord(null);
    setRole(null);
  };

  const isAdmin = role === "admin" || checkIsAdmin(user?.email);

  return (
    <AuthContext.Provider
      value={{
        user,
        userRecord,
        role,
        loading,
        isAdmin,
        login,
        signup,
        loginGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
