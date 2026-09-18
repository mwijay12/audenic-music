use id3::TagLike;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopTrack {
    pub id: String,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: u32,
    pub size: u64,
    pub date_added: u64,
    pub format: String,
    pub cover_art: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopVideo {
    pub id: String,
    pub path: String,
    pub title: String,
    pub folder_name: String,
    pub size: u64,
    pub date_added: u64,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannedLibrary {
    pub tracks: Vec<DesktopTrack>,
    pub videos: Vec<DesktopVideo>,
    pub scanned_folder: String,
}

#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Select Media Folder")
        .pick_folder()
        .await;

    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn pick_video_files() -> Result<Vec<String>, String> {
    let files = rfd::AsyncFileDialog::new()
        .set_title("Select Video Files")
        .add_filter("Videos", &["mp4", "mkv", "webm", "avi", "mov", "m4v"])
        .pick_files()
        .await;

    let result = files
        .into_iter()
        .flatten()
        .map(|f| f.path().to_string_lossy().to_string())
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn pick_audio_files() -> Result<Vec<String>, String> {
    let files = rfd::AsyncFileDialog::new()
        .set_title("Select Audio Files")
        .add_filter("Audio", &["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus"])
        .pick_files()
        .await;

    let result = files
        .into_iter()
        .flatten()
        .map(|f| f.path().to_string_lossy().to_string())
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn scan_directory(folder_path: String) -> Result<ScannedLibrary, String> {
    let root = Path::new(&folder_path);
    if !root.exists() {
        return Err("Directory does not exist".to_string());
    }

    let audio_exts = ["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus"];
    let video_exts = ["mp4", "mkv", "webm", "avi", "mov", "m4v"];

    let mut tracks = Vec::new();
    let mut videos = Vec::new();

    for entry in WalkDir::new(root)
        .follow_links(true)
        .max_depth(8)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let size = metadata.len();
        let date_added = metadata
            .modified()
            .unwrap_or_else(|_| std::time::SystemTime::now())
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let file_stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string();

        let full_path_str = path.to_string_lossy().to_string();
        let parent_name = path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|s| s.to_str())
            .unwrap_or("Media")
            .to_string();

        if audio_exts.contains(&ext.as_str()) {
            let mut title = file_stem.clone();
            let mut artist = "Unknown Artist".to_string();
            let mut album = parent_name.clone();
            let mut duration = 0u32;
            let mut cover_art: Option<String> = None;

            let parent_dir = path.parent().unwrap_or_else(|| Path::new(""));

            // 1. Look for companion image files in the same folder
            let candidate_names = [
                format!("{}.jpg", file_stem),
                format!("{}.jpeg", file_stem),
                format!("{}.png", file_stem),
                format!("{}.webp", file_stem),
                "cover.jpg".to_string(),
                "cover.jpeg".to_string(),
                "cover.png".to_string(),
                "cover.webp".to_string(),
                "folder.jpg".to_string(),
                "folder.jpeg".to_string(),
                "folder.png".to_string(),
                "albumart.jpg".to_string(),
                "albumart.png".to_string(),
                "front.jpg".to_string(),
                "front.jpeg".to_string(),
            ];

            for name in &candidate_names {
                let cand = parent_dir.join(name);
                if cand.is_file() {
                    cover_art = Some(cand.to_string_lossy().to_string());
                    break;
                }
            }

            // 2. Try reading ID3 tags if mp3
            if ext == "mp3" {
                if let Ok(tag) = id3::Tag::read_from_path(path) {
                    if let Some(t) = tag.title() {
                        if !t.trim().is_empty() {
                            title = t.to_string();
                        }
                    }
                    if let Some(a) = tag.artist() {
                        if !a.trim().is_empty() {
                            artist = a.to_string();
                        }
                    }
                    if let Some(al) = tag.album() {
                        if !al.trim().is_empty() {
                            album = al.to_string();
                        }
                    }
                    if let Some(d) = tag.duration() {
                        duration = d;
                    }

                    // Extract embedded picture if companion image was not found
                    if cover_art.is_none() {
                        if let Some(pic) = tag.pictures().next() {
                            let home = std::env::var("USERPROFILE")
                                .unwrap_or_else(|_| "C:\\Users\\Default".to_string());
                            let covers_dir = Path::new(&home).join("Music").join("Audenic").join(".covers");
                            let _ = std::fs::create_dir_all(&covers_dir);
                            let ext_name = match pic.mime_type.to_lowercase().as_str() {
                                "image/png" => "png",
                                "image/webp" => "webp",
                                _ => "jpg",
                            };
                            let cache_file = covers_dir.join(format!("{:x}.{}", md5_hash(&full_path_str), ext_name));
                            if !cache_file.exists() {
                                let _ = std::fs::write(&cache_file, &pic.data);
                            }
                            if cache_file.exists() {
                                cover_art = Some(cache_file.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }

            tracks.push(DesktopTrack {
                id: format!("local-audio-{:x}", md5_hash(&full_path_str)),
                path: full_path_str,
                title,
                artist,
                album,
                duration,
                size,
                date_added,
                format: ext,
                cover_art,
            });
        } else if video_exts.contains(&ext.as_str()) {
            videos.push(DesktopVideo {
                id: format!("local-video-{:x}", md5_hash(&full_path_str)),
                path: full_path_str,
                title: file_stem,
                folder_name: parent_name,
                size,
                date_added,
                format: ext,
            });
        }
    }

    Ok(ScannedLibrary {
        tracks,
        videos,
        scanned_folder: folder_path,
    })
}

#[tauri::command]
pub async fn open_in_explorer(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("Path does not exist".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let arg = if p.is_file() {
            format!("/select,\"{}\"", path)
        } else {
            path
        };
        std::process::Command::new("explorer")
            .arg(arg)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn md5_hash(s: &str) -> u64 {
    // Fast lightweight FNV-1a 64-bit hash
    let mut hash = 0xcbf29ce484222325u64;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
