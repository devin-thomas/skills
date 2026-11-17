//! Window, message handling and the paced render loop.

use std::ffi::c_void;
use std::ptr::{null, null_mut};

use crate::canvas::{Canvas, Stats, Theme};
use crate::display::{self, Placed};
use crate::gpu::{Frame, Gpu};
use crate::sys::*;
use crate::text::TextSys;

/// What an app implements. All coordinates are DIPs.
pub trait App: 'static {
    /// Called once after the window and GPU exist, before the first `Resize`.
    fn init(&mut self, _cx: &mut Ctx) {}
    /// Handle one input/window event; call `cx.redraw()` if anything visible changed.
    fn event(&mut self, e: &Event, cx: &mut Ctx);
    /// Advance animations by `dt` seconds; return true while still animating.
    fn update(&mut self, _dt: f32) -> bool { false }
    /// Draw the whole frame (flip-discard: every frame starts undefined).
    fn draw(&mut self, c: &mut Canvas);
    /// Bench only: drive synthetic state for bench frame `frame` (called before update/draw).
    fn bench_step(&mut self, _frame: usize, _cx: &mut Ctx) {}
    /// The user asked to close; return false to keep the window open.
    fn close(&mut self, _cx: &mut Ctx) -> bool { true }
}

/// Mouse button.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Button {
    /// Left button.
    Left,
    /// Right button.
    Right,
    /// Middle button / wheel click.
    Middle,
}

/// Modifier keys held during a key event.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct Mods {
    /// Ctrl held.
    pub ctrl: bool,
    /// Shift held.
    pub shift: bool,
    /// Alt held.
    pub alt: bool,
}

/// Input and window events (positions in DIPs, client-relative; field meanings are in each variant's doc).
#[derive(Clone, Copy, PartialEq, Debug)]
#[allow(missing_docs)]
pub enum Event {
    /// Mouse moved.
    MouseMove { x: f32, y: f32 },
    /// Button pressed (the window captures the mouse until release).
    MouseDown { x: f32, y: f32, button: Button },
    /// Button released.
    MouseUp { x: f32, y: f32, button: Button },
    /// Wheel turned by `delta` notches (positive = away from the user / scroll up).
    Wheel { x: f32, y: f32, delta: f32 },
    /// Mouse left the client area.
    MouseLeave,
    /// Key pressed or auto-repeated; `key` is a virtual-key code (see `fastwin::key`).
    Key { key: u32, mods: Mods },
    /// Key released.
    KeyUp { key: u32, mods: Mods },
    /// A printable character was typed.
    Char(char),
    /// Window gained (true) or lost (false) keyboard focus.
    Focus(bool),
    /// Client area is now `w` x `h` DIPs (also sent after a DPI change).
    Resize { w: f32, h: f32 },
}

/// Answer from `Ctx::ask`.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Answer {
    /// Yes.
    Yes,
    /// No.
    No,
    /// Cancel or closed.
    Cancel,
}

/// Window settings for `run`.
#[derive(Clone, Debug)]
pub struct Config {
    /// Window title.
    pub title: String,
    /// Initial client size in DIPs (clamped to 92% of the screen).
    pub size: (f32, f32),
    /// Minimum window size in DIPs.
    pub min_size: (f32, f32),
    /// Palette handed to `Canvas::theme`.
    pub theme: Theme,
    /// Ask DWM for a dark title bar.
    pub dark: bool,
    /// Start maximized (also enabled by the `--max` flag).
    pub maximized: bool,
}

impl Default for Config {
    fn default() -> Config {
        Config { title: "fastwin".into(), size: (960.0, 640.0), min_size: (320.0, 240.0), theme: Theme::default(), dark: true, maximized: false }
    }
}

/// Handle to the window and loop, passed to app callbacks.
pub struct Ctx {
    pub(crate) hwnd: HWND,
    pub(crate) w: f32,
    pub(crate) h: f32,
    pub(crate) scale: f32,
    pub(crate) dirty: bool,
    pub(crate) bench: bool,
    pub(crate) title: String,
    pub(crate) no_focus: bool,
    pub(crate) placed: Option<Placed>,
}

impl Ctx {
    /// Ask for a frame to be drawn and presented.
    pub fn redraw(&mut self) { self.dirty = true; }
    /// Client size in DIPs.
    pub fn size(&self) -> (f32, f32) { (self.w, self.h) }
    /// Device pixels per DIP.
    pub fn scale(&self) -> f32 { self.scale }
    /// True when running under `--bench`.
    pub fn bench(&self) -> bool { self.bench }
    /// True in no-focus test mode (`--bench`, `--no-focus`): the window never activates and dialogs are skipped.
    pub fn no_focus(&self) -> bool { self.no_focus }
    /// The display the window was placed on, when one was chosen (`--display`, no-focus mode).
    pub fn display(&self) -> Option<&Placed> { self.placed.as_ref() }
    /// Set the window title.
    pub fn set_title(&mut self, t: &str) {
        if t == self.title { return; }
        self.title = t.to_string();
        unsafe { SetWindowTextW(self.hwnd, wz(t).as_ptr()); }
    }
    /// Close the window (skips `App::close`).
    pub fn quit(&mut self) { unsafe { DestroyWindow(self.hwnd); } }
    /// Modal Yes/No/Cancel question box titled with the window title. In no-focus mode no box is shown and the answer is No.
    pub fn ask(&mut self, text: &str) -> Answer {
        if self.no_focus { log(&format!("ask skipped (no-focus mode), answered No: {text}")); return Answer::No; }
        let r = unsafe { MessageBoxW(self.hwnd, wz(text).as_ptr(), wz(&self.title).as_ptr(), 0x3 | 0x20 | 0x10000) };
        match r { 6 => Answer::Yes, 7 => Answer::No, _ => Answer::Cancel }
    }
    /// Modal message box with an OK button (logged to fastwin.log instead in no-focus mode).
    pub fn alert(&mut self, text: &str) {
        if self.no_focus { log(text); return; }
        unsafe { MessageBoxW(self.hwnd, wz(text).as_ptr(), wz(&self.title).as_ptr(), 0x40 | 0x10000); }
    }
}

/// Append a line to fastwin.log next to the exe (and to stderr when there is a console).
pub(crate) fn log(s: &str) {
    use std::io::Write;
    eprintln!("fastwin: {s}");
    let path = crate::file::exe_dir().join("fastwin.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{} {s}", crate::file::utc_iso());
    }
}

pub(crate) struct Host<A: App> {
    pub app: A,
    pub cx: Ctx,
    pub gpu: Option<Gpu>,
    pub text: TextSys,
    pub theme: Theme,
    pub stats: Stats,
    min: (f32, f32),
    ready: bool,
    /// Set while an app callback runs, so re-entrant messages (modal dialogs) don't alias the app.
    busy: bool,
    tracking: bool,
    surrogate: u16,
    pub pw: i32,
    pub ph: i32,
    /// Window moved or displays changed: re-check vblank pacing before the next frame.
    pace_dirty: bool,
}

static mut HOST: *mut c_void = null_mut();

fn mods() -> Mods {
    let down = |k: i32| unsafe { GetKeyState(k) } as u16 & 0x8000 != 0;
    Mods { ctrl: down(0x11), shift: down(0x10), alt: down(0x12) }
}

impl<A: App> Host<A> {
    /// Deliver an event to the app (skipped while a callback is already running).
    pub unsafe fn send(&mut self, e: Event) {
        if !self.ready || self.busy { return; }
        self.busy = true;
        self.app.event(&e, &mut self.cx);
        self.busy = false;
    }

    /// Draw and present one frame; recreates the device if it was lost.
    pub unsafe fn render(&mut self) {
        if self.pw <= 0 || self.ph <= 0 || self.busy { return; }
        if self.gpu.is_none() {
            match Gpu::new(self.cx.hwnd, self.pw, self.ph, self.cx.scale * 96.0) {
                Ok(g) => { self.gpu = Some(g); self.pace_dirty = true; }
                Err(_) => { self.cx.dirty = true; return; }
            }
        }
        let g = self.gpu.as_ref().unwrap();
        if !g.ready() { return; }
        g.dc.BeginDraw();
        self.busy = true;
        let mut c = Canvas {
            dc: &g.dc, brush: &g.brush, text: &mut self.text, theme: &self.theme,
            scale: self.cx.scale, w: self.cx.w, h: self.cx.h, stats: self.stats, clips: 0,
        };
        self.app.draw(&mut c);
        c.finish();
        self.busy = false;
        let lost = matches!(g.end_and_present(), Frame::Lost);
        self.text.end_frame();
        if lost { self.gpu = None; self.cx.dirty = true; }
    }

    unsafe fn resized(&mut self, pw: i32, ph: i32) {
        let changed = (pw, ph) != (self.pw, self.ph);
        self.pw = pw; self.ph = ph;
        self.cx.w = pw as f32 / self.cx.scale;
        self.cx.h = ph as f32 / self.cx.scale;
        if changed { if let Some(g) = self.gpu.as_mut() { g.resize(pw, ph); } }
        let (w, h) = (self.cx.w, self.cx.h);
        self.send(Event::Resize { w, h });
        self.cx.dirty = true;
    }

    pub fn wait_handle(&self) -> isize { self.gpu.as_ref().map_or(0, |g| g.wait) }

    /// Before each frame: on a display slower than the fastest one, wait for its vblank (the loop then skips the waitable).
    pub unsafe fn pace(&mut self) {
        let h = self.cx.hwnd;
        let Some(g) = self.gpu.as_mut() else { return };
        if self.pace_dirty { g.update_pacing(h); self.pace_dirty = false; }
        g.wait_vblank();
    }

    /// True when frames are also paced by the display's vblank.
    pub fn vblank_paced(&self) -> bool { self.gpu.as_ref().is_some_and(|g| g.vblank_paced()) }
}

unsafe extern "system" fn wndproc<A: App>(h: HWND, m: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    if HOST.is_null() { return DefWindowProcW(h, m, wp, lp); }
    let host = &mut *(HOST as *mut Host<A>);
    let s = host.cx.scale;
    let (mx, my) = ((lp & 0xFFFF) as i16 as f32 / s, ((lp >> 16) & 0xFFFF) as i16 as f32 / s);
    let btn = |b: Button, down: bool, host: &mut Host<A>| {
        if down { SetCapture(h); host.send(Event::MouseDown { x: mx, y: my, button: b }); }
        else { ReleaseCapture(); host.send(Event::MouseUp { x: mx, y: my, button: b }); }
        0
    };
    match m {
        WM_ERASEBKGND => 1,
        WM_MOVE | WM_DISPLAYCHANGE => { host.pace_dirty = true; DefWindowProcW(h, m, wp, lp) }
        WM_MOUSEACTIVATE if host.cx.no_focus => MA_NOACTIVATE,
        WM_PAINT => {
            let mut ps: PAINTSTRUCT = std::mem::zeroed();
            BeginPaint(h, &mut ps);
            if host.ready { host.render(); }
            EndPaint(h, &ps);
            0
        }
        WM_SIZE => {
            if wp != 1 {
                host.resized((lp & 0xFFFF) as i32, ((lp >> 16) & 0xFFFF) as i32);
                if host.ready { host.cx.dirty = false; host.render(); } // keep content live while the border is dragged
            }
            0
        }
        WM_GETMINMAXINFO => {
            let mi = &mut *(lp as *mut MINMAXINFO);
            mi.min_track = POINT { x: (host.min.0 * s) as i32, y: (host.min.1 * s) as i32 };
            0
        }
        WM_DPICHANGED => {
            let ns = ((wp >> 16) & 0xFFFF) as f32 / 96.0;
            host.pace_dirty = true;
            host.cx.scale = ns;
            if let Some(g) = host.gpu.as_mut() { g.set_dpi(ns * 96.0); }
            let r = &*(lp as *const RECT);
            SetWindowPos(h, 0, r.left, r.top, r.right - r.left, r.bottom - r.top, 0x14);
            let mut cr = RECT::default();
            GetClientRect(h, &mut cr);
            host.resized(cr.right, cr.bottom);
            0
        }
        WM_KEYDOWN => { host.send(Event::Key { key: wp as u32, mods: mods() }); 0 }
        WM_KEYUP => { host.send(Event::KeyUp { key: wp as u32, mods: mods() }); 0 }
        WM_CHAR => {
            let u = wp as u16;
            if (0xD800..0xDC00).contains(&u) { host.surrogate = u; return 0; }
            let c = if (0xDC00..0xE000).contains(&u) {
                let hi = std::mem::take(&mut host.surrogate);
                char::decode_utf16([hi, u]).next().and_then(|r| r.ok())
            } else { char::from_u32(u as u32) };
            if let Some(c) = c { if c as u32 >= 32 && c as u32 != 127 { host.send(Event::Char(c)); } }
            0
        }
        WM_MOUSEMOVE => {
            if !host.tracking {
                let mut t = TME { cb: std::mem::size_of::<TME>() as u32, flags: 2, hwnd: h, hover: 0 };
                TrackMouseEvent(&mut t);
                host.tracking = true;
            }
            host.send(Event::MouseMove { x: mx, y: my });
            0
        }
        WM_MOUSELEAVE => { host.tracking = false; host.send(Event::MouseLeave); 0 }
        WM_LBUTTONDOWN => btn(Button::Left, true, host),
        WM_LBUTTONUP => btn(Button::Left, false, host),
        WM_RBUTTONDOWN => btn(Button::Right, true, host),
        WM_RBUTTONUP => btn(Button::Right, false, host),
        WM_MBUTTONDOWN => btn(Button::Middle, true, host),
        WM_MBUTTONUP => btn(Button::Middle, false, host),
        WM_MOUSEWHEEL => {
            let mut p = POINT { x: (lp & 0xFFFF) as i16 as i32, y: ((lp >> 16) & 0xFFFF) as i16 as i32 };
            ScreenToClient(h, &mut p);
            let delta = ((wp >> 16) & 0xFFFF) as i16 as f32 / 120.0;
            host.send(Event::Wheel { x: p.x as f32 / s, y: p.y as f32 / s, delta });
            0
        }
        WM_SETFOCUS => { host.send(Event::Focus(true)); 0 }
        WM_KILLFOCUS => { host.send(Event::Focus(false)); 0 }
        WM_CLOSE => {
            if host.busy { return 0; }
            let ok = host.cx.bench || {
                host.busy = true;
                let r = host.app.close(&mut host.cx);
                host.busy = false;
                r
            };
            if ok { DestroyWindow(h); }
            0
        }
        WM_DESTROY => { PostQuitMessage(0); 0 }
        _ => DefWindowProcW(h, m, wp, lp),
    }
}

/// Dispatch every queued message; false once WM_QUIT arrives.
pub(crate) unsafe fn pump() -> bool {
    let mut msg: MSG = std::mem::zeroed();
    while PeekMessageW(&mut msg, 0, 0, 0, 1) != 0 {
        if msg.message == WM_QUIT { return false; }
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
    true
}

/// Create the window and run the app until it closes. `--bench` runs the benchmark, `--no-focus` shows it without
/// ever taking focus, `--display crt|4k` picks the display, `--max` maximizes.
pub fn run<A: App>(cfg: Config, app: A) {
    unsafe {
        let bench = crate::bench_requested();
        let maximize = cfg.maximized || std::env::args().any(|a| a == "--max");
        let no_focus = display::no_focus_requested();

        // Opt out of EcoQoS execution-speed throttling so the UI thread is not parked on an E-core.
        let thr: [u32; 3] = [1, 1, 0];
        SetProcessInformation(GetCurrentProcess(), 4, thr.as_ptr() as *const c_void, 12);
        SetThreadPriority(GetCurrentThread(), 1);
        SetProcessDpiAwarenessContext(-4); // per-monitor v2
        let sdpi = GetDpiForSystem();
        let placed = display::display_requested().and_then(|d| display::find(d));
        if let Some(p) = &placed { log(&format!("display: {}{}", p.describe(), if no_focus { "  (no-focus)" } else { "" })); }

        let text = match TextSys::new() { Ok(t) => t, Err(_) => return };
        let mut host = Box::new(Host {
            app, gpu: None, text, theme: cfg.theme, stats: Stats::default(), min: cfg.min_size,
            ready: false, busy: false, tracking: false, surrogate: 0, pw: 0, ph: 0, pace_dirty: true,
            cx: Ctx { hwnd: 0, w: 0.0, h: 0.0, scale: sdpi as f32 / 96.0, dirty: true, bench, title: cfg.title.clone(), no_focus, placed: placed.clone() },
        });
        HOST = &mut *host as *mut Host<A> as *mut c_void;

        let inst = GetModuleHandleW(null());
        let cls = wz("FastwinWnd");
        let wc = WNDCLASSEXW {
            cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32, style: 0, lpfnWndProc: wndproc::<A>, cbClsExtra: 0, cbWndExtra: 0,
            hInstance: inst, hIcon: 0, hCursor: LoadCursorW(0, 32512), hbrBackground: 0, lpszMenuName: null(),
            lpszClassName: cls.as_ptr(), hIconSm: 0,
        };
        RegisterClassExW(&wc);
        let style = 0x00CF_0000u32; // WS_OVERLAPPEDWINDOW
        // Work area (physical pixels) and DPI of the chosen display; without one, the system default screen.
        let (area, dpi0) = match &placed {
            Some(p) => (p.work, p.dpi),
            None => (RECT { left: 0, top: 0, right: GetSystemMetrics(0), bottom: GetSystemMetrics(1) }, sdpi),
        };
        let s = dpi0 as f32 / 96.0;
        let mut r = RECT { left: 0, top: 0, right: (cfg.size.0 * s).round() as i32, bottom: (cfg.size.1 * s).round() as i32 };
        AdjustWindowRectExForDpi(&mut r, style, 0, 0, dpi0);
        let (aw, ah) = (area.right - area.left, area.bottom - area.top);
        let (mut ww, mut wh) = ((r.right - r.left).min(aw * 92 / 100), (r.bottom - r.top).min(ah * 92 / 100));
        let (mut x, mut y) = (area.left + (aw - ww) / 2, area.top + (ah - wh) / 2);
        if maximize && no_focus { (x, y, ww, wh) = (area.left, area.top, aw, ah); } // SW_MAXIMIZE would activate
        let ex = if no_focus { WS_EX_NOACTIVATE } else { 0 };
        let h = CreateWindowExW(ex, cls.as_ptr(), wz(&cfg.title).as_ptr(), style, x, y, ww, wh, 0, 0, inst, null());
        if h == 0 { return; }
        host.cx.hwnd = h;
        let dpi = GetDpiForWindow(h);
        if dpi != 0 { host.cx.scale = dpi as f32 / 96.0; }
        if cfg.dark {
            let dark: i32 = 1;
            DwmSetWindowAttribute(h, 20, &dark as *const i32 as *const c_void, 4);
        }
        let mut cr = RECT::default();
        GetClientRect(h, &mut cr);
        match Gpu::new(h, cr.right, cr.bottom, host.cx.scale * 96.0) {
            Ok(g) => { host.gpu = Some(g); host.pw = cr.right; host.ph = cr.bottom; }
            Err(e) => { host.cx.alert(&format!("Direct3D/Direct2D init failed: {e}")); return; }
        }
        host.ready = true;
        host.busy = true;
        host.app.init(&mut host.cx);
        host.busy = false;
        host.resized(cr.right, cr.bottom);
        // No-focus mode: never activate; no SetForegroundWindow/SetActiveWindow/SetFocus/BringWindowToTop, never topmost.
        ShowWindow(h, if no_focus { SW_SHOWNOACTIVATE } else if maximize { 3 } else { 5 });

        if bench {
            pump();
            crate::bench::run(&mut host, &cfg.title);
            pump();
            HOST = null_mut();
            return;
        }
        main_loop(&mut host);
        HOST = null_mut();
    }
}

unsafe fn main_loop<A: App>(host: &mut Host<A>) {
    let f = qpf() as f64;
    let h = host.cx.hwnd;
    let mut last = 0i64;
    let mut trimmed = false;
    let mut animating = false;
    let (mut fps_t0, mut fps_frames, mut fps_last) = (0.0f64, 0u32, 0.0f64);
    loop {
        if !pump() { break; }
        if IsIconic(h) != 0 {
            MsgWaitForMultipleObjectsEx(0, null(), INFINITE, QS_ALLINPUT, MWMO_INPUTAVAILABLE);
            last = 0;
            continue;
        }
        if !(host.cx.dirty || animating) {
            // Idle: block until input arrives; nothing is presented. After 4 s of quiet, give the
            // driver/DWrite pages back (they fault back in on demand).
            let ms = if trimmed { INFINITE } else { 4000 };
            let r = MsgWaitForMultipleObjectsEx(0, null(), ms, QS_ALLINPUT, MWMO_INPUTAVAILABLE);
            if r == WAIT_TIMEOUT { SetProcessWorkingSetSize(GetCurrentProcess(), usize::MAX, usize::MAX); trimmed = true; }
            last = 0;
            continue;
        }
        // Wait for the swap chain (vsync pacing) or for input, whichever comes first. On a display slower
        // than the fastest one, the waitable runs at the faster compose rate and drifts against this
        // display's vblank, so pace by the vblank alone (in pace()) or frames are missed in bursts.
        let wait = if host.vblank_paced() { 0 } else { host.wait_handle() };
        if wait != 0 {
            let r = MsgWaitForMultipleObjectsEx(1, &wait, 100, QS_ALLINPUT, MWMO_INPUTAVAILABLE);
            if r != 0 { continue; }
        }
        host.pace();
        trimmed = false;
        let now = qpc();
        let dt = if last == 0 { 1.0 / 120.0 } else { ((now - last) as f64 / f) as f32 };
        last = now;
        host.busy = true;
        animating = host.app.update(dt);
        host.busy = false;
        if animating {
            let t = now as f64 / f;
            let started = !host.stats.active || t - fps_last > 0.1;
            if started { fps_t0 = t; fps_frames = 0; }
            host.stats.active = true;
            fps_last = t;
            if !started { fps_frames += 1; }
            if t - fps_t0 >= 0.5 { host.stats.fps = (fps_frames as f64 / (t - fps_t0)) as f32; fps_t0 = t; fps_frames = 0; }
        }
        host.cx.dirty = false;
        host.render();
        if !animating && host.stats.active {
            host.stats.active = false;
            host.cx.dirty = true; // one more frame so the app can show its idle state
        }
    }
}
