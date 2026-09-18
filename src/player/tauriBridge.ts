/**
 * Audenic Desktop Studio Tauri 2.0 Native Bridge.
 * Connects React UI cleanly to Rust backend commands, streaming file assets,
 * YouTube downloader subprocesses, and native frameless window controls.
 */

export interface DesktopTrack {
  id: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  size: number;
  date_added: number;
  format: string;
  cover_art?: string;
}

export interface DesktopVideo {
  id: string;
  path: string;
  title: string;
  folder_name: string;
  size: number;
  date_added: number;
  format: string;
}

export interface ScannedLibrary {
  tracks: DesktopTrack[];
  videos: DesktopVideo[];
  scanned_folder: string;
}

export interface DownloadRequest {
  url: string;
  format: "audio" | "video";
  quality?: string;
  output_folder?: string;
}

export interface DownloadProgressPayload {
  url: string;
  percent: number;
  speed: string;
  eta: string;
  status: string;
  filename?: string;
}

export interface DownloadCompletePayload {
  url: string;
  success: boolean;
  file_path?: string;
  title?: string;
  media_type: "audio" | "video";
  thumbnail_path?: string;
  lyrics_path?: string;
  error?: string;
}

export const isDesktop = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    "__TAURI_INTERNALS__" in window ||
    "__TAURI__" in window
  );
};

export async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window !== "undefined") {
    const w = window as any;
    if (w.__TAURI__?.core?.invoke) {
      return w.__TAURI__.core.invoke(cmd, args);
    }
    if (w.__TAURI_INTERNALS__?.invoke) {
      return w.__TAURI_INTERNALS__.invoke(cmd, args);
    }
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export function toAssetUrl(filePath: string): string {
  if (!filePath) return "";
  if (
    filePath.startsWith("http://") ||
    filePath.startsWith("https://") ||
    filePath.startsWith("blob:") ||
    filePath.startsWith("data:")
  ) {
    return filePath;
  }

  if (typeof window !== "undefined") {
    const w = window as any;
    if (w.__TAURI__?.core?.convertFileSrc) {
      return w.__TAURI__.core.convertFileSrc(filePath);
    }
  }

  // Fallback Tauri 2 Windows asset URL
  const normalized = filePath.replace(/\\/g, "/");
  return `http://asset.localhost/${encodeURI(normalized)}`;
}

export async function listenTauri<T>(
  event: string,
  handler: (payload: T) => void
): Promise<() => void> {
  if (!isDesktop()) return () => {};
  try {
    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen<T>(event, (e) => handler(e.payload));
    return unlisten;
  } catch (err) {
    console.warn(`[tauriBridge] Failed to register listener for ${event}:`, err);
    return () => {};
  }
}

// Window Management
export async function minimizeWindow(): Promise<void> {
  if (!isDesktop()) return;
  await invokeTauri("window_minimize");
}

export async function toggleMaximizeWindow(): Promise<boolean> {
  if (!isDesktop()) return false;
  return await invokeTauri<boolean>("window_toggle_maximize");
}

export async function closeWindow(): Promise<void> {
  if (!isDesktop()) return;
  await invokeTauri("window_close");
}

export async function isWindowMaximized(): Promise<boolean> {
  if (!isDesktop()) return false;
  return await invokeTauri<boolean>("window_is_maximized");
}

// File and Folder Dialogs
export async function pickFolder(): Promise<string | null> {
  if (!isDesktop()) return null;
  return await invokeTauri<string | null>("pick_folder");
}

export async function pickVideoFiles(): Promise<string[]> {
  if (!isDesktop()) return [];
  return await invokeTauri<string[]>("pick_video_files");
}

export async function pickAudioFiles(): Promise<string[]> {
  if (!isDesktop()) return [];
  return await invokeTauri<string[]>("pick_audio_files");
}

// Media Scanner
export async function scanDirectory(folderPath: string): Promise<ScannedLibrary> {
  if (!isDesktop()) {
    return { tracks: [], videos: [], scanned_folder: folderPath };
  }
  return await invokeTauri<ScannedLibrary>("scan_directory", { folderPath });
}

export async function openInExplorer(path: string): Promise<void> {
  if (!isDesktop()) return;
  await invokeTauri("open_in_explorer", { path });
}

// YouTube Downloader
export async function getDefaultDownloadDirs(): Promise<[string, string]> {
  if (!isDesktop()) return ["", ""];
  return await invokeTauri<[string, string]>("get_default_download_dirs");
}

export async function downloadYouTubeMedia(
  request: DownloadRequest
): Promise<DownloadCompletePayload> {
  if (!isDesktop()) {
    throw new Error("Desktop engine required for YouTube downloader");
  }
  return await invokeTauri<DownloadCompletePayload>("download_youtube_media", { request });
}

export async function convertVideoToAudio(
  inputPath: string,
  outputFolder?: string,
  quality?: string
): Promise<string> {
  if (!isDesktop()) {
    throw new Error("Desktop engine required for media conversion");
  }
  return await invokeTauri<string>("convert_video_to_audio", {
    inputPath,
    outputFolder: outputFolder || null,
    quality: quality || null,
  });
}

// Desktop HUD Music Widget Functions
export async function toggleDesktopWidget(show?: boolean): Promise<boolean> {
  if (!isDesktop()) return false;
  return await invokeTauri<boolean>("toggle_desktop_widget", { show: show ?? null });
}

export async function getDesktopWidgetState(): Promise<boolean> {
  if (!isDesktop()) return false;
  return await invokeTauri<boolean>("get_desktop_widget_state");
}

export async function setWidgetAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
  if (!isDesktop()) return;
  await invokeTauri("set_widget_always_on_top", { alwaysOnTop });
}

export async function setWidgetSize(width: number, height: number): Promise<void> {
  if (!isDesktop()) return;
  await invokeTauri("set_widget_size", { width, height });
}

export async function showMainWindow(): Promise<void> {
  if (!isDesktop()) return;
  await invokeTauri("show_main_window");
}

export async function closeDesktopWidget(): Promise<void> {
  if (!isDesktop()) return;
  await invokeTauri("close_desktop_widget");
}

