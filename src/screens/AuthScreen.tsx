import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { auth } from "../player/firebase";
import { Back } from "../components/Icons";

export default function AuthScreen({
  onClose,
  onSuccess,
}: {
  onClose?: () => void;
  onSuccess?: () => void;
}) {
  const { login, signup, loginGoogle, user, logout } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
      setLoading(false);
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err: any) {
      setLoading(false);
      const msg = err?.message || String(err);
      if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setError("Invalid email or password.");
      } else if (msg.includes("email-already-in-use")) {
        setError("An account with this email already exists.");
      } else if (msg.includes("weak-password")) {
        setError("Password should be at least 6 characters.");
      } else {
        setError("Authentication failed. Please try again.");
      }
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const rec = await loginGoogle();
      setLoading(false);
      if (rec || auth.currentUser) {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      } else {
        setError("Google sign in was not completed.");
      }
    } catch {
      setLoading(false);
      if (auth.currentUser) {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      } else {
        setError("Google sign in was cancelled or failed.");
      }
    }
  };

  return (
    <div className="fade-in relative flex h-full flex-col justify-between bg-[#0A0A0D] p-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between pt-8">
        {onClose && (
          <button
            onClick={onClose}
            className="press flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
          >
            <Back size={20} />
          </button>
        )}
        <h1 className="text-base font-bold">Audenic Account</h1>
        <div className="w-10" />
      </div>

      {user ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-purple-600/20 text-3xl font-bold text-purple-400">
            {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold">{user.displayName || "Audenic Listener"}</h2>
            <p className="text-xs text-white/50">{user.email}</p>
          </div>
          <button
            onClick={() => logout()}
            className="press mt-4 rounded-2xl bg-rose-500/20 px-6 py-3 text-xs font-bold text-rose-300"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="my-auto flex flex-col gap-6 max-w-sm mx-auto w-full">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold tracking-tight">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Sign in to sync your playlists & favorite radio stations across devices
            </p>
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 text-center text-xs text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-xs text-white outline-none focus:border-purple-500"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-xs text-white outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="press mt-1 rounded-2xl bg-purple-600 py-3.5 text-xs font-bold text-white shadow-lg disabled:opacity-50"
            >
              {loading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
            </button>
          </form>

          <div className="relative my-1 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <span className="relative bg-[#0A0A0D] px-3 text-[10px] font-semibold text-white/40 uppercase">
              Or continue with
            </span>
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="press flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-xs font-semibold text-white hover:bg-white/10"
          >
            <span>🌐</span>
            <span>Google Sign-In</span>
          </button>

          <div className="text-center pt-2">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-xs text-purple-400 hover:underline"
            >
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      )}

      {/* Guest Mode Footer */}
      <div className="pb-4 text-center">
        <button
          onClick={onClose}
          className="text-xs text-white/40 hover:text-white/70 underline"
        >
          Continue as Guest (Offline Mode)
        </button>
      </div>
    </div>
  );
}
