import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayer, fmt } from "../player/PlayerContext";
import { StatusBar, IconButton } from "../components/Shell";
import { Back, Heart, Next, Pause, Play, Sparkle, Gamepad, Target, BookOpen, BarChart } from "../components/Icons";
import { fetchLatestNews, type NewsArticle } from "../player/newsApi";
import { speakWithElevenLabs } from "../player/elevenLabs";

type View = "hub" | "moments" | "challenge" | "focus" | "journal" | "recap";
type JournalEntry = { id: string; trackId: string; title: string; artist: string; note: string; mood: string; ts: number };
type SavedMoment = { id: string; text: string; mood: string; ts: number };

const MOMENTS = {
  Focus: [
    "Small progress, repeated, becomes a life you barely recognize.",
    "Protect this hour. Your future is listening.",
    "The next useful step matters more than the perfect plan.",
    "Give the task your full attention, then let the result surprise you.",
    "Clarity follows action; do not wait for inspiration to begin.",
    "Distraction is energy stolen from your vision.",
    "Deep work is a quiet gift you give your future self.",
    "One intentional task at a time builds extraordinary momentum.",
  ],
  Confidence: [
    "You have survived every version of the day that once frightened you.",
    "Move like the answer is already becoming clear.",
    "Quiet confidence needs no announcement.",
    "Your voice belongs in the room.",
    "Trust the strength you built in moments no one witnessed.",
    "Doubt is a visitor; you are the owner of this house.",
    "You are capable of far more than your past fears suggested.",
    "Stand firm in your truth; authenticity requires no permission.",
  ],
  Calm: [
    "You are allowed to arrive slowly.",
    "Breathe out what this moment does not require.",
    "A calm mind can hear the next right thing.",
    "Rest is not a reward. It is part of the rhythm.",
    "Stillness is where clarity speaks loudest.",
    "Softness is not weakness; it is wisdom resting in power.",
    "Let go of the need to control what is unfolding naturally.",
    "Peace begins when expectation stops demanding perfection.",
  ],
  Faith: [
    "Keep walking. Not every answer arrives before the next step.",
    "Grace meets you in the unfinished places.",
    "What is planted in patience can still bloom in power.",
    "Hope is a practice, not just a feeling.",
    "Light always finds a way through the smallest opening.",
    "The seeds you plant in dark soil are growing upward.",
    "Believing before seeing is the birth of transformation.",
    "You are held by a purpose bigger than today’s temporary shadow.",
  ],
  Discipline: [
    "Do it gently. Do it consistently. Let time do the multiplying.",
    "Motivation visits. Discipline builds a home.",
    "Your habits are voting for the person you are becoming.",
    "Begin before your confidence catches up.",
    "Mastery is simply devotion practiced in quiet routines.",
    "Small daily choices compound into unshakeable mastery.",
    "Refuse to let temporary feelings cancel permanent goals.",
    "Commitment means showing up when the novelty wears off.",
  ],
  Gratitude: [
    "Notice one ordinary thing that is quietly holding your life together.",
    "Today does not need to be perfect to be worth remembering.",
    "Gratitude turns enough into something visible.",
    "There is still something good here. Name it.",
    "A thankful heart sees abundance in the quietest moments.",
    "Every breath is a subtle invitation to start anew.",
    "Celebrate how far you’ve come, not just how far remains.",
    "Joy lives in the appreciation of present presence.",
  ],
  Resilience: [
    "Bending is how the oak tree survives the winter storm.",
    "Every setback is a hidden setup for a stronger return.",
    "Your endurance is forged in moments you refused to quit.",
    "Soft rain still hollows hard stone through steady persistence.",
    "Fall seven times, stand up eight.",
    "Storms clean the air so you can see the sky again.",
  ],
  Peace: [
    "Serenity is keeping your inner water still while waves pass.",
    "Nothing external can disturb a heart anchored in contentment.",
    "Protect your peace like your life depends on it.",
    "Silence is the room where healing whispers.",
  ],
} as const;

const MOOD_QUEUE = [
  { name: "Focus", emoji: "🎯", tags: ["focus", "ambient", "chill"], color: "#7FB8FF" },
  { name: "Energy", emoji: "🔥", tags: ["trending", "dance", "electronic"], color: "#FF7A5C" },
  { name: "Calm", emoji: "🌙", tags: ["chill", "lofi", "ambient"], color: "#5EE7CF" },
  { name: "Happy", emoji: "☀️", tags: ["new", "pop", "happy"], color: "#FFD24C" },
];

const load = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
};

export default function ExperiencesScreen({ onBack, onOpenPlayer }: { onBack: () => void; onOpenPlayer: () => void }) {
  const { tracks, localTracks, current, isPlaying, playTrack, toggle, next, progress, analytics, liked, playlists, recentlyPlayed, toggleLike, setSleepTimer, buzz } = usePlayer();
  const [view, setView] = useState<View>("hub");
  const [momentMood, setMomentMood] = useState<keyof typeof MOMENTS>("Focus");
  const [momentIx, setMomentIx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [savedMoments, setSavedMoments] = useState<SavedMoment[]>(load("au.savedMoments", []));
  const [journal, setJournal] = useState<JournalEntry[]>(load("au.journal", []));

  useEffect(() => { localStorage.setItem("au.savedMoments", JSON.stringify(savedMoments)); }, [savedMoments]);
  useEffect(() => { localStorage.setItem("au.journal", JSON.stringify(journal)); }, [journal]);

  const go = (v: View) => { setView(v); buzz(10); };
  const title = view === "hub" ? "Audenic Experiences" : ({ moments: "Audenic Moments", challenge: "Guess the Song", focus: "Focus & Mood", journal: "Listening Journal", recap: "Weekly Recap" } as Record<string, string>)[view];

  return (
    <div className="fade-in flex h-full flex-col">
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-1">
        <IconButton onClick={() => view === "hub" ? onBack() : go("hub")} label="Back"><Back size={20} /></IconButton>
        <p className="clamp-1 px-2 text-[14px] font-semibold text-white">{title}</p>
        <span className="w-10" />
      </div>

      {view === "hub" && <Hub onGo={go} />}
      {view === "moments" && (
        <Moments
          current={current}
          playing={isPlaying}
          toggle={toggle}
          mood={momentMood}
          setMood={setMomentMood}
          index={momentIx}
          setIndex={setMomentIx}
          flipped={flipped}
          setFlipped={setFlipped}
          saved={savedMoments}
          onSave={(text) => setSavedMoments((p) => [{ id: `m-${Date.now()}`, text, mood: momentMood, ts: Date.now() }, ...p])}
          onLike={() => current && toggleLike(current.id)}
          liked={current ? liked.includes(current.id) : false}
        />
      )}
      {view === "challenge" && <Challenge tracks={localTracks.length >= 4 ? localTracks : tracks} playTrack={playTrack} toggle={toggle} currentId={current?.id ?? null} currentProgress={progress} />}
      {view === "focus" && <Focus tracks={tracks} playTrack={playTrack} toggle={toggle} next={next} isPlaying={isPlaying} setSleepTimer={setSleepTimer} onOpenPlayer={onOpenPlayer} />}
      {view === "journal" && <Journal current={current} entries={journal} onAdd={(e) => setJournal((p) => [e, ...p])} onDelete={(id) => setJournal((p) => p.filter((x) => x.id !== id))} />}
      {view === "recap" && <Recap analytics={analytics} tracks={tracks} likedCount={liked.length} playlistCount={playlists.length} recentlyPlayed={recentlyPlayed} />}
    </div>
  );
}

function Hub({ onGo }: { onGo: (v: View) => void }) {
  const items: { id: View; icon: React.ReactNode; title: string; sub: string; gradient: string }[] = [
    { id: "moments", icon: <Sparkle size={26} className="text-[#B17BFF]" />, title: "Audenic Moments", sub: "Flip the cover for a message made for this moment", gradient: "from-[#B17BFF]/30 to-[#FF5DCF]/15" },
    { id: "challenge", icon: <Gamepad size={26} className="text-[#FFD24C]" />, title: "Guess the Song", sub: "Solo or pass-and-play music challenge", gradient: "from-[#FFD24C]/30 to-[#FF7A5C]/15" },
    { id: "focus", icon: <Target size={26} className="text-[#5EE7CF]" />, title: "Focus & Mood", sub: "Timed sessions with a queue that matches your energy", gradient: "from-[#5EE7CF]/25 to-[#3B6BFF]/15" },
    { id: "journal", icon: <BookOpen size={26} className="text-[#FF7A5C]" />, title: "Listening Journal", sub: "Save the songs and feelings that mattered", gradient: "from-[#FF7A5C]/25 to-[#FF5DCF]/15" },
    { id: "recap", icon: <BarChart size={26} className="text-[#C8F249]" />, title: "Weekly Recap", sub: "Your listening week, clearly told", gradient: "from-[#C8F249]/25 to-[#5EE7CF]/15" },
  ];
  return (
    <div className="no-scrollbar smooth-scroll stagger flex-1 overflow-y-auto px-5 pb-32 pt-5">
      <div className="pb-5">
        <p className="text-[23px] font-extrabold leading-tight text-white">More than a player.</p>
        <p className="pt-1 text-[12.5px] leading-relaxed text-white/45">Reflect, focus, compete and remember — all through the music already in your library.</p>
      </div>
      <div className="space-y-3">
        {items.map((x) => (
          <button key={x.id} onClick={() => onGo(x.id)} className={`press flex w-full items-center gap-4 overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br ${x.gradient} p-4 text-left`}>
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-black/35 backdrop-blur">{x.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-white">{x.title}</span>
              <span className="clamp-2 block pt-0.5 text-[11.5px] leading-snug text-white/50">{x.sub}</span>
            </span>
            <span className="text-[16px] text-white/35">›</span>
          </button>
        ))}
      </div>

      <NewsSection />
    </div>
  );
}

function NewsSection() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingId, setReadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchLatestNews("music").then((data) => {
      setArticles(data);
      setLoading(false);
    });
  }, []);

  const handleReadAloud = async (art: NewsArticle) => {
    setReadingId(art.id);
    await speakWithElevenLabs(`${art.title}. ${art.description}`);
    setReadingId(null);
  };

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between pb-3">
        <div>
          <p className="text-[15px] font-extrabold text-white">⚡ Music &amp; Culture News</p>
          <p className="text-[10.5px] text-white/40">Multi-Key News Pools &amp; ElevenLabs Voice Reader</p>
        </div>
        <span className="rounded-full bg-[var(--accent)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">Live</span>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : (
        <div className="space-y-2.5">
          {articles.slice(0, 5).map((a) => (
            <div key={a.id} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.04] p-3 transition hover:bg-white/[0.07]">
              {a.imageUrl && <img src={a.imageUrl} className="h-16 w-16 shrink-0 rounded-xl bg-black/40 object-cover" alt="" onError={e => ((e.target as HTMLElement).style.display = "none")} />}
              <div className="min-w-0 flex-1">
                <a href={a.url} target="_blank" rel="noreferrer" className="clamp-2 block text-[12.5px] font-bold text-white transition hover:text-[var(--accent)]">
                  {a.title}
                </a>
                <p className="clamp-1 pt-0.5 text-[10.5px] text-white/45">{a.source} • {a.publishedAt}</p>
                <button
                  onClick={() => handleReadAloud(a)}
                  disabled={readingId === a.id}
                  className="mt-1.5 flex items-center gap-1.5 rounded-full bg-[var(--accent)]/15 px-2.5 py-1 text-[10px] font-bold text-[var(--accent)] transition hover:bg-[var(--accent)]/25"
                >
                  {readingId === a.id ? "Reading..." : "Read Aloud"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TypewriterQuote({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 28);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="flex min-h-[110px] items-center">
      <p className="text-[22px] font-extrabold leading-tight tracking-tight text-white sm:text-[25px]">
        “{displayed}”
        {displayed.length < text.length && (
          <span className="ml-1 inline-block h-5 w-1.5 align-middle bg-[var(--accent)] animate-pulse" />
        )}
      </p>
    </div>
  );
}

function Moments({ current, playing, toggle, mood, setMood, index, setIndex, flipped, setFlipped, onSave, onLike, liked }: {
  current: ReturnType<typeof usePlayer>["current"]; playing: boolean; toggle: () => void;
  mood: keyof typeof MOMENTS; setMood: (m: keyof typeof MOMENTS) => void;
  index: number; setIndex: (n: number) => void; flipped: boolean; setFlipped: (v: boolean) => void;
  saved: SavedMoment[]; onSave: (text: string) => void; onLike: () => void; liked: boolean;
}) {
  const text = MOMENTS[mood][index % MOMENTS[mood].length];
  const moods = Object.keys(MOMENTS) as (keyof typeof MOMENTS)[];
  return (
    <div className="no-scrollbar smooth-scroll flex-1 overflow-y-auto px-5 pb-24 pt-5">
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-4">
        {moods.map((m) => <button key={m} onClick={() => { setMood(m); setIndex(0); }} className={`press shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${mood === m ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/55"}`}>{m}</button>)}
      </div>

      {/* real CSS 3D flip card */}
      <button onClick={() => setFlipped(!flipped)} className="block w-full text-left [perspective:1200px]" aria-label="Flip Audenic Moment card">
        <div className={`relative h-[360px] w-full transition-transform duration-700 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
          <div className="absolute inset-0 overflow-hidden rounded-[34px] border border-white/10 bg-[#141418] shadow-[0_30px_80px_-25px_rgba(0,0,0,.9)] [backface-visibility:hidden]">
            {current ? <img src={current.cover} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-gradient-to-br from-[var(--accent)]/25 to-[var(--ga)]/20 text-[64px]">🎧</div>}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="clamp-1 text-[17px] font-bold text-white">{current?.title ?? "Play a song to begin"}</p>
              <p className="clamp-1 pt-0.5 text-[12px] text-white/55">{current?.artist ?? "Audenic Moment"}</p>
              <p className="pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--accent)]">Tap to reveal your message</p>
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col justify-between rounded-[34px] border border-[var(--accent)]/25 bg-gradient-to-br from-[#17171c] to-[#0A0A0D] p-6 shadow-[0_30px_80px_-25px_rgba(0,0,0,.9)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">{mood} moment</span>
              <span className="text-[28px]">✨</span>
            </div>
            <TypewriterQuote text={text} />
            <div>
              <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/50">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                Powered by AI • Audenic Daily Inspiration
              </p>
              <p className="pt-2 text-[10px] font-semibold uppercase tracking-wider text-white/25">Tap to return to the cover</p>
            </div>
          </div>
        </div>
      </button>

      <div className="mt-4 flex items-center justify-center gap-2.5">
        <button onClick={toggle} disabled={!current} className="press grid h-11 w-11 place-items-center rounded-full bg-[var(--accent)] text-black disabled:opacity-30">{playing ? <Pause size={17} /> : <Play size={17} />}</button>
        <button onClick={() => setIndex((index + 1) % MOMENTS[mood].length)} className="press flex items-center gap-1.5 rounded-full bg-white/[0.07] px-4 py-2.5 text-[12px] font-semibold text-white"><Next size={14} /> New message</button>
        <button onClick={() => onSave(text)} className="press flex items-center gap-1.5 rounded-full bg-white/[0.07] px-4 py-2.5 text-[12px] font-semibold text-white">Save</button>
        <button onClick={onLike} disabled={!current} className={`press grid h-11 w-11 place-items-center rounded-full bg-white/[0.07] ${liked ? "text-rose-300" : "text-white/50"}`}><Heart size={16} filled={liked} /></button>
      </div>
    </div>
  );
}

function Challenge({ tracks, playTrack, toggle, currentId, currentProgress }: {
  tracks: ReturnType<typeof usePlayer>["tracks"]; playTrack: (id: string) => void; toggle: () => void;
  currentId: string | null; currentProgress: number;
}) {
  const pool = tracks.filter((t) => !!t.src);
  const [players, setPlayers] = useState<1 | 2>(1);
  const [rounds, setRounds] = useState(5);
  const [round, setRound] = useState(0);
  const [activePlayer, setActivePlayer] = useState(0);
  const [scores, setScores] = useState([0, 0]);
  const [question, setQuestion] = useState<{ answer: typeof pool[number]; options: typeof pool } | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const previewTimer = useRef<number | null>(null);
  const previous = useRef({ id: currentId, progress: currentProgress });

  const makeQuestion = useCallback(() => {
    if (pool.length < 2) return;
    const answer = pool[Math.floor(Math.random() * pool.length)];
    const choices = [answer, ...pool.filter((t) => t.id !== answer.id).sort(() => Math.random() - 0.5).slice(0, Math.min(3, pool.length - 1))].sort(() => Math.random() - 0.5);
    setQuestion({ answer, options: choices });
    setRevealed(null);
    playTrack(answer.id);
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => toggle(), 5200);
  }, [pool, playTrack, toggle]);

  const start = () => {
    previous.current = { id: currentId, progress: currentProgress };
    setScores([0, 0]); setRound(1); setActivePlayer(0); setShowResult(false); setStarted(true); makeQuestion();
  };

  const advance = useCallback(() => {
    if (round >= rounds) {
      setShowResult(true); setQuestion(null); setRevealed(null);
      if (previous.current.id) playTrack(previous.current.id);
    } else {
      setRound((r) => r + 1);
      if (players === 2) setActivePlayer((p) => (p === 0 ? 1 : 0));
      makeQuestion();
    }
  }, [players, playTrack, rounds, round, makeQuestion]);

  const answer = (id: string) => {
    if (!question || revealed) return;
    const correct = id === question.answer.id;
    if (correct) setScores((s) => s.map((x, i) => i === activePlayer ? x + 100 : x));
    setRevealed(id);
    window.setTimeout(advance, 1400);
  };

  useEffect(() => () => { if (previewTimer.current) window.clearTimeout(previewTimer.current); }, []);

  if (showResult) {
    const winner = scores[0] === scores[1] ? -1 : scores[0] > scores[1] ? 0 : 1;
    const winnerLabel = players === 1 ? "Your score" : winner === -1 ? "It's a tie!" : "Player " + (winner + 1) + " wins";
    return (
      <div className="no-scrollbar smooth-scroll flex-1 overflow-y-auto px-5 pb-28 pt-8 text-center">
        <div className="grid h-16 w-16 place-items-center mx-auto rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34"/><path d="M18 4H6v7a6 6 0 0 0 12 0V4Z"/></svg>
        </div>
        <p className="pt-3 text-[22px] font-extrabold text-white">{winnerLabel}</p>
        <p className="pt-1 text-[12.5px] text-white/45">
          {players === 1
            ? `You got ${scores[0]} / ${rounds * 100} points.`
            : `Player 1: ${scores[0]} · Player 2: ${scores[1]}`}
        </p>
        {players === 2 && <p className="mt-3 rounded-2xl bg-white/[0.05] px-4 py-3 text-[12px] text-white/60">From library of {pool.length} songs</p>}
        <div className="mx-auto mt-6 grid max-w-[220px] gap-2.5">
          <button onClick={start} className="press w-full rounded-full bg-[var(--accent)] py-3 text-[13px] font-bold text-black">Play again</button>
          <button onClick={() => setShowResult(false)} className="press w-full rounded-full border border-white/15 py-3 text-[13px] font-semibold text-white/60">Back to settings</button>
        </div>
      </div>
    );
  }

  if (!started) return (
    <div className="no-scrollbar smooth-scroll flex-1 overflow-y-auto px-5 pb-28 pt-5">
      <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-[#FFD24C]/20 to-[#FF7A5C]/10 p-5">
        <p className="text-[12px] font-bold uppercase tracking-wider text-amber-400">TRIVIA CHALLENGE</p>
        <p className="pt-2 text-[20px] font-extrabold text-white">Can you name that song?</p>
        <p className="pt-1 text-[12.5px] leading-relaxed text-white/45">A short clip plays from your library. Pick the correct title before time runs out.</p>
      </div>
      <p className="pb-2 pt-5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/35">Players</p>
      <div className="grid grid-cols-2 gap-2">
        {[1, 2].map((p) => <button key={p} onClick={() => setPlayers(p as 1 | 2)} className={`press rounded-2xl border p-4 text-left ${players === p ? "border-[var(--accent)] bg-[var(--accent)]/10 text-white" : "border-white/8 bg-white/[0.04] text-white/50"}`}><span className="block text-[14px] font-mono font-bold text-[var(--accent)]">{p === 1 ? "1 PLAYER" : "2 PLAYERS"}</span><span className="block pt-1 text-[13px] font-bold">{p === 1 ? "Solo" : "Two players"}</span><span className="block text-[10.5px]">{p === 1 ? "Beat your best" : "Pass & play"}</span></button>)}
      </div>
      <p className="pb-2 pt-5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/35">Rounds</p>
      <div className="flex gap-2">{[5, 10, 20].map((n) => <button key={n} onClick={() => setRounds(n)} className={`press flex-1 rounded-full py-2 text-[12px] font-bold ${rounds === n ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/55"}`}>{n}</button>)}</div>
      <button onClick={start} disabled={pool.length < 2} className="press mt-6 w-full rounded-full bg-[var(--accent)] py-3.5 text-[14px] font-bold text-black disabled:opacity-40">{pool.length < 2 ? "Add at least 2 songs first" : "Start challenge"}</button>
      <p className="mt-3 text-center text-[10.5px] text-white/30">You need at least 2 songs in your library. The same library in "My Music → Songs" is used.</p>
    </div>
  );

  return (
    <div className="no-scrollbar smooth-scroll relative flex-1 overflow-y-auto px-5 pb-32 pt-3" style={{ WebkitOverflowScrolling: "touch" }}>
      {/* sticky score header */}
      <div className="sticky top-2 z-10 flex items-center justify-between rounded-2xl bg-[#101014]/90 px-3 py-1.5 backdrop-blur">
        <span className="text-[12px] font-semibold text-white/45">Round {round} / {rounds}</span>
        <div className="flex gap-1.5">{scores.slice(0, players).map((s, i) => <span key={i} className={`rounded-full px-3 py-1 text-[11px] font-bold ${i === activePlayer ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/55"}`}>P{i + 1} · {s}</span>)}</div>
      </div>

      <div className="mt-4 flex h-40 flex-col items-center justify-center rounded-3xl border border-white/8 bg-gradient-to-br from-[var(--ga)]/20 to-transparent shrink-0">
        <div className="flex h-14 items-end gap-[4px]">{Array.from({ length: 20 }).map((_, i) => <span key={i} className="w-1 rounded-full bg-[var(--accent)]" style={{ height: `${20 + ((i * 37) % 70)}%`, animation: `viz ${0.45 + (i % 5) * .07}s ease-in-out infinite` }} />)}</div>
        <p className="pt-3 text-[14px] font-bold text-white">Who knows this song?</p>
        <p className="pt-1 text-[11px] text-white/35">Player {activePlayer + 1}, choose below</p>
      </div>

      <div className="mt-4 space-y-2.5">
        {question?.options.map((t) => {
          const picked = revealed === t.id;
          const isAnswer = revealed && t.id === question.answer.id;
          return (
            <button key={t.id} onClick={() => answer(t.id)} className={`press flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${isAnswer ? "border-emerald-400 bg-emerald-400/15" : picked ? "border-rose-400 bg-rose-400/15" : "border-white/8 bg-white/[0.04]"}`}>
              <img src={t.cover} className="h-11 w-11 rounded-xl object-cover" alt="" />
              <span className="min-w-0 flex-1">
                <span className="clamp-1 block text-[13px] font-bold text-white">{t.title}</span>
                <span className="clamp-1 block text-[10.5px] text-white/40">{t.artist}</span>
              </span>
              {isAnswer && <span className="text-[16px]">✅</span>}
              {picked && !isAnswer && <span className="text-[16px]">❌</span>}
            </button>
          );
        })}
      </div>

      {/* Next round / results — always visible once an answer is picked */}
      {revealed && (
        <div className="slide-up mt-4">
          <button onClick={advance} className="press flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] py-3.5 text-[13px] font-bold text-black">
            {round >= rounds ? "See results →" : `Next round ${round + 1} →`}
          </button>
          {players === 2 && round < rounds && (
            <p className="pt-2 text-center text-[11px] text-white/40">Hand the phone to Player {activePlayer === 0 ? 2 : 1}</p>
          )}
        </div>
      )}
      <div className="h-8" />
    </div>
  );
}

function Focus({ tracks, playTrack, toggle, next, isPlaying: _isPlaying, setSleepTimer, onOpenPlayer }: {
  tracks: ReturnType<typeof usePlayer>["tracks"]; playTrack: (id: string) => void; toggle: () => void; next: () => void;
  isPlaying: boolean; setSleepTimer: (m: number | null) => void; onOpenPlayer: () => void;
}) {
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(0);
  const [active, setActive] = useState(false);
  const [mood, setMood] = useState(MOOD_QUEUE[0]);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setRemaining((r) => { if (r <= 1) { setActive(false); toggle(); return 0; } return r - 1; }), 1000);
    return () => window.clearInterval(id);
  }, [active, toggle]);
  const start = () => {
    const match = tracks.find((t) => mood.tags.some((tag) => t.tags.includes(tag))) ?? tracks[0];
    if (match) playTrack(match.id);
    setRemaining(minutes * 60); setActive(true); setSleepTimer(minutes);
  };
  return (
    <div className="no-scrollbar smooth-scroll flex-1 overflow-y-auto px-5 pb-28 pt-5">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">{mood.emoji} {mood.name} session</p>
        <p className="pt-2 text-[52px] font-extrabold tabular-nums text-white">{fmt(active ? remaining : minutes * 60)}</p>
        <p className="text-[12px] text-white/40">{active ? "Stay with it. Audenic will pause when time is up." : "Choose a mood and protect the session."}</p>
      </div>
      <p className="pb-2 pt-6 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/35">Mood</p>
      <div className="grid grid-cols-2 gap-2.5">{MOOD_QUEUE.map((m) => <button key={m.name} onClick={() => setMood(m)} className={`press flex items-center gap-3 rounded-2xl border p-3 text-left ${mood.name === m.name ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-white/8 bg-white/[0.04]"}`}><span className="text-[22px]">{m.emoji}</span><span><span className="block text-[13px] font-bold text-white">{m.name}</span><span className="block text-[10px] text-white/35">Smart queue</span></span></button>)}</div>
      <p className="pb-2 pt-5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/35">Duration</p>
      <div className="flex gap-2">{[15, 25, 50, 90].map((n) => <button key={n} onClick={() => setMinutes(n)} className={`press flex-1 rounded-full py-2 text-[12px] font-bold ${minutes === n ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/55"}`}>{n}m</button>)}</div>
      <div className="mt-6 flex gap-2.5">
        <button onClick={active ? () => setActive(false) : start} className="press flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--accent)] py-3 text-[13px] font-bold text-black">{active ? <Pause size={15} /> : <Play size={15} />}{active ? "Pause session" : "Start session"}</button>
        {active && <button onClick={next} className="press grid h-11 w-11 place-items-center rounded-full bg-white/[0.08] text-white"><Next size={16} /></button>}
        <button onClick={onOpenPlayer} className="press rounded-full border border-white/15 px-4 text-[11px] font-semibold text-white/65">Player</button>
      </div>
    </div>
  );
}

function Journal({ current, entries, onAdd, onDelete }: { current: ReturnType<typeof usePlayer>["current"]; entries: JournalEntry[]; onAdd: (e: JournalEntry) => void; onDelete: (id: string) => void }) {
  const [note, setNote] = useState(""); const [mood, setMood] = useState("Reflective");
  const save = () => { if (!current || !note.trim()) return; onAdd({ id: `j-${Date.now()}`, trackId: current.id, title: current.title, artist: current.artist, note: note.trim(), mood, ts: Date.now() }); setNote(""); };
  return (
    <div className="no-scrollbar smooth-scroll flex-1 overflow-y-auto px-5 pb-28 pt-5">
      <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-4">
        <div className="flex items-center gap-3"><div className="h-12 w-12 overflow-hidden rounded-2xl bg-white/5">{current && <img src={current.cover} className="h-full w-full object-cover" alt="" />}</div><div className="min-w-0"><p className="clamp-1 text-[13px] font-bold text-white">{current?.title ?? "Play a song first"}</p><p className="clamp-1 text-[10.5px] text-white/40">{current?.artist ?? "Your note will attach to the current song"}</p></div></div>
        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">{["Reflective", "Happy", "Calm", "Healing", "Inspired"].map((m) => <button key={m} onClick={() => setMood(m)} className={`press shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${mood === m ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/55"}`}>{m}</button>)}</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What does this song mean right now?" className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-[13px] text-white outline-none focus:border-[var(--accent)]" />
        <button onClick={save} disabled={!current || !note.trim()} className="press mt-2 w-full rounded-full bg-[var(--accent)] py-2.5 text-[12px] font-bold text-black disabled:opacity-35">Save journal entry</button>
      </div>
      <p className="pb-2 pt-5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/35">Your entries</p>
      <div className="stagger space-y-2.5">{entries.map((e) => <div key={e.id} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="clamp-1 text-[12.5px] font-bold text-white">{e.title}</p><p className="text-[10px] text-[var(--accent)]">{e.artist} · {e.mood}</p></div><button onClick={() => onDelete(e.id)} className="text-[10px] text-white/25 hover:text-rose-300">Delete</button></div><p className="pt-2 text-[12.5px] leading-relaxed text-white/65">{e.note}</p><p className="pt-1.5 text-[9.5px] text-white/25">{new Date(e.ts).toLocaleDateString()}</p></div>)}</div>
      {!entries.length && <p className="py-8 text-center text-[12px] text-white/30">Your listening memories will appear here.</p>}
    </div>
  );
}

function Recap({ analytics, tracks, likedCount, playlistCount, recentlyPlayed }: { analytics: ReturnType<typeof usePlayer>["analytics"]; tracks: ReturnType<typeof usePlayer>["tracks"]; likedCount: number; playlistCount: number; recentlyPlayed: string[] }) {
  const top = analytics.topTracks.slice(0, 3).map((x) => ({ ...x, track: tracks.find((t) => t.id === x.id) })).filter((x) => x.track);
  const max = Math.max(1, ...analytics.byDay.map((d) => d.minutes));
  return (
    <div className="no-scrollbar smooth-scroll flex-1 overflow-y-auto px-5 pb-28 pt-5">
      <div className="rounded-[30px] border border-white/8 bg-gradient-to-br from-[var(--accent)]/25 via-[var(--ga)]/15 to-transparent p-5"><p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-white/50">This week</p><p className="pt-2 text-[32px] font-extrabold text-white">{Math.round(analytics.totalMinutes)} min</p><p className="text-[12px] text-white/50">{analytics.totalListens} plays · {likedCount} likes · {playlistCount} playlists</p></div>
      <div className="mt-4 flex h-32 items-end justify-between gap-2 rounded-3xl bg-white/[0.04] p-4">{analytics.byDay.map((d) => <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"><div className="w-full rounded-t-full bg-gradient-to-t from-[var(--accent-soft)] to-[var(--accent)]" style={{ height: `${Math.max(5, (d.minutes / max) * 100)}%` }} /><span className="text-[9.5px] text-white/40">{d.label}</span></div>)}</div>
      <p className="pb-2 pt-5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/35">Top this week</p>
      <div className="space-y-2">{top.map((x, i) => <div key={x.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2.5"><span className="w-5 text-center text-[13px] font-bold text-[var(--accent)]">{i + 1}</span><img src={x.track!.cover} className="h-10 w-10 rounded-xl object-cover" alt="" /><div className="min-w-0 flex-1"><p className="clamp-1 text-[12.5px] font-bold text-white">{x.track!.title}</p><p className="clamp-1 text-[10px] text-white/40">{x.track!.artist}</p></div><span className="text-[10.5px] font-bold text-white/45">{x.count}×</span></div>)}</div>
      {!top.length && <p className="py-8 text-center text-[12px] text-white/30">Listen this week and Audenic will build your recap.</p>}
      <p className="mt-5 rounded-2xl bg-white/[0.04] p-4 text-[12px] leading-relaxed text-white/55">You revisited {recentlyPlayed.length} different tracks recently. Keep listening — next week Audenic can highlight discoveries, favorite moods and your strongest streak.</p>
    </div>
  );
}