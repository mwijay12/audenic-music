use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadRequest {
    pub url: String,
    pub format: String, // "audio" or "video"
    pub quality: Option<String>, // "320k", "192k", "128k" for audio; "1080p", "720p", "480p" for video
    pub output_folder: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub url: String,
    pub percent: f32,
    pub speed: String,
    pub eta: String,
    pub status: String,
    pub filename: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadCompletePayload {
    pub url: String,
    pub success: bool,
    pub file_path: Option<String>,
    pub title: Option<String>,
    pub media_type: String,
    pub thumbnail_path: Option<String>,
    pub lyrics_path: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn get_default_download_dirs() -> (String, String) {
    let home = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    let music_dir = Path::new(&home).join("Music").join("Audenic");
    let video_dir = Path::new(&home).join("Videos").join("Audenic");

    let _ = std::fs::create_dir_all(&music_dir);
    let _ = std::fs::create_dir_all(&video_dir);

    (
        music_dir.to_string_lossy().to_string(),
        video_dir.to_string_lossy().to_string(),
    )
}

#[tauri::command]
pub async fn download_youtube_media(
    app: AppHandle,
    request: DownloadRequest,
) -> Result<DownloadCompletePayload, String> {
    let url = request.url.trim().to_string();
    if url.is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    let is_audio = request.format.to_lowercase() != "video";
    let (default_music, default_video) = get_default_download_dirs();
    let target_folder = request.output_folder.unwrap_or_else(|| {
        if is_audio {
            default_music
        } else {
            default_video
        }
    });

    let target_path = PathBuf::from(&target_folder);
    let _ = std::fs::create_dir_all(&target_path);

    let output_template = target_path
        .join("%(title)s.%(ext)s")
        .to_string_lossy()
        .to_string();

    let mut cmd = Command::new("yt-dlp");
    cmd.arg("--newline")
        .arg("--no-playlist")
        .arg("--no-warnings")
        .arg("--ignore-errors")
        .arg("--no-abort-on-error")
        .arg("-o")
        .arg(&output_template);

    let quality_str = request
        .quality
        .as_deref()
        .unwrap_or(if is_audio { "320k" } else { "1080p" });

    if is_audio {
        let audio_q = match quality_str.to_lowercase().as_str() {
            "128k" => "128K",
            "192k" => "192K",
            _ => "320K",
        };
        cmd.arg("-x")
            .arg("--audio-format")
            .arg("mp3")
            .arg("--audio-quality")
            .arg(audio_q)
            .arg("--embed-metadata")
            .arg("--embed-thumbnail")
            .arg("--write-thumbnail")
            .arg("--convert-thumbnails")
            .arg("jpg");
    } else {
        let video_fmt = match quality_str.to_lowercase().as_str() {
            "720p" => "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]",
            "480p" => "bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4]/bv*[height<=480]+ba/b[height<=480]",
            _ => "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv*[height<=1080]+ba/b[height<=1080]",
        };
        cmd.arg("-f")
            .arg(video_fmt)
            .arg("--merge-output-format")
            .arg("mp4");
    }

    cmd.arg(&url);

    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}. Make sure yt-dlp is installed.", e))?;

    let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

    let url_clone = url.clone();
    let app_clone = app.clone();

    // Spawn async task to read stdout and emit progress
    let percent_re = Regex::new(r"(\d+(?:\.\d+)?)%").unwrap();
    let speed_re = Regex::new(r"at\s+([~0-9\.]+[kKMGT]?i?B/s)").unwrap();
    let eta_re = Regex::new(r"ETA\s+(\d+:\d+(?::\d+)?)").unwrap();
    let dest_re = Regex::new(r#"Destination:\s*(.+)$"#).unwrap();
    let merged_re = Regex::new(r#"Merging formats into\s*"?(.+?)"?$"#).unwrap();

    let mut last_detected_file: Option<String> = None;

    let mut reader = BufReader::new(stdout).lines();
    while let Ok(Some(line)) = reader.next_line().await {
        let trimmed = line.trim();

        if let Some(caps) = dest_re.captures(trimmed) {
            last_detected_file = Some(caps[1].trim().trim_matches('"').to_string());
        }
        if let Some(caps) = merged_re.captures(trimmed) {
            last_detected_file = Some(caps[1].trim().trim_matches('"').to_string());
        }

        if trimmed.starts_with("[download]") {
            let percent: f32 = percent_re
                .captures(trimmed)
                .and_then(|c| c[1].parse().ok())
                .unwrap_or(0.0);

            let speed = speed_re
                .captures(trimmed)
                .map(|c| c[1].to_string())
                .unwrap_or_else(|| "--".to_string());

            let eta = eta_re
                .captures(trimmed)
                .map(|c| c[1].to_string())
                .unwrap_or_else(|| "--".to_string());

            let _ = app_clone.emit(
                "yt-download-progress",
                DownloadProgressPayload {
                    url: url_clone.clone(),
                    percent,
                    speed,
                    eta,
                    status: "Downloading...".to_string(),
                    filename: last_detected_file.clone(),
                },
            );
        } else if trimmed.starts_with("[ExtractAudio]") || trimmed.starts_with("[Merger]") {
            let _ = app_clone.emit(
                "yt-download-progress",
                DownloadProgressPayload {
                    url: url_clone.clone(),
                    percent: 99.0,
                    speed: "Processing".to_string(),
                    eta: "00:01".to_string(),
                    status: "Processing audio/video...".to_string(),
                    filename: last_detected_file.clone(),
                },
            );
        }
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;

    if status.success() {
        let (thumbnail_path, lyrics_path) = if let Some(ref fp) = last_detected_file {
            let p = Path::new(fp);
            let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            let parent = p.parent().unwrap_or_else(|| Path::new(""));

            let thumb = [
                parent.join(format!("{}.jpg", stem)),
                parent.join(format!("{}.jpeg", stem)),
                parent.join(format!("{}.webp", stem)),
                parent.join(format!("{}.png", stem)),
            ]
            .into_iter()
            .find(|cand| cand.exists())
            .map(|cand| cand.to_string_lossy().to_string());

            let lyr = [
                parent.join(format!("{}.lrc", stem)),
                parent.join(format!("{}.en.lrc", stem)),
                parent.join(format!("{}.en.vtt", stem)),
                parent.join(format!("{}.en.srt", stem)),
                parent.join(format!("{}.vtt", stem)),
            ]
            .into_iter()
            .find(|cand| cand.exists())
            .map(|cand| cand.to_string_lossy().to_string());

            (thumb, lyr)
        } else {
            (None, None)
        };

        let result = DownloadCompletePayload {
            url: url.clone(),
            success: true,
            file_path: last_detected_file.clone(),
            title: last_detected_file.as_ref().and_then(|p| {
                Path::new(p)
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
            }),
            media_type: if is_audio {
                "audio".to_string()
            } else {
                "video".to_string()
            },
            thumbnail_path,
            lyrics_path,
            error: None,
        };

        let _ = app.emit("yt-download-complete", result.clone());
        Ok(result)
    } else {
        let mut err_reader = BufReader::new(stderr).lines();
        let mut err_msg = String::new();
        while let Ok(Some(line)) = err_reader.next_line().await {
            err_msg.push_str(&line);
            err_msg.push('\n');
        }

        let result = DownloadCompletePayload {
            url: url.clone(),
            success: false,
            file_path: None,
            title: None,
            media_type: if is_audio {
                "audio".to_string()
            } else {
                "video".to_string()
            },
            thumbnail_path: None,
            lyrics_path: None,
            error: Some(if err_msg.is_empty() {
                "Download process failed".to_string()
            } else {
                err_msg
            }),
        };

        let _ = app.emit("yt-download-complete", result.clone());
        Err(result.error.unwrap())
    }
}

#[tauri::command]
pub async fn convert_video_to_audio(
    _app: AppHandle,
    input_path: String,
    output_folder: Option<String>,
    quality: Option<String>,
) -> Result<String, String> {
    let in_path = PathBuf::from(&input_path);
    if !in_path.exists() {
        return Err(format!("Input file does not exist: {}", input_path));
    }

    let (default_music, _) = get_default_download_dirs();
    let target_dir = output_folder
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(&default_music));

    let _ = std::fs::create_dir_all(&target_dir);

    let stem = in_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("converted_audio");

    let out_path = target_dir.join(format!("{}.mp3", stem));
    let out_path_str = out_path.to_string_lossy().to_string();

    let bitrate = match quality.as_deref().unwrap_or("320k") {
        "128k" => "128k",
        "192k" => "192k",
        _ => "320k",
    };

    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y")
        .arg("-i")
        .arg(&input_path)
        .arg("-vn")
        .arg("-c:a")
        .arg("libmp3lame")
        .arg("-b:a")
        .arg(bitrate)
        .arg(&out_path_str);

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}. Ensure ffmpeg is installed.", e))?;

    if output.status.success() {
        Ok(out_path_str)
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(format!("Conversion failed: {}", err))
    }
}
