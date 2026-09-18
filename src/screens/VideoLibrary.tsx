import React, { useState } from "react";
import { useVideoScanner, LocalVideo } from "../player/useVideoScanner";
import { CATEGORY_META, VideoCategory } from "../player/videoClassifier";
import { Back, Play, Refresh, Filter, Check } from "../components/Icons";

const ALL_CATS: VideoCategory[] = [
  "reel", "music_video", "concert", "movie", "tutorial", "my_video", "other",
];

export default function VideoLibrary({
  onBack,
  onPlayVideo,
}: {
  onBack: () => void;
  onPlayVideo: (video: LocalVideo) => void;
}) {
  const {
    library,
    isScanning,
    scanError,
    rescan,
    overrideCategory,
    getCategoryCount,
  } = useVideoScanner();

  const [activeCategory, setActiveCategory] = useState<VideoCategory>("reel");
  const [selectedVideo, setSelectedVideo] = useState<LocalVideo | null>(null);

  const activeVideos = library.byCategory[activeCategory] || [];

  return (
    <div className="fade-in relative flex h-full flex-col bg-[#0A0A0D] text-white">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 pt-11 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="press flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <Back size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold">Smart Video Library</h1>
            <p className="text-xs text-white/50">
              {library.totalFound} videos sorted by AI classifier
            </p>
          </div>
        </div>
        <button
          onClick={rescan}
          disabled={isScanning}
          className="press flex items-center gap-1.5 rounded-full bg-purple-600/20 px-3.5 py-1.5 text-xs font-semibold text-purple-400 disabled:opacity-50"
        >
          <Refresh size={14} className={isScanning ? "animate-spin" : ""} />
          <span>{isScanning ? "Scanning..." : "Rescan"}</span>
        </button>
      </div>

      {/* Category Tabs Bar */}
      <div className="no-scrollbar flex gap-2 border-b border-white/5 px-4 py-3 overflow-x-auto">
        {ALL_CATS.map((cat) => {
          const count = getCategoryCount(cat);
          const meta = CATEGORY_META[cat];
          const active = activeCategory === cat;

          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`press shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                active ? "text-white shadow-lg" : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
              style={active ? { backgroundColor: meta.color } : {}}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  active ? "bg-white/20 text-white" : "bg-white/10 text-white/40"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scan Error Alert */}
      {scanError && (
        <div className="m-4 rounded-2xl bg-rose-500/10 p-4 border border-rose-500/20 text-xs text-rose-300">
          {scanError}
        </div>
      )}

      {/* Main Content Area */}
      <div className="no-scrollbar flex-1 overflow-y-auto p-4">
        {isScanning && library.totalFound === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-white/40">
            <Refresh size={32} className="animate-spin text-purple-500" />
            <p className="text-sm font-medium">Scanning device videos with AI classifier...</p>
          </div>
        ) : activeVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <span className="text-5xl">{CATEGORY_META[activeCategory].icon}</span>
            <p className="text-base font-bold">No {CATEGORY_META[activeCategory].label} found</p>
            <p className="max-w-xs text-xs text-white/40">
              {CATEGORY_META[activeCategory].description}. Videos added to your device will be
              automatically classified here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
            {activeVideos.map((video) => (
              <div
                key={video.id}
                onClick={() => onPlayVideo(video)}
                className="group press relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 cursor-pointer"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">
                      {CATEGORY_META[video.effectiveCategory].icon}
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                    {video.formattedDuration}
                  </span>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-purple-600 text-white shadow-lg">
                      <Play size={18} />
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col justify-between p-3">
                  <div>
                    <h3 className="clamp-1 text-xs font-bold text-white group-hover:text-purple-300">
                      {video.title}
                    </h3>
                    <p className="mt-0.5 text-[10px] text-white/40">
                      {video.formattedSize} • {video.bucket || "Storage"}
                    </p>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[9px] font-semibold text-purple-300">
                      {video.classification.confidence}% match
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVideo(video);
                      }}
                      className="press rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
                      title="Change Category"
                    >
                      <Filter size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Category Correction Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="slide-up w-full max-w-md rounded-3xl border border-white/10 bg-[#141418] p-5 shadow-2xl"
          >
            <h3 className="text-base font-bold">Move "{selectedVideo.title}"</h3>
            <p className="mt-1 text-xs text-white/50">
              Select correct category if AI misclassified this video:
            </p>

            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto no-scrollbar">
              {ALL_CATS.map((cat) => {
                const meta = CATEGORY_META[cat];
                const selected = selectedVideo.effectiveCategory === cat;

                return (
                  <button
                    key={cat}
                    onClick={() => {
                      overrideCategory(selectedVideo.id, cat);
                      setSelectedVideo(null);
                    }}
                    className={`press flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${
                      selected
                        ? "border-purple-500 bg-purple-500/10 text-white"
                        : "border-white/5 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{meta.icon}</span>
                      <div>
                        <p className="text-xs font-semibold">{meta.label}</p>
                        <p className="text-[10px] text-white/40">{meta.description}</p>
                      </div>
                    </div>
                    {selected && <Check size={16} className="text-purple-400" />}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setSelectedVideo(null)}
              className="press mt-4 w-full rounded-2xl bg-white/10 py-3 text-xs font-bold text-white hover:bg-white/20"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
