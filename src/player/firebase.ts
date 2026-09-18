/**
 * Firebase App & Auth Integration for Audenic Music.
 * Handles Authentication (Google / Email), Firestore Data Sync, and Admin Role Verification.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
export { onAuthStateChanged };
import { isNative } from "./nativeBridge";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyADM5EGtMmYdBJWHFXW2PXw10ZVfeecDdI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "audenic-music.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "audenic-music",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "audenic-music.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "484959363323",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:484959363323:web:1b739c4f253c9696c8105e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-NXC3ETHNKH",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const OWNER_ADMIN_EMAIL = "audenic.audio@gmail.com";

/** All emails that have full admin access to Admin Studio */
export const ADMIN_EMAILS = new Set([
  "audenic.audio@gmail.com",
  "mwijaydavie@gmail.com",
]);

export type UserRole = "admin" | "listener";

export type UserRecord = {
  uid: string;
  email: string;
  name: string;
  avatar: string;
  role: UserRole;
  createdAt: number;
};

/** Check if email is owner or designated admin */
export function checkIsAdmin(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return ADMIN_EMAILS.has(clean) || clean.endsWith("@audenic.fm");
}

/** Sync user profile to Firestore */
export async function syncUserToFirestore(user: User): Promise<UserRecord> {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  const email = user.email || "";
  const isAdmin = checkIsAdmin(email);
  const role: UserRole = isAdmin ? "admin" : "listener";

  if (snap.exists()) {
    const data = snap.data() as UserRecord;
    // Update role if user becomes admin
    if (isAdmin && data.role !== "admin") {
      await setDoc(userRef, { ...data, role: "admin" }, { merge: true });
      return { ...data, role: "admin" };
    }
    return data;
  }

  const record: UserRecord = {
    uid: user.uid,
    email,
    name: user.displayName || email.split("@")[0] || "Listener",
    avatar: user.photoURL || "",
    role,
    createdAt: Date.now(),
  };

  await setDoc(userRef, record);
  return record;
}

export async function loginWithGoogle(): Promise<UserRecord | null> {
  // 1. Native Mobile Execution
  if (isNative()) {
    try {
      const result = await FirebaseAuthentication.signInWithGoogle({
        scopes: ["profile", "email"],
      });
      const idToken = result.credential?.idToken;
      if (idToken) {
        try {
          const credential = GoogleAuthProvider.credential(idToken);
          const res = await signInWithCredential(auth, credential);
          return await syncUserToFirestore(res.user);
        } catch (credErr) {
          console.warn("Credential sign-in warning:", credErr);
        }
      }
      if (result.user) {
        const u = result.user;
        const record: UserRecord = {
          uid: u.uid || "google-" + Date.now(),
          name: u.displayName || u.email || "Google User",
          email: u.email || "",
          avatar: u.photoUrl || "",
          role: checkIsAdmin(u.email) ? "admin" : "listener",
          createdAt: Date.now(),
        };
        try { await setDoc(doc(db, "users", record.uid), record); } catch {}
        return record;
      }
    } catch (nativeErr: any) {
      console.warn("Native Google Sign-In Note:", nativeErr);
      try {
        const result = await signInWithPopup(auth, googleProvider);
        return await syncUserToFirestore(result.user);
      } catch (popupErr: any) {
        console.error("Popup login error:", popupErr);
        return null;
      }
    }
  }

  // 2. Web Browser Execution ONLY (For desktop/mobile browser testing)
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return await syncUserToFirestore(result.user);
  } catch (err: any) {
    console.error("Web Google Login Error:", err);
    return null;
  }
}

/** Email & Password Login */
export async function loginWithEmail(email: string, pass: string): Promise<UserRecord | null> {
  try {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    return await syncUserToFirestore(res.user);
  } catch (err) {
    console.error("Email Login Error:", err);
    throw err;
  }
}

/** Email & Password Signup */
export async function signupWithEmail(email: string, pass: string): Promise<UserRecord | null> {
  try {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    return await syncUserToFirestore(res.user);
  } catch (err) {
    console.error("Email Signup Error:", err);
    throw err;
  }
}

/** Sign out */
export async function logoutFirebase(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.error("Firebase SignOut error:", err);
  }
}

/** Fetch published songs from Firestore */
export async function fetchPublishedSongs() {
  try {
    const colRef = collection(db, "songs");
    const snap = await getDocs(colRef);
    const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return list.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) {
    console.warn("Firestore fetch songs warning:", err);
    return [];
  }
}

/** Save published song to Firestore */
export async function saveSongToFirestore(song: {
  id: string;
  title: string;
  artist: string;
  cover: string;
  src: string;
  tags?: string[];
}) {
  try {
    await setDoc(doc(db, "songs", song.id), {
      ...song,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error("Firestore save song error:", err);
  }
}
