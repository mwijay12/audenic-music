import { usePlayer } from "../player/PlayerContext";
import { IconButton, StatusBar } from "../components/Shell";
import { Back, Chart, Trash } from "../components/Icons";

export default function AnalyticsScreen({ onBack }: { onBack: () => void }) {
  const { analytics, tracks, resetAnalytics } = usePlayer();
  const top = analytics.topTracks
    .map((t) => ({ ...t, track: tracks.find((x) => x.id === t.id) }))
    .filter((t) => t.track);
  const maxMin = Math.max(1, ...analytics.byDay.map((d) => d.minutes));
  const totalH = Math.floor(analytics.totalMinutes / 60);
  const totalM = Math.round(analytics.totalMinutes % 60);

  return (
    <div className="fade-in flex h-full flex-col">
      <StatusBar />
      <div className="flex items-center justify-between px-6 pt-3">
        <IconButton onClick={onBack} label="Back">
          <Back size={20} />
        </IconButton>
        <p className="text-[15px] font-semibold text-white">Listening</p>
        <IconButton onClick={resetAnalytics} label="Reset">
          <Trash size={16} />
        </IconButton>
      </div>

      <div className="px-6 pt-3">
        <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.07] to-transparent p-5">
          <div className="flex items-center gap-2">
            <Chart size={14} className="text-[var(--accent)]" />
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/45">
              This week
            </p>
          </div>
          <div className="mt-3 flex h-28 items-end justify-between gap-1.5">
            {analytics.byDay.map((d) => {
              const h = Math.max(6, (d.minutes / maxMin) * 100);
              return (
                <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[9px] text-white/45">
                    {d.minutes > 0 ? Math.round(d.minutes) : ""}
                  </span>
                  <div
                    className="w-full rounded-t-full bg-gradient-to-t from-[var(--accent-soft)] to-[var(--accent)]"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[10px] text-white/55">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-6 mt-4 grid grid-cols-3 gap-2">
        <Stat n={analytics.totalListens} l="Listens" />
        <Stat n={`${totalH}h ${totalM}m`} l="Time" />
        <Stat n={analytics.streak} l="Day streak" />
      </div>

      <p className="px-6 pb-1 pt-5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/40">
        Top tracks
      </p>
      <div className="no-scrollbar flex-1 overflow-y-auto px-6 pb-40">
        {top.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-white/35">
            Play some songs to see your top tracks here.
          </p>
        ) : (
          <div className="space-y-2">
            {top.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2.5"
              >
                <span className="w-5 text-center text-[12px] font-bold text-white/50">
                  {i + 1}
                </span>
                <img src={t.track!.cover} className="h-10 w-10 rounded-xl object-cover" alt="" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white">
                    {t.track!.title}
                  </p>
                  <p className="truncate text-[11px] text-white/45">{t.track!.artist}</p>
                </div>
                <span className="text-[11px] font-semibold text-[var(--accent)]">
                  {t.count}×
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: number | string; l: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-3 text-center">
      <p className="text-[18px] font-bold text-[var(--accent)]">{n}</p>
      <p className="text-[10px] text-white/45">{l}</p>
    </div>
  );
}
