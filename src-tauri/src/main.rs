// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(windows)]
    unsafe {
        use std::os::windows::ffi::OsStrExt;
        let app_id: Vec<u16> = std::ffi::OsStr::new("fm.audenic.desktop")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        extern "system" {
            fn SetCurrentProcessExplicitAppUserModelID(AppID: *const u16) -> i32;
        }
        let _ = SetCurrentProcessExplicitAppUserModelID(app_id.as_ptr());
    }

    #[cfg(windows)]
    {
        if let Ok(exe_path) = std::env::current_exe() {
            let exe_str = exe_path.to_string_lossy().to_string();
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            let _ = std::process::Command::new("reg")
                .args(&[
                    "add",
                    r"HKCU\Software\Classes\AppUserModelId\fm.audenic.desktop",
                    "/v",
                    "DisplayName",
                    "/d",
                    "Audenic Studio",
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();

            let _ = std::process::Command::new("reg")
                .args(&[
                    "add",
                    r"HKCU\Software\Classes\AppUserModelId\fm.audenic.desktop",
                    "/v",
                    "IconUri",
                    "/d",
                    &exe_str,
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }
    }

    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--enable-features=HardwareMediaKeyHandling,MediaSessionService"
    );

    app_lib::run();
}
