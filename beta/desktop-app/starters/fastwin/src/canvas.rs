//! Drawing API over Direct2D/DirectWrite. All coordinates are DIPs; edges snap to whole device pixels.

use windows::Win32::Graphics::Direct2D::Common::*;
use windows::Win32::Graphics::Direct2D::*;
use windows::Win32::Graphics::DirectWrite::DWRITE_MEASURING_MODE_NATURAL;
use windows_numerics::Vector2;

use crate::text::{Align, Font, TextSys};

/// An sRGB colour packed as 0xRRGGBB.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct Color(pub u32);

/// Colour from 8-bit red, green, blue.
pub const fn rgb(r: u8, g: u8, b: u8) -> Color { Color(((r as u32) << 16) | ((g as u32) << 8) | b as u32) }

impl Color {
    /// Red, green, blue as 0..=255.
    pub const fn parts(self) -> (u8, u8, u8) { ((self.0 >> 16) as u8, (self.0 >> 8) as u8, self.0 as u8) }
    /// Blend toward `o`: t = 0 is self, t = 1 is `o`.
    pub fn mix(self, o: Color, t: f32) -> Color {
        let (a, b) = (self.parts(), o.parts());
        let m = |x: u8, y: u8| (x as f32 + (y as f32 - x as f32) * t).round() as u8;
        rgb(m(a.0, b.0), m(a.1, b.1), m(a.2, b.2))
    }
    fn d2d(self) -> D2D1_COLOR_F {
        let (r, g, b) = self.parts();
        D2D1_COLOR_F { r: r as f32 / 255.0, g: g as f32 / 255.0, b: b as f32 / 255.0, a: 1.0 }
    }
}

/// The app palette; `Theme::default()` is a calm dark theme.
#[derive(Clone, Copy, Debug)]
pub struct Theme {
    /// Window background.
    pub bg: Color,
    /// Header/footer panels.
    pub panel: Color,
    /// Secondary panel (column heads).
    pub panel2: Color,
    /// Selected row.
    pub sel: Color,
    /// Hovered row.
    pub hover: Color,
    /// Divider lines.
    pub div: Color,
    /// Input field background.
    pub field: Color,
    /// Primary text.
    pub text: Color,
    /// Secondary text.
    pub dim: Color,
    /// Tertiary text and hints.
    pub faint: Color,
    /// Accent (buttons, focus).
    pub accent: Color,
    /// Text drawn on the accent colour.
    pub on_accent: Color,
    /// Scrollbar thumb.
    pub thumb: Color,
    /// Success.
    pub ok: Color,
    /// Warning.
    pub warn: Color,
    /// Error.
    pub bad: Color,
}

impl Default for Theme {
    fn default() -> Theme {
        Theme {
            bg: rgb(19, 21, 25), panel: rgb(26, 29, 35), panel2: rgb(23, 25, 30), sel: rgb(36, 44, 58),
            hover: rgb(28, 32, 40), div: rgb(34, 38, 46), field: rgb(14, 15, 18), text: rgb(214, 218, 226),
            dim: rgb(133, 141, 156), faint: rgb(88, 95, 108), accent: rgb(110, 150, 235), on_accent: rgb(12, 16, 28),
            thumb: rgb(58, 64, 76), ok: rgb(112, 176, 140), warn: rgb(216, 178, 76), bad: rgb(232, 98, 124),
        }
    }
}

/// An axis-aligned rectangle in DIPs.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct Rect {
    /// Left edge.
    pub x: f32,
    /// Top edge.
    pub y: f32,
    /// Width.
    pub w: f32,
    /// Height.
    pub h: f32,
}

/// Shorthand for `Rect { x, y, w, h }`.
pub const fn rect(x: f32, y: f32, w: f32, h: f32) -> Rect { Rect { x, y, w, h } }

impl Rect {
    /// True when the point is inside (right/bottom edges exclusive).
    pub fn contains(&self, x: f32, y: f32) -> bool { x >= self.x && x < self.x + self.w && y >= self.y && y < self.y + self.h }
    /// Shrunk by `d` on every side.
    pub fn inset(&self, d: f32) -> Rect { rect(self.x + d, self.y + d, self.w - 2.0 * d, self.h - 2.0 * d) }
}

/// Frame-rate info the loop measures while animating.
#[derive(Clone, Copy, Default, Debug)]
pub struct Stats {
    /// Frames per second over the last ~0.5 s of animation (or the last value seen).
    pub fps: f32,
    /// True while frames are being produced back to back.
    pub active: bool,
}

/// One frame's drawing surface, handed to `App::draw`.
pub struct Canvas<'a> {
    pub(crate) dc: &'a ID2D1DeviceContext,
    pub(crate) brush: &'a ID2D1SolidColorBrush,
    pub(crate) text: &'a mut TextSys,
    pub(crate) theme: &'a Theme,
    pub(crate) scale: f32,
    pub(crate) w: f32,
    pub(crate) h: f32,
    pub(crate) stats: Stats,
    pub(crate) clips: u32,
}

impl<'a> Canvas<'a> {
    /// Client size in DIPs.
    pub fn size(&self) -> (f32, f32) { (self.w, self.h) }
    /// Device pixels per DIP (1.0 at 96 dpi).
    pub fn scale(&self) -> f32 { self.scale }
    /// One device pixel in DIPs (for hairlines).
    pub fn px(&self) -> f32 { 1.0 / self.scale }
    /// The app theme.
    pub fn theme(&self) -> &Theme { self.theme }
    /// Frame-rate stats from the render loop.
    pub fn stats(&self) -> Stats { self.stats }
    /// Round a DIP coordinate to the nearest device pixel.
    pub fn snap(&self, v: f32) -> f32 { (v * self.scale).round() / self.scale }

    fn rf(&self, r: Rect) -> D2D_RECT_F {
        D2D_RECT_F { left: self.snap(r.x), top: self.snap(r.y), right: self.snap(r.x + r.w), bottom: self.snap(r.y + r.h) }
    }
    fn col(&self, c: Color) { unsafe { self.brush.SetColor(&c.d2d()) } }

    /// Fill the whole target.
    pub fn clear(&mut self, c: Color) { unsafe { self.dc.Clear(Some(&c.d2d())) } }

    /// Fill a rectangle.
    pub fn fill(&mut self, r: Rect, c: Color) {
        self.col(c);
        unsafe { self.dc.FillRectangle(&self.rf(r), self.brush) }
    }

    /// Fill a rounded rectangle with corner radius `rad`.
    pub fn round(&mut self, r: Rect, rad: f32, c: Color) {
        self.col(c);
        let rr = D2D1_ROUNDED_RECT { rect: self.rf(r), radiusX: rad, radiusY: rad };
        unsafe { self.dc.FillRoundedRectangle(&rr, self.brush) }
    }

    /// Outline a rounded rectangle with a stroke `width` DIPs wide.
    pub fn stroke_round(&mut self, r: Rect, rad: f32, width: f32, c: Color) {
        self.col(c);
        let h = width / 2.0;
        let mut rf = self.rf(r);
        rf.left += h; rf.top += h; rf.right -= h; rf.bottom -= h;
        let rr = D2D1_ROUNDED_RECT { rect: rf, radiusX: rad, radiusY: rad };
        unsafe { self.dc.DrawRoundedRectangle(&rr, self.brush, width, None::<&ID2D1StrokeStyle>) }
    }

    /// Straight line `width` DIPs wide.
    pub fn line(&mut self, x0: f32, y0: f32, x1: f32, y1: f32, width: f32, c: Color) {
        self.col(c);
        let (p0, p1) = (Vector2 { X: x0, Y: y0 }, Vector2 { X: x1, Y: y1 });
        unsafe { self.dc.DrawLine(p0, p1, self.brush, width, None::<&ID2D1StrokeStyle>) }
    }

    /// Horizontal divider exactly one device pixel tall, with its top edge at `y`.
    pub fn hline(&mut self, x: f32, y: f32, w: f32, c: Color) {
        let y = self.snap(y);
        let p = self.px();
        self.fill(rect(x, y, w, p), c);
    }

    /// Single-line text in `r`, vertically centred; the layout is cached across frames.
    pub fn text(&mut self, s: &str, r: Rect, f: Font, al: Align, c: Color) {
        if s.is_empty() || r.w <= 0.0 { return; }
        self.col(c);
        let (x, y) = (self.snap(r.x), self.snap(r.y));
        unsafe {
            if let Some(l) = self.text.layout(s, f, al, r.w, r.h) {
                self.dc.DrawTextLayout(Vector2 { X: x, Y: y }, l, self.brush, D2D1_DRAW_TEXT_OPTIONS_CLIP);
            }
        }
    }

    /// Uncached one-off text (for strings that change every frame).
    pub fn text_once(&mut self, s: &str, r: Rect, f: Font, al: Align, c: Color) {
        if s.is_empty() || r.w <= 0.0 { return; }
        self.col(c);
        let w: Vec<u16> = s.encode_utf16().collect();
        let rf = D2D_RECT_F { left: self.snap(r.x), top: self.snap(r.y), right: self.snap(r.x) + r.w, bottom: self.snap(r.y) + r.h };
        unsafe {
            if let Some(fmt) = self.text.format_for(f, al) {
                self.dc.DrawText(&w, fmt, &rf, self.brush, D2D1_DRAW_TEXT_OPTIONS_CLIP, DWRITE_MEASURING_MODE_NATURAL);
            }
        }
    }

    /// Width of `s` in DIPs when set in `f`.
    pub fn measure(&mut self, s: &str, f: Font) -> f32 { unsafe { self.text.measure(s, f) } }

    /// Clip further drawing to `r` until `unclip`.
    pub fn clip(&mut self, r: Rect) {
        self.clips += 1;
        unsafe { self.dc.PushAxisAlignedClip(&self.rf(r), D2D1_ANTIALIAS_MODE_ALIASED) }
    }

    /// Remove the most recent clip.
    pub fn unclip(&mut self) {
        if self.clips == 0 { return; }
        self.clips -= 1;
        unsafe { self.dc.PopAxisAlignedClip() }
    }

    pub(crate) fn finish(&mut self) { while self.clips > 0 { self.unclip(); } }
}
