//! Display selection by what the display is (CRT or 4K), plus the no-focus test placement mode.
//!
//! `--display crt|4k` (env `FASTWIN_DISPLAY`) picks a display by physical resolution. `--no-focus`
//! (env `FASTWIN_NO_FOCUS=1`) and `--bench` place the window without ever activating it, on the CRT
//! unless another display is asked for. A normal launch without either flag keeps the system placement.

use crate::sys::*;

/// A display, named by what it is.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Display {
    /// A 4:3 display at most 1600 px wide (today the 1280x960 CRT).
    Crt,
    /// A display at least 3840 px wide.
    FourK,
}

impl Display {
    /// "CRT" or "4K".
    pub fn name(self) -> &'static str { match self { Display::Crt => "CRT", Display::FourK => "4K" } }
    /// Parse "crt" or "4k" (any case).
    pub fn parse(s: &str) -> Option<Display> {
        match s.trim().to_ascii_lowercase().as_str() { "crt" => Some(Display::Crt), "4k" => Some(Display::FourK), _ => None }
    }
    /// The other display, used as the fallback.
    pub fn other(self) -> Display { match self { Display::Crt => Display::FourK, Display::FourK => Display::Crt } }
    /// True when a display of `w` x `h` physical pixels is this kind.
    pub fn matches(self, w: i32, h: i32) -> bool {
        match self {
            Display::Crt => h > 0 && w <= 1600 && ((w as f32 / h as f32) / (4.0 / 3.0) - 1.0).abs() <= 0.01,
            Display::FourK => w >= 3840,
        }
    }
}

/// The display a window was placed on.
#[derive(Clone, Debug)]
pub struct Placed {
    /// What it is (None when neither a CRT nor a 4K display is connected).
    pub kind: Option<Display>,
    /// What was asked for.
    pub requested: Display,
    /// Physical size in pixels.
    pub w: i32,
    /// Physical height in pixels.
    pub h: i32,
    /// Refresh rate in Hz (0 if unknown).
    pub hz: u32,
    /// Work area in physical virtual-desktop pixels.
    pub(crate) work: RECT,
    /// Effective DPI of that display.
    pub(crate) dpi: u32,
}

impl Placed {
    /// One line for logs and bench.txt, e.g. "CRT 1280x960 @ 85 Hz".
    pub fn describe(&self) -> String {
        let name = self.kind.map_or("other", Display::name);
        let mut s = format!("{name} {}x{} @ {} Hz", self.w, self.h, self.hz);
        if self.kind != Some(self.requested) {
            s.push_str(&format!(" (requested {}, not connected)", self.requested.name()));
        }
        s
    }
}

struct Mon { h: isize, info: MONITORINFOEXW }

unsafe extern "system" fn collect(h: isize, _: isize, _: *mut RECT, data: LPARAM) -> BOOL {
    let v = &mut *(data as *mut Vec<Mon>);
    let mut info: MONITORINFOEXW = std::mem::zeroed();
    info.cb = std::mem::size_of::<MONITORINFOEXW>() as u32;
    if GetMonitorInfoW(h, &mut info) != 0 { v.push(Mon { h, info }); }
    1
}

unsafe fn refresh(dev: &[u16; 32]) -> u32 {
    // DEVMODEW is 220 bytes: dmSize at offset 68, dmDisplayFrequency at offset 184.
    let mut dm = [0u8; 220];
    dm[68..70].copy_from_slice(&220u16.to_le_bytes());
    if EnumDisplaySettingsW(dev.as_ptr(), 0xFFFF_FFFF, dm.as_mut_ptr()) == 0 { return 0; }
    u32::from_le_bytes([dm[184], dm[185], dm[186], dm[187]])
}

unsafe fn monitors() -> Vec<Mon> {
    let mut mons: Vec<Mon> = Vec::new();
    EnumDisplayMonitors(0, std::ptr::null(), collect, &mut mons as *mut Vec<Mon> as LPARAM);
    mons
}

/// True when the window's display refreshes slower than the fastest connected one. DWM then composes faster than
/// this display scans out, so the latency waitable alone over-produces frames; the loop also waits for its vblank.
pub(crate) unsafe fn slower_than_fastest(hwnd: HWND) -> bool {
    let mons = monitors();
    let here = MonitorFromWindow(hwnd, 2);
    let max = mons.iter().map(|m| refresh(&m.info.device)).max().unwrap_or(0);
    mons.iter().find(|m| m.h == here).is_some_and(|m| { let hz = refresh(&m.info.device); hz > 0 && hz + 2 < max })
}

/// Find the requested display, else the other one, else the primary. Needs per-monitor DPI awareness.
pub(crate) unsafe fn find(want: Display) -> Option<Placed> {
    let mons = monitors();
    let size = |m: &Mon| (m.info.monitor.right - m.info.monitor.left, m.info.monitor.bottom - m.info.monitor.top);
    let pick = |d: Display| mons.iter().find(|m| { let (w, h) = size(m); d.matches(w, h) });
    let (kind, m) = match pick(want) {
        Some(m) => (Some(want), m),
        None => match pick(want.other()) {
            Some(m) => (Some(want.other()), m),
            None => (None, mons.iter().find(|m| m.info.flags & 1 != 0).or(mons.first())?),
        },
    };
    let (w, h) = size(m);
    let (mut dx, mut dy) = (96u32, 96u32);
    if GetDpiForMonitor(m.h, 0, &mut dx, &mut dy) != 0 { dx = 96; }
    Some(Placed { kind, requested: want, w, h, hz: refresh(&m.info.device), work: m.info.work, dpi: dx })
}

/// Value of `--name value` or `--name=value`.
fn flag_value(name: &str) -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    let eq = format!("{name}=");
    args.iter().enumerate().find_map(|(i, a)| {
        if a == name { args.get(i + 1).cloned() } else { a.strip_prefix(&eq).map(str::to_string) }
    })
}

/// True for `--bench`, `--no-focus` or `FASTWIN_NO_FOCUS=1`: the window must never take focus.
pub fn no_focus_requested() -> bool {
    crate::bench_requested() || std::env::args().any(|a| a == "--no-focus")
        || std::env::var("FASTWIN_NO_FOCUS").is_ok_and(|v| v.trim() == "1")
}

/// The display asked for by `--display` or `FASTWIN_DISPLAY` (CRT by default in no-focus mode).
pub fn display_requested() -> Option<Display> {
    let d = flag_value("--display").or_else(|| std::env::var("FASTWIN_DISPLAY").ok()).and_then(|s| Display::parse(&s));
    d.or(if no_focus_requested() { Some(Display::Crt) } else { None })
}

/// Command-line arguments meant for the app: the exe name and fastwin's own flags removed.
pub fn app_args() -> Vec<String> {
    let mut out = Vec::new();
    let mut it = std::env::args().skip(1);
    while let Some(a) = it.next() {
        match a.as_str() {
            "--bench" | "--no-focus" | "--max" => {}
            "--display" => { it.next(); }
            _ if a.starts_with("--display=") => {}
            _ => out.push(a),
        }
    }
    out
}
