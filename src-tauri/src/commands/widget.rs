use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, LogicalSize};

/**
 * Commands for managing the Desktop HUD Music Widget
 * - Frameless (decorations: false)
 * - Translucent / Transparent (transparent: true)
 * - Stays on top of other windows (always_on_top: true)
 * - Hidden from taskbar (skip_taskbar: true)
 * - Draggable anywhere across all screens via native startDragging
 */

#[tauri::command]
pub fn toggle_desktop_widget(app: AppHandle, show: Option<bool>) -> Result<bool, String> {
    if let Some(widget_win) = app.get_webview_window("widget") {
        let is_visible = widget_win.is_visible().unwrap_or(false);
        let should_show = show.unwrap_or(!is_visible);

        if should_show {
            widget_win.show().map_err(|e| e.to_string())?;
            let _ = widget_win.unminimize();
            let _ = widget_win.set_focus();
        } else {
            widget_win.hide().map_err(|e| e.to_string())?;
        }

        Ok(should_show)
    } else {
        let win = WebviewWindowBuilder::new(
            &app,
            "widget",
            WebviewUrl::App("index.html#/widget".into()),
        )
        .title("Audenic Music Widget")
        .inner_size(380.0, 165.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .build()
        .map_err(|e| e.to_string())?;

        win.show().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub fn get_desktop_widget_state(app: AppHandle) -> Result<bool, String> {
    if let Some(widget_win) = app.get_webview_window("widget") {
        Ok(widget_win.is_visible().unwrap_or(false))
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn set_widget_always_on_top(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(widget_win) = app.get_webview_window("widget") {
        widget_win.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_widget_size(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(widget_win) = app.get_webview_window("widget") {
        widget_win.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.show();
        let _ = main_win.unminimize();
        let _ = main_win.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub fn close_desktop_widget(app: AppHandle) -> Result<(), String> {
    if let Some(widget_win) = app.get_webview_window("widget") {
        widget_win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}
