mod commands;

use commands::downloader::{
    convert_video_to_audio, download_youtube_media, get_default_download_dirs,
};
use commands::scanner::{
    open_in_explorer, pick_audio_files, pick_folder, pick_video_files, scan_directory,
};
use commands::window::{
    window_close, window_is_maximized, window_minimize, window_toggle_maximize,
};
use commands::widget::{
    close_desktop_widget, get_desktop_widget_state, set_widget_always_on_top, set_widget_size,
    show_main_window, toggle_desktop_widget,
};

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                if let Some(icon) = app.default_window_icon() {
                    let _ = window.set_icon(icon.clone());
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_is_maximized,
            pick_folder,
            pick_video_files,
            pick_audio_files,
            scan_directory,
            open_in_explorer,
            get_default_download_dirs,
            download_youtube_media,
            convert_video_to_audio,
            toggle_desktop_widget,
            get_desktop_widget_state,
            set_widget_always_on_top,
            set_widget_size,
            show_main_window,
            close_desktop_widget
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {});
}
