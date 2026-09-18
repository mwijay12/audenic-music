import { useRef, useState } from "react";
import { usePlayer, svgAvatar, isAdminEmail } from "../player/PlayerContext";
import { IconButton, StatusBar } from "../components/Shell";
import { Back, Check, Trash } from "../components/Icons";

const PRESET_AVATARS = [
  "https://images.pexels.com/photos/3756945/pexels-photo-3756945.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=200&h=200&fit=crop",
  "https://images.pexels.com/photos/3394658/pexels-photo-3394658.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=200&h=200&fit=crop",
  "https://images.pexels.com/photos/3394657/pexels-photo-3394657.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=200&h=200&fit=crop",
  "https://images.pexels.com/photos/3756912/pexels-photo-3756912.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=200&h=200&fit=crop",
  "https://images.pexels.com/photos/31799256/pexels-photo-31799256.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=200&h=200&fit=crop",
];

export default function ProfileScreen({
  onBack,
  onLoggedOut,
  onOpenAdmin,
}: {
  onBack: () => void;
  onLoggedOut: () => void;
  onOpenAdmin?: () => void;
}) {
  const { profile, setProfile, logout, analytics, liked, localTracks } = usePlayer();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty =
    name !== profile.name || email !== profile.email || bio !== profile.bio || avatar !== profile.avatar;

  const save = () => {
    setProfile({ name: name.trim() || "Listener", email, bio, avatar });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="fade-in flex h-full flex-col">
      <StatusBar />
      <div className="flex items-center justify-between px-6 pt-2">
        <IconButton onClick={onBack} label="Back">
          <Back size={20} />
        </IconButton>
        <p className="text-[15px] font-semibold text-white">My Profile</p>
        <span className="w-10" />
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-6 pb-40 pt-4">
        <div className="flex flex-col items-center">
          <div className="relative">
            <img
              src={avatar || svgAvatar(name)}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = svgAvatar(name); }}
              className="h-24 w-24 rounded-full object-cover ring-4 ring-white/10"
              alt="avatar"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-black shadow-lg active:scale-90"
            >
              +
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setAvatar(URL.createObjectURL(f));
              }}
            />
          </div>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-2">
            {PRESET_AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                className={`h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 transition ${
                  avatar === a ? "ring-[var(--accent)]" : "ring-transparent opacity-70"
                }`}
              >
                <img src={a} className="h-full w-full object-cover" alt="" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Field label="Display name" value={name} onChange={setName} />
          <Field label="Email" value={email} onChange={setEmail} type="email" />
          <div>
            <span className="mb-1.5 block text-[11px] font-medium text-white/45">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]"
              placeholder="Tell us about your taste in music"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat n={analytics.totalListens} l="Listens" />
          <Stat n={liked.length} l="Liked" />
          <Stat n={localTracks.length} l="Local" />
        </div>

        <button
          onClick={save}
          disabled={!dirty}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] py-3.5 text-[14px] font-bold text-black transition active:scale-95 disabled:opacity-40"
        >
          {saved ? (
            <>
              <Check size={15} /> Saved
            </>
          ) : (
            "Save changes"
          )}
        </button>

        {(onOpenAdmin || isAdminEmail(email)) && (
          <button
            onClick={onOpenAdmin}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--ga)] py-3 text-[13px] font-extrabold text-black transition active:scale-95"
          >
            ⚡ Open Admin Studio
          </button>
        )}

        <button
          onClick={() => {
            logout();
            onLoggedOut();
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-rose-400/25 py-3 text-[13px] font-semibold text-rose-300 transition active:scale-95"
        >
          <Trash size={14} /> Log out
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-white/45">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[13.5px] text-white outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-3 text-center">
      <p className="text-[18px] font-bold text-[var(--accent)]">{n}</p>
      <p className="text-[10px] text-white/45">{l}</p>
    </div>
  );
}
