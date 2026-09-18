import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import {
  DesktopVideo,
  pickFolder,
  pickVideoFiles,
  scanDirectory,
} from "./tauriBridge";

export interface VideoBookmark {
  time: number;
  note: string;
}

interface CourseVideoContextValue {
  videos: DesktopVideo[];
  activeVideoId: string | null;
  activeVideo: DesktopVideo | null;
  selectedFolder: string;
  setSelectedFolder: (folder: string) => void;
  folders: string[];
  filteredVideos: DesktopVideo[];
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  duration: number;
  setDuration: (duration: number) => void;
  selectVideo: (video: DesktopVideo) => void;
  playNext: () => void;
  playPrev: () => void;
  deleteVideo: (id: string) => void;
  clearAllVideos: () => void;
  scanFolder: () => Promise<void>;
  pickFiles: () => Promise<void>;
  isScanning: boolean;
  progressMemory: Record<string, number>;
  setProgressMemory: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  bookmarks: Record<string, VideoBookmark[]>;
  addBookmark: (note: string) => void;
  removeBookmark: (index: number) => void;
  moveVideo: (id: string, direction: -1 | 1) => void;
  reorderVideos: (fromIndex: number, toIndex: number) => void;
  isAudioOnly: boolean;
  setIsAudioOnly: (val: boolean) => void;
  toggleAudioOnly: () => void;
}

const CourseVideoContext = createContext<CourseVideoContextValue | null>(null);

export function CourseVideoProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<DesktopVideo[]>(() => {
    try {
      const saved = localStorage.getItem("audenic_desktop_videos");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeVideoId, setActiveVideoId] = useState<string | null>(() => {
    return localStorage.getItem("audenic_last_video_id") || null;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [isScanning, setIsScanning] = useState(false);

  // Video progress memory: id -> seconds
  const [progressMemory, setProgressMemory] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("audenic_video_progress");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Bookmarks memory: id -> VideoBookmark[]
  const [bookmarks, setBookmarks] = useState<Record<string, VideoBookmark[]>>(() => {
    try {
      const saved = localStorage.getItem("audenic_video_bookmarks");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Save videos to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("audenic_desktop_videos", JSON.stringify(videos));
    } catch {}
  }, [videos]);

  // Save progress memory
  useEffect(() => {
    try {
      localStorage.setItem("audenic_video_progress", JSON.stringify(progressMemory));
    } catch {}
  }, [progressMemory]);

  // Save bookmarks
  useEffect(() => {
    try {
      localStorage.setItem("audenic_video_bookmarks", JSON.stringify(bookmarks));
    } catch {}
  }, [bookmarks]);

  // Group videos by folder (courses / categories)
  const folders = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => set.add(v.folder_name));
    return Array.from(set).sort();
  }, [videos]);

  const filteredVideos = useMemo(() => {
    if (selectedFolder === "all") return videos;
    return videos.filter((v) => v.folder_name === selectedFolder);
  }, [videos, selectedFolder]);

  const activeVideo = useMemo(() => {
    return videos.find((v) => v.id === activeVideoId) || filteredVideos[0] || null;
  }, [videos, activeVideoId, filteredVideos]);

  const selectVideo = useCallback((video: DesktopVideo) => {
    setActiveVideoId(video.id);
    localStorage.setItem("audenic_last_video_id", video.id);
    setIsPlaying(true);
  }, []);

  const deleteVideo = useCallback((id: string) => {
    setVideos((prev) => {
      const next = prev.filter((v) => v.id !== id);
      return next;
    });
    if (activeVideoId === id) {
      const remaining = videos.filter((v) => v.id !== id);
      if (remaining.length > 0) {
        setActiveVideoId(remaining[0].id);
        localStorage.setItem("audenic_last_video_id", remaining[0].id);
      } else {
        setActiveVideoId(null);
        localStorage.removeItem("audenic_last_video_id");
        setIsPlaying(false);
      }
    }
  }, [activeVideoId, videos]);

  const clearAllVideos = useCallback(() => {
    setVideos([]);
    setActiveVideoId(null);
    localStorage.removeItem("audenic_last_video_id");
    setIsPlaying(false);
  }, []);

  const playNext = useCallback(() => {
    if (!activeVideo) return;
    const currentIndex = filteredVideos.findIndex((v) => v.id === activeVideo.id);
    if (currentIndex !== -1 && currentIndex < filteredVideos.length - 1) {
      selectVideo(filteredVideos[currentIndex + 1]);
    }
  }, [activeVideo, filteredVideos, selectVideo]);

  const playPrev = useCallback(() => {
    if (!activeVideo) return;
    const currentIndex = filteredVideos.findIndex((v) => v.id === activeVideo.id);
    if (currentIndex > 0) {
      selectVideo(filteredVideos[currentIndex - 1]);
    }
  }, [activeVideo, filteredVideos, selectVideo]);

  const scanFolder = useCallback(async () => {
    try {
      const folder = await pickFolder();
      if (!folder) return;

      setIsScanning(true);
      const res = await scanDirectory(folder);
      if (res.videos.length > 0) {
        setVideos((prev) => {
          const map = new Map<string, DesktopVideo>();
          prev.forEach((v) => map.set(v.id, v));
          res.videos.forEach((v) => map.set(v.id, v));
          return Array.from(map.values());
        });
        if (!activeVideoId && res.videos[0]) {
          setActiveVideoId(res.videos[0].id);
        }
      }
    } catch (err) {
      console.error("Error scanning folder:", err);
    } finally {
      setIsScanning(false);
    }
  }, [activeVideoId]);

  const pickFiles = useCallback(async () => {
    try {
      const files = await pickVideoFiles();
      if (!files || files.length === 0) return;

      const newVideos: DesktopVideo[] = files.map((p) => {
        const parts = p.replace(/\\/g, "/").split("/");
        const fileName = parts.pop() || "Video";
        const folderName = parts.pop() || "Media";
        const dotIdx = fileName.lastIndexOf(".");
        const stem = dotIdx !== -1 ? fileName.substring(0, dotIdx) : fileName;
        const ext = dotIdx !== -1 ? fileName.substring(dotIdx + 1).toLowerCase() : "mp4";

        return {
          id: `local-file-${p}`,
          path: p,
          title: stem,
          folder_name: folderName,
          size: 0,
          date_added: Date.now(),
          format: ext,
        };
      });

      setVideos((prev) => {
        const map = new Map<string, DesktopVideo>();
        prev.forEach((v) => map.set(v.id, v));
        newVideos.forEach((v) => map.set(v.id, v));
        return Array.from(map.values());
      });

      if (newVideos[0]) {
        selectVideo(newVideos[0]);
      }
    } catch (err) {
      console.error("Error picking video files:", err);
    }
  }, [selectVideo]);

  const addBookmark = useCallback((note: string) => {
    if (!activeVideo || !note.trim()) return;
    setBookmarks((prev) => {
      const currentList = prev[activeVideo.id] || [];
      return {
        ...prev,
        [activeVideo.id]: [
          ...currentList,
          { time: currentTime, note: note.trim() },
        ].sort((a, b) => a.time - b.time),
      };
    });
  }, [activeVideo, currentTime]);

  const removeBookmark = useCallback((index: number) => {
    if (!activeVideo) return;
    setBookmarks((prev) => {
      const currentList = prev[activeVideo.id] || [];
      return {
        ...prev,
        [activeVideo.id]: currentList.filter((_, i) => i !== index),
      };
    });
  }, [activeVideo]);

  const [isAudioOnly, setIsAudioOnly] = useState<boolean>(() => {
    try {
      return localStorage.getItem("audenic_video_audio_only") === "true";
    } catch {
      return false;
    }
  });

  const toggleAudioOnly = useCallback(() => {
    setIsAudioOnly((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("audenic_video_audio_only", String(next));
      } catch {}
      return next;
    });
  }, []);

  const moveVideo = useCallback((id: string, direction: -1 | 1) => {
    setVideos((prev) => {
      const idx = prev.findIndex((v) => v.id === id);
      if (idx === -1) return prev;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  }, []);

  const reorderVideos = useCallback((fromIndex: number, toIndex: number) => {
    setVideos((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const value: CourseVideoContextValue = {
    videos,
    activeVideoId,
    activeVideo,
    selectedFolder,
    setSelectedFolder,
    folders,
    filteredVideos,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    selectVideo,
    playNext,
    playPrev,
    deleteVideo,
    clearAllVideos,
    scanFolder,
    pickFiles,
    isScanning,
    progressMemory,
    setProgressMemory,
    bookmarks,
    addBookmark,
    removeBookmark,
    moveVideo,
    reorderVideos,
    isAudioOnly,
    setIsAudioOnly,
    toggleAudioOnly,
  };

  return (
    <CourseVideoContext.Provider value={value}>
      {children}
    </CourseVideoContext.Provider>
  );
}

export function useCourseVideo(): CourseVideoContextValue {
  const ctx = useContext(CourseVideoContext);
  if (!ctx) {
    throw new Error("useCourseVideo must be used within a CourseVideoProvider");
  }
  return ctx;
}
