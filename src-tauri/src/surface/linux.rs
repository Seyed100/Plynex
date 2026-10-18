use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use std::{
    ptr,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Mutex,
    },
};
use x11_dl::xlib;

#[derive(Default)]
pub struct Surface {
    main: AtomicUsize,
    display: AtomicUsize,
    pub host: AtomicUsize,
    bounds: Mutex<(i32, i32, i32, i32, bool)>,
}

impl Surface {
    pub unsafe fn create(&self, window: &tauri::WebviewWindow) -> Result<(), String> {
        let main = match window.window_handle().map_err(|e| e.to_string())?.as_raw() {
            RawWindowHandle::Xlib(h) => h.window,
            RawWindowHandle::Xcb(h) => h.window.get() as _,
            _ => {
                return Err(
                    "Native playback requires X11 or XWayland. Launch with GDK_BACKEND=x11.".into(),
                )
            }
        };
        let x = xlib::Xlib::open().map_err(|e| e.to_string())?;
        let display = (x.XOpenDisplay)(ptr::null());
        if display.is_null() {
            return Err("Cannot connect to the X11 display.".into());
        }
        let root = (x.XDefaultRootWindow)(display);
        let host = (x.XCreateSimpleWindow)(display, root, 0, 0, 1, 1, 0, 0, 0);
        let mut attributes: xlib::XSetWindowAttributes = std::mem::zeroed();
        attributes.override_redirect = 1;
        (x.XChangeWindowAttributes)(display, host, xlib::CWOverrideRedirect, &mut attributes);
        (x.XFlush)(display);
        self.main.store(main as usize, Ordering::Relaxed);
        self.display.store(display as usize, Ordering::Relaxed);
        self.host.store(host as usize, Ordering::Relaxed);
        Ok(())
    }

    pub fn bounds(&self, x: i32, y: i32, width: i32, height: i32, visible: bool) {
        if let Ok(mut b) = self.bounds.lock() {
            *b = (x, y, width, height, visible);
        }
        self.sync();
    }

    pub fn sync(&self) {
        let Ok(b) = self.bounds.lock() else {
            return;
        };
        let (left, top, width, height, visible) = *b;
        let Ok(x) = xlib::Xlib::open() else {
            return;
        };
        unsafe {
            let display = self.display.load(Ordering::Relaxed) as *mut xlib::Display;
            let main = self.main.load(Ordering::Relaxed) as xlib::Window;
            let host = self.host.load(Ordering::Relaxed) as xlib::Window;
            if display.is_null() || main == 0 || host == 0 {
                return;
            }
            let mut a: xlib::XWindowAttributes = std::mem::zeroed();
            (x.XGetWindowAttributes)(display, main, &mut a);
            if !visible || a.map_state != xlib::IsViewable {
                (x.XUnmapWindow)(display, host);
                (x.XFlush)(display);
                return;
            }
            let root = (x.XDefaultRootWindow)(display);
            let (mut screen_x, mut screen_y, mut child) = (0, 0, 0);
            (x.XTranslateCoordinates)(
                display,
                main,
                root,
                left,
                top,
                &mut screen_x,
                &mut screen_y,
                &mut child,
            );
            let mut frame = main;
            loop {
                let (mut query_root, mut parent, mut children, mut count) =
                    (0, 0, ptr::null_mut(), 0);
                if (x.XQueryTree)(
                    display,
                    frame,
                    &mut query_root,
                    &mut parent,
                    &mut children,
                    &mut count,
                ) == 0
                {
                    break;
                }
                if !children.is_null() {
                    (x.XFree)(children as _);
                }
                if parent == root || parent == 0 {
                    break;
                }
                frame = parent;
            }
            (x.XMoveResizeWindow)(
                display,
                host,
                screen_x,
                screen_y,
                width.max(1) as _,
                height.max(1) as _,
            );
            (x.XMapWindow)(display, host);
            let mut changes: xlib::XWindowChanges = std::mem::zeroed();
            changes.sibling = frame;
            changes.stack_mode = xlib::Below;
            (x.XConfigureWindow)(
                display,
                host,
                (xlib::CWSibling | xlib::CWStackMode) as _,
                &mut changes,
            );
            (x.XFlush)(display);
        }
    }

    pub fn destroy(&self) {
        let host = self.host.swap(0, Ordering::Relaxed);
        let display = self.display.swap(0, Ordering::Relaxed) as *mut xlib::Display;
        if let Ok(x) = xlib::Xlib::open() {
            unsafe {
                if !display.is_null() {
                    if host != 0 {
                        (x.XDestroyWindow)(display, host as _);
                    }
                    (x.XCloseDisplay)(display);
                }
            }
        }
    }
}
