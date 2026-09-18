import { useEffect, useRef, useState } from "react";
import { PlayerProvider, usePlayer } from "./player/PlayerContext";
import { CourseVideoProvider, useCourseVideo } from "./player/CourseVideoContext";
import { PhoneShell, useIsMobile } from "./components/Shell";
import { BottomNav, MiniPlayer, type Tab } from "./components/BottomBar";
import { DesktopStudio } from "./components/DesktopStudio";
import HomeScreen from "./screens/HomeScreen";
import MyMusic from "./screens/MyMusic";
import NowPlaying from "./screens/NowPlaying";
import ExploreScreen from "./screens/ExploreScreen";
import ReelsScreen from "./screens/ReelsScreen";
import SongDetails from "./screens/SongDetails";
import VideoPlayer from "./screens/VideoPlayer";
import ThemeScreen from "./screens/ThemeScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import AdminScreen from "./screens/AdminScreen";
import ArtistScreen from "./screens/ArtistScreen";
import PlaylistScreen from "./screens/PlaylistScreen";
import DriveMode from "./screens/DriveMode";
import { SettingsScreen } from "./screens/ExtraScreens";
import AIScreen from "./screens/AIScreen";
import AchievementsScreen from "./screens/AchievementsScreen";
import ExperiencesScreen from "./screens/ExperiencesScreen";
import DiagnosticsScreen from "./screens/DiagnosticsScreen";
import OnboardingFlow from "./onboarding/OnboardingFlow";
import { DesktopVideoCoursePlayer } from "./screens/DesktopVideoCoursePlayer";
import { YouTubeDownloaderTab } from "./screens/YouTubeDownloaderTab";
import { AchievementToast } from "./components/AchievementToast";
import { Maximize, Minimize, Bot, Play, Pause, Film } from "./components/Icons";
import { DesktopFloatingMiniPlayer } from "./components/DesktopFloatingMiniPlayer";
import { AppSplashScreen } from "./components/AppSplashScreen";
import { onBackPress, isNative } from "./player/nativeBridge";
import { isDesktop, toggleDesktopWidget } from "./player/tauriBridge";
import { DesktopWidget } from "./components/DesktopWidget";
import { useNavigationHistory } from "./player/useNavigationHistory";
import { isAdminEmail } from "./player/PlayerContext";
import { Equalizer } from "./screens/Equalizer";
import { DJMixerScreen } from "./screens/DJMixerScreen";
import { ContextMenuProvider } from "./components/ContextMenu";
import type { AINavTarget } from "./player/aiActions";

type Overlay =
  | "player"
  | "video"
  | "theme"
  | "equalizer"
  | "dj"
  | "analytics"
  | "profile"
  | "drive"
  | "ai"
  | "achievements"
  | "experiences"
  | "admin"
  | "diagnostics"
  | { type: "artist"; name: string }
  | { type: "playlist"; id: string }
  | { type: "song"; id: string }
  | null;

function Phone({ immersive }: { immersive: boolean }) {
  const { loggedIn, setDriveMode, playExternal, floatingAi, profile } = usePlayer();
  const [tab, setTab] = useState<Tab>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [reelsChromeHidden, setReelsChromeHidden] = useState(false);

  const openPlayer = () => setOverlay("player");
  const openVideo = () => {
    if (isDesktop()) {
      setOverlay(null);
      setTab("courses");
    } else {
      setOverlay("video");
    }
  };
  const openTheme = () => setOverlay("theme");
  const openEqualizer = () => setOverlay("equalizer");
  const goAnalytics = () => setOverlay("analytics");
  const openProfile = () => setOverlay("profile");
  const openArtist = (name: string) => setOverlay({ type: "artist", name });
  const openPlaylist = (id: string) => setOverlay({ type: "playlist", id });
  const openSong = (id: string) => setOverlay({ type: "song", id });
  const openDrive = () => { setDriveMode(true); setOverlay("drive"); };
  const openSettings = () => { setOverlay(null); setTab("settings"); };
  const openAI = () => setOverlay("ai");
  const openAchievements = () => setOverlay("achievements");
  const openExperiences = () => setOverlay("experiences");
  const openAdmin = () => setOverlay("admin");
  const openDiagnostics = () => setOverlay("diagnostics");
  const changeTab = (t: Tab) => { if (t !== "reels") setReelsChromeHidden(false); setTab(t); };

  // Hardware back / browser Escape closes sheets and player before exiting.
  useNavigationHistory({
    overlay,
    setOverlay,
    tab,
    setTab,
    reelsChromeHidden,
    setReelsChromeHidden,
  });

  const aiNavigate = (target: AINavTarget) => {
    switch (target) {
      case "home": setOverlay(null); setTab("home"); break;
      case "library": setOverlay(null); setTab("music"); break;
      case "courses": setOverlay(null); setTab("courses"); break;
      case "explore": setOverlay(null); setTab("explore"); break;
      case "reels": setOverlay(null); setTab("reels"); break;
      case "settings": setOverlay(null); setTab("settings"); break;
      case "profile": setOverlay("profile"); break;
      case "analytics": setOverlay("analytics"); break;
      case "player": setOverlay("player"); break;
    }
  };

  if (!loggedIn) {
    return (
      <PhoneShell immersive={immersive}>
        <OnboardingFlow onComplete={() => setTab("home")} />
      </PhoneShell>
    );
  }

  if (overlay === "drive") {
    return (
      <PhoneShell immersive={immersive}>
        <DriveMode onExit={() => { setDriveMode(false); setOverlay(null); }} />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell immersive={immersive}>
      <AchievementToast />
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0A0D]">
        {overlay === "player" ? (
          <NowPlaying onBack={() => setOverlay(null)} onOpenSettings={openSettings} onOpenArtist={openArtist} />
        ) : overlay === "video" ? (
          <VideoPlayer onBack={() => setOverlay(null)} />
        ) : overlay === "theme" ? (
          <ThemeScreen onBack={() => setOverlay(null)} />
        ) : overlay === "equalizer" ? (
          <Equalizer onClose={() => setOverlay(null)} />
        ) : overlay === "analytics" ? (
          <AnalyticsScreen onBack={() => setOverlay(null)} />
        ) : overlay === "profile" ? (
          <ProfileScreen
            onBack={() => setOverlay(null)}
            onLoggedOut={() => setOverlay(null)}
            onOpenAdmin={isAdminEmail(profile.email) ? openAdmin : undefined}
          />
        ) : overlay && typeof overlay === "object" && overlay.type === "artist" ? (
          <ArtistScreen artistName={overlay.name} onBack={() => setOverlay(null)} onOpenPlayer={openPlayer} />
        ) : overlay && typeof overlay === "object" && overlay.type === "playlist" ? (
          <PlaylistScreen playlistId={overlay.id} onBack={() => setOverlay(null)} onOpenPlayer={openPlayer} />
        ) : overlay && typeof overlay === "object" && overlay.type === "song" ? (
          <SongDetails trackId={overlay.id} onBack={() => setOverlay(null)} onOpenPlayer={openPlayer} onOpenArtist={openArtist} />
        ) : overlay === "ai" ? (
          <AIScreen onBack={() => setOverlay(null)} onNavigate={aiNavigate} onPlayExternal={(t) => playExternal(t)} />
        ) : overlay === "achievements" ? (
          <AchievementsScreen onBack={() => setOverlay(null)} />
        ) : overlay === "experiences" ? (
          <ExperiencesScreen onBack={() => setOverlay(null)} onOpenPlayer={openPlayer} />
        ) : overlay === "admin" ? (
          <AdminScreen onBack={() => setOverlay(null)} onOpenDiagnostics={openDiagnostics} />
        ) : overlay === "diagnostics" ? (
          <DiagnosticsScreen />
        ) : (
          <>
            <div className="relative flex-1 min-h-0 overflow-hidden">
              {tab === "home" && (
                <HomeScreen onOpenPlayer={openPlayer} onOpenLibrary={() => setTab("music")} onOpenProfile={openProfile} onOpenArtist={openArtist} onOpenSong={openSong} onOpenAI={openAI} onOpenExperiences={openExperiences} onOpenAchievements={openAchievements} />
              )}
              {tab === "music" && (
                <MyMusic key="music" onBack={() => setTab("home")} onOpenPlayer={openPlayer} onOpenVideo={openVideo} onOpenSettings={goAnalytics} onOpenArtist={openArtist} onOpenPlaylist={openPlaylist} onOpenSong={openSong} />
              )}
              {tab === "explore" && <ExploreScreen onOpenSong={openSong} onOpenArtist={openArtist} />}
              {tab === "reels" && <ReelsScreen chromeHidden={reelsChromeHidden} onChromeHiddenChange={setReelsChromeHidden} />}
              {tab === "settings" && (
                <SettingsScreen onTheme={openTheme} onAnalytics={goAnalytics} onVideo={openVideo} onDrive={openDrive} onAI={openAI} onAchievements={openAchievements} />
              )}
            </div>
            {!(tab === "reels" && reelsChromeHidden) && (
              <>
                {floatingAi && tab !== "reels" && tab !== "settings" && (
                  <button
                    onClick={openAI}
                    className="press fixed bottom-36 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[var(--accent)] text-black shadow-[0_14px_34px_-8px_color-mix(in_srgb,var(--accent)_65%,transparent)]"
                    title="Audenic AI"
                  >
                    <Bot size={24} />
                  </button>
                )}
                <div className="absolute inset-x-0 bottom-0 z-30 slide-up pointer-events-none">
                  <div className="pointer-events-auto">
                    <MiniPlayer onOpen={openPlayer} />
                    <BottomNav tab={tab} onTab={changeTab} />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </PhoneShell>
  );
}

function FullscreenToggle({ targetRef }: { targetRef: React.RefObject<HTMLDivElement | null> }) {
  const [full, setFull] = useState(false);
  useEffect(() => { const c = () => setFull(!!document.fullscreenElement); document.addEventListener("fullscreenchange", c); return () => document.removeEventListener("fullscreenchange", c); }, []);
  return (
    <button onClick={() => { if (!document.fullscreenElement) targetRef.current?.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.().catch(() => {}); }} className="absolute right-3 top-3 z-40 hidden items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-[11px] font-medium text-white/70 backdrop-blur transition hover:text-white lg:flex">
      {full ? <Minimize size={14} /> : <Maximize size={14} />}
      {full ? "Exit" : "Fullscreen"}
    </button>
  );
}

function MainAppView() {
  const isMobile = useIsMobile();
  const frameRef = useRef<HTMLDivElement>(null);
  const [isFull, setIsFull] = useState(false);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const {
    loggedIn,
    playExternal,
    profile,
    toggle,
    next,
    prev,
    current,
    isPlaying,
    progress,
    duration,
    volume,
    setVolume,
    seek,
  } = usePlayer();

  const [tab, setTab] = useState<Tab>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const { activeVideo, isPlaying: isVideoPlaying, setIsPlaying: setVideoPlaying } = useCourseVideo();

  // Desktop HUD Widget Sync via BroadcastChannel
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("audenic-player");

      const broadcastState = () => {
        bc?.postMessage({
          type: "state_update",
          payload: {
            title: current?.title || "Audenic Music",
            artist: current?.artist || "Ready to play",
            cover: current?.cover || "",
            isPlaying,
            progress,
            duration,
            volume,
          },
        });
      };

      broadcastState();

      bc.onmessage = (ev) => {
        if (!ev.data) return;
        if (ev.data.type === "request_state") {
          broadcastState();
        } else if (ev.data.type === "command") {
          const { action, payload } = ev.data;
          if (action === "toggle") toggle();
          else if (action === "next") next();
          else if (action === "prev") prev();
          else if (action === "seek" && typeof payload === "number") seek(payload);
          else if (action === "set_volume" && typeof payload === "number") setVolume(payload);
          else if (action === "toggle_mute") setVolume(volume > 0 ? 0 : 0.8);
        }
      };
    } catch (e) {
      console.warn("BroadcastChannel not supported", e);
    }

    return () => {
      bc?.close();
    };
  }, [current, isPlaying, progress, duration, volume, toggle, next, prev, seek, setVolume]);

  useEffect(() => {
    const c = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", c);
    return () => document.removeEventListener("fullscreenchange", c);
  }, []);

  // Global Keyboard Shortcuts for audio playback (when not typing or in video studio)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (tab === "courses") return;

      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        next();
      } else if (e.key.toLowerCase() === "p" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [toggle, next, prev, tab]);

  const immersive = !isDesktop() && (isMobile || isFull || isNative());

  const openPlayer = () => setOverlay("player");
  const openVideo = () => {
    if (isDesktop()) {
      setOverlay(null);
      setTab("courses");
    } else {
      setOverlay("video");
    }
  };
  const openTheme = () => setOverlay("theme");
  const openEqualizer = () => setOverlay("equalizer");
  const openDJ = () => setOverlay("dj");
  const goAnalytics = () => setOverlay("analytics");
  const openProfile = () => setOverlay("profile");
  const openArtist = (name: string) => setOverlay({ type: "artist", name });
  const openPlaylist = (id: string) => setOverlay({ type: "playlist", id });
  const openSong = (id: string) => setOverlay({ type: "song", id });
  const openAI = () => setOverlay("ai");
  const openAchievements = () => setOverlay("achievements");
  const openExperiences = () => setOverlay("experiences");
  const openAdmin = () => setOverlay("admin");
  const openDiagnostics = () => setOverlay("diagnostics");

  const aiNavigate = (target: AINavTarget) => {
    switch (target) {
      case "home": setOverlay(null); setTab("home"); break;
      case "library": setOverlay(null); setTab("music"); break;
      case "courses": setOverlay(null); setTab("courses"); break;
      case "explore": setOverlay(null); setTab("explore"); break;
      case "reels": setOverlay(null); setTab("reels"); break;
      case "settings": setOverlay(null); setTab("settings"); break;
      case "profile": setOverlay("profile"); break;
      case "analytics": setOverlay("analytics"); break;
      case "player": setOverlay("player"); break;
    }
  };

  // On Mobile viewports (non-desktop), render mobile shell
  if (!isDesktop() && (viewMode === "mobile" || immersive)) {
    const isEdgeToEdge = immersive || (typeof window !== "undefined" && window.innerWidth < 768);
    return (
      <div ref={frameRef} className={`relative flex w-full items-center justify-center overflow-hidden bg-[#0a0a0d] ${isEdgeToEdge ? "h-[100dvh]" : "min-h-full p-3 sm:p-6"}`}>
        {!isEdgeToEdge && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-40 top-1/3 h-[420px] w-[420px] rounded-full bg-[#8B3BFF] opacity-40 blur-[130px]" />
            <div className="absolute -bottom-40 left-1/4 h-[380px] w-[380px] rounded-full bg-[#FF61C7] opacity-25 blur-[130px]" />
            <div className="absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-[#D9F27E] opacity-30 blur-[140px]" />
            <div className="absolute right-10 top-0 h-[320px] w-[320px] rounded-full bg-[#3B6BFF] opacity-20 blur-[130px]" />
          </div>
        )}
        {!isEdgeToEdge && <FullscreenToggle targetRef={frameRef} />}
        <div className={`relative flex w-full items-center justify-center ${isEdgeToEdge ? "h-full" : "max-w-6xl flex-col gap-6 lg:flex-row lg:justify-center lg:gap-10"}`}>
          <Phone immersive={isEdgeToEdge} />
        </div>
        <AchievementToast />
      </div>
    );
  }

  // Desktop Widescreen Studio Mode
  return (
    <DesktopStudio
      currentTab={tab}
      currentOverlay={typeof overlay === "string" ? overlay : (overlay as any)?.type || null}
      onSelectTab={(t) => { setOverlay(null); setTab(t); }}
      onOpenOverlay={(ov) => {
        if (ov === "player") openPlayer();
        else if (ov === "theme") openTheme();
        else if (ov === "equalizer") openEqualizer();
        else if (ov === "dj") openDJ();
        else if (ov === "analytics") goAnalytics();
        else if (ov === "profile") openProfile();
        else if (ov === "ai") openAI();
        else if (ov === "achievements") openAchievements();
        else if (ov === "experiences") openExperiences();
        else if (ov === "admin") openAdmin();
      }}
      viewMode={viewMode}
      onToggleViewMode={setViewMode}
      isPlayerOverlay={overlay === "player"}
      onToggleMiniPlayer={() => {
        if (isDesktop()) {
          toggleDesktopWidget().catch(() => {});
        } else {
          setShowMiniPlayer((prev) => !prev);
        }
      }}
      onOpenSimpleMode={() => setOverlay("drive")}
    >
      {!loggedIn ? (
        <OnboardingFlow onComplete={() => setTab("home")} />
      ) : overlay === "player" ? (
        <NowPlaying onBack={() => setOverlay(null)} onOpenSettings={() => { setOverlay(null); setTab("settings"); }} onOpenArtist={openArtist} />
      ) : overlay === "video" ? (
        <VideoPlayer onBack={() => setOverlay(null)} />
      ) : overlay === "drive" ? (
        <DriveMode onExit={() => setOverlay(null)} />
      ) : overlay === "theme" ? (
        <ThemeScreen onBack={() => setOverlay(null)} />
      ) : overlay === "equalizer" ? (
        <Equalizer onClose={() => setOverlay(null)} />
      ) : overlay === "dj" ? (
        <DJMixerScreen onClose={() => setOverlay(null)} />
      ) : overlay === "analytics" ? (
        <AnalyticsScreen onBack={() => setOverlay(null)} />
      ) : overlay === "profile" ? (
        <ProfileScreen onBack={() => setOverlay(null)} onLoggedOut={() => setOverlay(null)} onOpenAdmin={isAdminEmail(profile.email) ? openAdmin : undefined} />
      ) : overlay && typeof overlay === "object" && overlay.type === "artist" ? (
        <ArtistScreen artistName={overlay.name} onBack={() => setOverlay(null)} onOpenPlayer={openPlayer} />
      ) : overlay && typeof overlay === "object" && overlay.type === "playlist" ? (
        <PlaylistScreen playlistId={overlay.id} onBack={() => setOverlay(null)} onOpenPlayer={openPlayer} />
      ) : overlay && typeof overlay === "object" && overlay.type === "song" ? (
        <SongDetails trackId={overlay.id} onBack={() => setOverlay(null)} onOpenPlayer={openPlayer} onOpenArtist={openArtist} />
      ) : overlay === "ai" ? (
        <AIScreen onBack={() => setOverlay(null)} onNavigate={aiNavigate} onPlayExternal={(t) => playExternal(t)} />
      ) : overlay === "achievements" ? (
        <AchievementsScreen onBack={() => setOverlay(null)} />
      ) : overlay === "experiences" ? (
        <ExperiencesScreen onBack={() => setOverlay(null)} onOpenPlayer={openPlayer} />
      ) : overlay === "admin" ? (
        <AdminScreen onBack={() => setOverlay(null)} onOpenDiagnostics={openDiagnostics} />
      ) : overlay === "diagnostics" ? (
        <DiagnosticsScreen />
      ) : (
        <>
          {tab === "home" && (
            <HomeScreen onOpenPlayer={openPlayer} onOpenLibrary={() => setTab("music")} onOpenProfile={openProfile} onOpenArtist={openArtist} onOpenSong={openSong} onOpenAI={openAI} onOpenExperiences={openExperiences} onOpenAchievements={openAchievements} />
          )}
          {tab === "music" && (
            <MyMusic key="music" onBack={() => setTab("home")} onOpenPlayer={openPlayer} onOpenVideo={openVideo} onOpenSettings={goAnalytics} onOpenArtist={openArtist} onOpenPlaylist={openPlaylist} onOpenSong={openSong} />
          )}
          {tab === "explore" && <ExploreScreen onOpenSong={openSong} onOpenArtist={openArtist} />}

          {/* Persistent Course & Video Studio: Keeps playback & PiP alive across all tabs */}
          <div className={`h-full w-full ${tab === "courses" ? "flex flex-col min-h-0" : "hidden"}`}>
            <DesktopVideoCoursePlayer />
          </div>

          {tab === "downloader" && (
            <YouTubeDownloaderTab onPlayVideo={() => setTab("courses")} />
          )}
          {tab === "reels" && <ReelsScreen chromeHidden={false} onChromeHiddenChange={() => {}} />}
          {tab === "settings" && (
            <SettingsScreen onTheme={openTheme} onAnalytics={goAnalytics} onVideo={openVideo} onDrive={() => setOverlay("drive")} onAI={openAI} onAchievements={openAchievements} />
          )}

          {/* Floating background video indicator when playing and navigating other tabs */}
          {tab !== "courses" && isVideoPlaying && activeVideo && (
            <div className="fixed bottom-24 right-6 z-40 flex items-center gap-3 rounded-2xl border border-[var(--accent)]/40 bg-[#0E0E14]/95 px-4 py-2.5 shadow-2xl backdrop-blur-xl">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--accent)]/20 text-[var(--accent)] shrink-0 animate-pulse">
                <Film size={16} />
              </span>
              <div className="max-w-[170px] truncate">
                <p className="text-xs font-semibold text-white truncate">{activeVideo.title}</p>
                <p className="text-[10px] text-[var(--accent)] font-medium">Video Playing in Background</p>
              </div>
              <button
                onClick={() => setVideoPlaying(!isVideoPlaying)}
                className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                title={isVideoPlaying ? "Pause Video" : "Play Video"}
              >
                {isVideoPlaying ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                onClick={() => { setOverlay(null); setTab("courses"); }}
                className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-black hover:opacity-90 transition active:scale-95"
              >
                View
              </button>
            </div>
          )}
        </>
      )}
      <AchievementToast />
      {showMiniPlayer && (
        <DesktopFloatingMiniPlayer onClose={() => setShowMiniPlayer(false)} />
      )}
      {showSplash && (
        <AppSplashScreen onFinish={() => setShowSplash(false)} />
      )}
    </DesktopStudio>
  );
}

function ContextMenuContainer({ children }: { children: React.ReactNode }) {
  const {
    playTrack,
    addToQueue,
    playNext,
    liked,
    toggleLike,
    playlists,
    addToPlaylist,
    createPlaylist,
    scanDesktopLibrary,
  } = usePlayer();

  return (
    <ContextMenuProvider
      playlists={playlists}
      onAddToPlaylist={addToPlaylist}
      onCreatePlaylist={createPlaylist}
      playTrack={playTrack}
      addToQueue={addToQueue}
      playNext={playNext}
      liked={liked}
      toggleLike={toggleLike}
      onScanLibrary={() => {
        scanDesktopLibrary().catch(() => {});
      }}
    >
      {children}
    </ContextMenuProvider>
  );
}

export default function App() {
  const [isWidgetRoute, setIsWidgetRoute] = useState(() => {
    return typeof window !== "undefined" && window.location.hash.startsWith("#/widget");
  });

  useEffect(() => {
    const handleHash = () => {
      setIsWidgetRoute(typeof window !== "undefined" && window.location.hash.startsWith("#/widget"));
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  if (isWidgetRoute) {
    return <DesktopWidget />;
  }

  return (
    <PlayerProvider>
      <CourseVideoProvider>
        <ContextMenuContainer>
          <MainAppView />
        </ContextMenuContainer>
      </CourseVideoProvider>
    </PlayerProvider>
  );
}
