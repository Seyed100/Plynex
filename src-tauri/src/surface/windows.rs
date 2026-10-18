use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Mutex,
};
use windows_sys::Win32::{
    Foundation::{HWND, POINT},
    Graphics::Gdi::ClientToScreen,
    UI::WindowsAndMessaging::*,
};

#[derive(Default)]
pub struct Surface {
    main: AtomicUsize,
    pub host: AtomicUsize,
    bounds: Mutex<(i32, i32, i32, i32, bool)>,
}

impl Surface {
    pub unsafe fn create(&self, window: &tauri::WebviewWindow) -> Result<(), String> {
        let main = window.hwnd().map_err(|e| e.to_string())?.0 as HWND;
        let class: Vec<u16> = "STATIC\0".encode_utf16().collect();
        // A separate opaque render surface is required on Windows. A native child
        // behind a layered WebView2 window is not included in DWM composition.
        let host = CreateWindowExW(
            WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
            class.as_ptr(),
            std::ptr::null(),
            WS_POPUP | WS_DISABLED | WS_CLIPCHILDREN,
            0,
            0,
            1,
            1,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null(),
        );
        if host.is_null() {
            return Err("Could not create the native video surface".into());
        }
        self.main.store(main as usize, Ordering::Relaxed);
        self.host.store(host as usize, Ordering::Relaxed);
        Ok(())
    }

    pub fn bounds(&self, x: i32, y: i32, width: i32, height: i32, visible: bool) {
        if let Ok(mut bounds) = self.bounds.lock() {
            *bounds = (x, y, width, height, visible);
        }
        self.sync();
    }

    pub fn sync(&self) {
        let Ok(bounds) = self.bounds.lock() else {
            return;
        };
        let (x, y, width, height, visible) = *bounds;
        unsafe {
            let main = self.main.load(Ordering::Relaxed) as HWND;
            let host = self.host.load(Ordering::Relaxed) as HWND;
            if main.is_null() || host.is_null() {
                return;
            }
            if !visible || IsIconic(main) != 0 || IsWindowVisible(main) == 0 {
                ShowWindow(host, SW_HIDE);
                return;
            }
            let mut origin = POINT { x, y };
            ClientToScreen(main, &mut origin);
            let topmost = GetWindowLongPtrW(main, GWL_EXSTYLE) & WS_EX_TOPMOST as isize != 0;
            SetWindowPos(
                host,
                if topmost {
                    HWND_TOPMOST
                } else {
                    HWND_NOTOPMOST
                },
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );
            SetWindowPos(
                host,
                main,
                origin.x,
                origin.y,
                width.max(1),
                height.max(1),
                SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
        }
    }

    pub fn destroy(&self) {
        let host = self.host.swap(0, Ordering::Relaxed) as HWND;
        if !host.is_null() {
            unsafe {
                DestroyWindow(host);
            }
        }
    }
}
