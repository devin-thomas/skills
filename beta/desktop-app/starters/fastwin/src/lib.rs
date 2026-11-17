//! fastwin: a tiny framework for simple, fast native Windows apps.
//!
//! Raw Win32 window and input, a D3D11 flip-model swap chain paced by its frame-latency waitable
//! (`Present(1, 0)`, tear-free under vsync and G-Sync), Direct2D + DirectWrite for drawing. Frames are
//! presented only when something changed or is animating; when idle the thread blocks on messages and
//! the working set is trimmed after 4 s. Every app gets `--bench` for free.
#![warn(missing_docs)]
#![allow(clippy::missing_safety_doc, clippy::too_many_arguments, static_mut_refs)]

mod bench;
mod canvas;
mod gpu;
mod host;
mod sys;
mod text;

pub mod anim;
pub mod display;
pub mod file;
pub mod list;

pub use anim::{Smooth, Tween};
pub use display::{app_args, Display};
pub use canvas::{rect, rgb, Canvas, Color, Rect, Stats, Theme};
pub use host::{run, Answer, App, Button, Config, Ctx, Event, Mods};
pub use list::List;
pub use text::{Align, Font};

/// True when the process was started with `--bench`.
pub fn bench_requested() -> bool { std::env::args().any(|a| a == "--bench") }

/// Virtual-key codes for `Event::Key` (letters and digits are their ASCII uppercase codes, e.g. `b'S' as u32`).
pub mod key {
    /// Backspace.
    pub const BACK: u32 = 0x08;
    /// Tab.
    pub const TAB: u32 = 0x09;
    /// Enter.
    pub const ENTER: u32 = 0x0D;
    /// Escape.
    pub const ESC: u32 = 0x1B;
    /// Space.
    pub const SPACE: u32 = 0x20;
    /// Page Up.
    pub const PAGE_UP: u32 = 0x21;
    /// Page Down.
    pub const PAGE_DOWN: u32 = 0x22;
    /// End.
    pub const END: u32 = 0x23;
    /// Home.
    pub const HOME: u32 = 0x24;
    /// Left arrow.
    pub const LEFT: u32 = 0x25;
    /// Up arrow.
    pub const UP: u32 = 0x26;
    /// Right arrow.
    pub const RIGHT: u32 = 0x27;
    /// Down arrow.
    pub const DOWN: u32 = 0x28;
    /// Delete.
    pub const DELETE: u32 = 0x2E;
    /// F1; F2..F12 follow consecutively.
    pub const F1: u32 = 0x70;
    /// F2.
    pub const F2: u32 = 0x71;
}
