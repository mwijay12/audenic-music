import { useEffect, useState } from "react";
import { usePlayer } from "../player/PlayerContext";
import { requestNotificationAccess, requestStorageProbe } from "../player/nativeBridge";
import { Check } from "../components/Icons";

const SLIDES = [
  {
    video: "https://videos.pexels.com/video-files/16029662/16029662-hd_1080_1920_30fps.mp4",
    poster: "https://images.pexels.com/videos/16029662/3d-color-digital-fractal-16029662.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630",
    mascot: "🎧",
    title: "All your music,\none beautiful app",
    body: "Stream your local library and discover curated playlists in a single elegant player.",
  },
  {
    video: "https://videos.pexels.com/video-files/16456769/16456769-hd_1080_1920_30fps.mp4",
    poster: "https://images.pexels.com/videos/16456769/3d-color-digital-fractal-16456769.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630",
    mascot: "📡",
    title: "10,000+ live\nradio stations",
    body: "Tune into stations from every corner of the world, from lo-fi to talk radio.",
  },
  {
    video: "https://videos.pexels.com/video-files/16456784/16456784-hd_1080_1920_30fps.mp4",
    poster: "https://images.pexels.com/videos/16456784/3d-color-digital-fractal-16456784.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630",
    mascot: "🌐",
    title: "Lyrics that\nspeak your language",
    body: "Live AI translation powered by Gemini turns any lyric into your language, instantly.",
  },
];

function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fade-in relative flex h-full flex-col items-center justify-center bg-[#0A0A0D]">
      <img src={SLIDES[0].poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      <video autoPlay loop muted playsInline poster={SLIDES[0].poster} className="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-screen" src={SLIDES[0].video} />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative flex flex-col items-center">
        <div className="grid h-24 w-24 place-items-center rounded-[30px] bg-[var(--accent)] text-5xl shadow-[0_20px_60px_-10px_color-mix(in_srgb,var(--accent)_60%,transparent)]">🎵</div>
        <h1 className="pt-6 text-3xl font-extrabold tracking-tight text-white drop-shadow-lg">Audenic</h1>
        <p className="pt-1 text-[12px] font-medium text-white/60 drop-shadow-md">Local library • Live radio • AI lyrics</p>
      </div>
      <div className="absolute bottom-16 h-1 w-32 overflow-hidden rounded-full bg-white/20">
        <div className="h-full w-1/2 animate-[loadbar_1.5s_ease-in-out_infinite] rounded-full bg-[var(--accent)]" />
      </div>
    </div>
  );
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <div className="fade-in relative flex h-full flex-col bg-black">
      {SLIDES.map((slide, idx) => (
        <div key={idx} className={`absolute inset-0 transition-opacity duration-700 ${idx === i ? "opacity-100" : "opacity-0"}`}>
          <img src={slide.poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
          <video autoPlay loop muted playsInline preload="auto" poster={slide.poster} className="absolute inset-0 h-full w-full object-cover opacity-60" src={slide.video} />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25" />

      <div className="relative flex justify-end p-5">
        <button onClick={onDone} className="rounded-full bg-black/40 px-4 py-1.5 text-[12px] font-semibold text-white/85 backdrop-blur">Skip</button>
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-end px-9 pb-8 text-center">
        {/* floating mascot badge */}
        <div key={s.mascot} className="pop-in mb-6 grid h-24 w-24 place-items-center rounded-[32px] border border-white/15 bg-white/10 text-[46px] shadow-[0_18px_50px_-12px_rgba(0,0,0,.8)] backdrop-blur-xl">
          {s.mascot}
        </div>
        <h2 className="whitespace-pre-line text-[28px] font-extrabold leading-[1.15] text-white drop-shadow-md">{s.title}</h2>
        <p className="pt-4 text-[14px] font-medium leading-relaxed text-white/75 drop-shadow-sm">{s.body}</p>
      </div>
      <div className="relative flex items-center justify-center gap-2 pb-6">
        {SLIDES.map((_, ix) => <span key={ix} className={`h-1.5 rounded-full transition-all duration-300 ${ix === i ? "w-8 bg-[var(--accent)]" : "w-2 bg-white/30"}`} />)}
      </div>
      <div className="relative px-8 pb-10">
        <button onClick={() => (last ? onDone() : setI(i + 1))} className="w-full rounded-full bg-[var(--accent)] py-4 text-[15px] font-bold text-black shadow-[0_8px_20px_-6px_color-mix(in_srgb,var(--accent)_60%,transparent)] transition active:scale-95">{last ? "Get started" : "Next"}</button>
      </div>
    </div>
  );
}

function PermissionPrompt({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"storage" | "notifications">("storage");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<"pending" | "granted" | "denied">("pending");

  const proceed = () => {
    setOutcome("pending");
    setBusy(false);
    if (step === "storage") setStep("notifications");
    else onDone();
  };

  const grant = async () => {
    if (busy) return;
    setBusy(true);
    setOutcome("pending");
    try {
      if (step === "storage") {
        if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
          const { pickFolder, scanDirectory } = await import("../player/tauriBridge");
          const folder = await pickFolder();
          if (folder) {
            setOutcome("granted");
            scanDirectory(folder).catch(console.warn);
          } else {
            setOutcome("denied");
          }
        } else {
          const ok = await requestStorageProbe();
          setOutcome(ok ? "granted" : "denied");
        }
      } else {
        const result = await requestNotificationAccess();
        setOutcome(result ? "granted" : "denied");
      }
    } catch {
      setOutcome("denied");
    }
    window.setTimeout(proceed, 750);
  };

  const skip = () => { proceed(); };
  const isDesktopApp = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  return (
    <div className="fade-in relative flex h-full flex-col items-center justify-between bg-[#0a0a0d] px-8 py-12">
      <div className="flex flex-col items-center text-center">
        <div className="mt-8 text-5xl">{step === "storage" ? "📂" : "🔔"}</div>
        <h2 className="pt-6 text-[22px] font-bold text-white">
          {step === "storage" ? (isDesktopApp ? "Select Music Folder" : "Access Storage & Media") : "Push Notifications"}
        </h2>
        <p className="pt-3 max-w-[280px] text-[13px] leading-relaxed text-white/50">
          {step === "storage"
            ? (isDesktopApp
                ? "Choose your music folder on Windows to import your songs, embedded cover art and lyrics into Audenic Studio."
                : "Audenic needs scan access to pull embedded cover art, lyrics and your existing library from device storage.")
            : "Lock screen controls, song alerts and achievement toasts need your notification permission to appear."}
        </p>
      </div>

      {/* Real system-style dialog, functional Allow/Deny */}
      <div className="w-full rounded-2xl bg-white/[0.05] border border-white/10 p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="text-[22px]">{step === "storage" ? "📁" : "💬"}</span>
          <div className="flex-1">
            <p className="text-[13px] font-bold leading-snug text-white">
              {step === "storage"
                ? (isDesktopApp
                    ? "Select your Music folder to import your audio library into Audenic Studio?"
                    : "Allow Audenic to access music, photos and audio files on this device?")
                : "Allow Audenic to show notifications?"}
            </p>
            {outcome !== "pending" && (
              <p className={`pt-1.5 text-[11px] font-semibold ${outcome === "granted" ? "text-emerald-300" : "text-amber-300"}`}>
                {outcome === "granted"
                  ? "✔ Granted — " + (step === "storage" ? "library will rescan automatically" : "lock screen controls enabled")
                  : "You can select folders anytime in My Library → Scan."}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-5">
              <button onClick={skip} className="text-[12px] font-bold text-white/40 active:scale-95">Skip for now</button>
              <button onClick={grant} disabled={busy} className="text-[12px] font-bold text-[var(--accent)] active:scale-95 disabled:opacity-50">
                {busy ? "Opening..." : (isDesktopApp && step === "storage" ? "Select Folder" : "Allow")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <button onClick={proceed} disabled={busy} className="w-full rounded-full bg-[var(--accent)] py-3.5 text-[14px] font-bold text-black transition active:scale-95 disabled:opacity-50">
        Continue
      </button>
    </div>
  );
}

function AuthScreen({ onDone }: { onDone: () => void }) {
  const { login } = usePlayer();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const submit = () => {
    setBusy(true);
    setAuthError("");
    const userEmail = email.trim() || "you@audenic.fm";
    const userName = name.trim() || userEmail.split("@")[0];
    window.setTimeout(() => {
      login({ name: userName, email: userEmail });
      onDone();
    }, 500);
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setAuthError("");
    try {
      const { loginWithGoogle, auth } = await import("../player/firebase");
      const user = await loginWithGoogle();
      if (user) {
        login({ name: user.name, email: user.email, avatar: user.avatar });
        onDone();
        return;
      }
      if (auth?.currentUser) {
        login({
          name: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "Google User",
          email: auth.currentUser.email || "",
          avatar: auth.currentUser.photoURL || "",
        });
        onDone();
        return;
      }
      setAuthError("Google Sign-In failed or was cancelled.");
    } catch (err: unknown) {
      console.warn("Google Sign-In error:", err);
      setAuthError((err as Error)?.message || "Google Sign-In error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-in flex h-full flex-col bg-[#0A0A0D] px-7 pt-12 overflow-y-auto">
      <h1 className="text-[26px] font-bold text-white">{mode === "login" ? "Welcome back" : "Create account"}</h1>
      <p className="pt-1.5 text-[12.5px] text-white/45">{mode === "login" ? "Sign in to sync your library, playlists & admin controls." : "Set up your Audenic profile in seconds."}</p>

      {authError && (
        <p className="mt-2 text-[11.5px] font-semibold text-rose-400">{authError}</p>
      )}

      <div className="mt-4 flex rounded-full bg-white/[0.06] p-1">
        {(["login", "signup"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`flex-1 rounded-full py-2 text-[12.5px] font-semibold transition ${mode === m ? "bg-[var(--accent)] text-black" : "text-white/50"}`}>{m === "login" ? "Log in" : "Sign up"}</button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {mode === "signup" && <Field label="Name" value={name} onChange={setName} placeholder="Mwijay Davie" />}
        <Field label="Email (Admin: audenic.audio@gmail.com)" value={email} onChange={setEmail} placeholder="audenic.audio@gmail.com" type="email" />
        <Field label="Password" value={pass} onChange={setPass} placeholder="••••••••" type="password" />
      </div>

      {mode === "login" && <button className="mt-2 self-end text-[11.5px] font-medium text-white/45">Forgot password?</button>}

      <button onClick={submit} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] py-3.5 text-[14px] font-bold text-black transition active:scale-95 disabled:opacity-60">
        {busy ? "Please wait…" : <><Check size={15} /> {mode === "login" ? "Log in" : "Create account"}</>}
      </button>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[10.5px] text-white/35">or</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        onClick={handleGoogleSignIn}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-full border border-white/20 bg-white/[0.06] py-3 text-[13px] font-semibold text-white transition hover:bg-white/10 active:scale-95 disabled:opacity-50"
      >
        <span className="text-base">🌐</span> Continue with Google
      </button>

      <button onClick={() => { login({ name: "Guest", email: "" }); onDone(); }} className="mt-3 w-full rounded-full border border-white/10 py-2.5 text-[12.5px] font-semibold text-white/70 transition active:scale-95">Continue as guest</button>
      <p className="mt-6 pb-8 text-center text-[10.5px] text-white/30">By continuing you agree to Audenic's Terms & Privacy Policy</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-white/45">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[13.5px] text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]" />
    </label>
  );
}

const SEEN_KEY = "aurora.onboarded";

export default function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const seen = typeof localStorage !== "undefined" && localStorage.getItem(SEEN_KEY) === "1";
  const [stage, setStage] = useState<"splash" | "onboarding" | "permissions" | "auth">(seen ? "auth" : "splash");

  const finishOnboarding = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* */ }
    setStage("permissions");
  };

  if (stage === "splash") return <Splash onDone={() => setStage("onboarding")} />;
  if (stage === "onboarding") return <Onboarding onDone={finishOnboarding} />;
  if (stage === "permissions") return <PermissionPrompt onDone={() => setStage("auth")} />;
  return <AuthScreen onDone={onComplete} />;
}
