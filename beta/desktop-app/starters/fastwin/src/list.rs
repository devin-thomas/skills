//! Virtualized list: fixed row height, smooth scroll, selection and hover; only visible rows are drawn.

use crate::anim::{pingpong, Smooth};
use crate::canvas::{rect, Canvas, Color};
use crate::key;

/// Scroll/selection state for a list of `len` rows of height `row_h` in a viewport `view_h` tall.
#[derive(Clone, Debug)]
pub struct List {
    /// Row height in DIPs.
    pub row_h: f32,
    /// Number of rows.
    pub len: usize,
    /// Viewport height in DIPs.
    pub view_h: f32,
    /// Extra space after the last row.
    pub pad: f32,
    /// Selected row.
    pub sel: usize,
    /// Row under the mouse.
    pub hover: Option<usize>,
    /// Scroll offset in DIPs (animated).
    pub scroll: Smooth,
}

impl List {
    /// Empty list with the given row height.
    pub fn new(row_h: f32) -> List {
        List { row_h, len: 0, view_h: 0.0, pad: 0.0, sel: 0, hover: None, scroll: Smooth::new(22.0) }
    }
    /// Set the row count; clamps selection and scroll.
    pub fn set_len(&mut self, n: usize) {
        self.len = n;
        self.sel = self.sel.min(n.saturating_sub(1));
        if self.hover.is_some_and(|h| h >= n) { self.hover = None; }
        self.clamp();
    }
    /// Set the viewport height; clamps scroll.
    pub fn set_view(&mut self, h: f32) { self.view_h = h.max(0.0); self.clamp(); }
    /// Largest scroll offset.
    pub fn max_scroll(&self) -> f32 { (self.len as f32 * self.row_h + self.pad - self.view_h).max(0.0) }
    fn clamp(&mut self) {
        let m = self.max_scroll();
        self.scroll.target = self.scroll.target.clamp(0.0, m);
        self.scroll.value = self.scroll.value.clamp(0.0, m);
    }
    /// Current scroll offset.
    pub fn offset(&self) -> f32 { self.scroll.value }
    /// Visible rows as (index, y) where y is the row top given the list's top edge.
    pub fn rows(&self, top: f32) -> impl Iterator<Item = (usize, f32)> {
        let off = self.offset();
        let rh = self.row_h.max(1.0);
        let first = (off / rh).floor().max(0.0) as usize;
        let last = (((off + self.view_h) / rh).floor() as usize + 1).min(self.len);
        (first..last.max(first)).map(move |i| (i, top + i as f32 * rh - off))
    }
    /// Row at `y` measured from the list's top edge.
    pub fn row_at(&self, y: f32) -> Option<usize> {
        if y < 0.0 || y >= self.view_h { return None; }
        let i = ((y + self.offset()) / self.row_h.max(1.0)).floor() as usize;
        (i < self.len).then_some(i)
    }
    /// Update hover from a y relative to the list top (None = outside); true if it changed.
    pub fn hover_at(&mut self, y: Option<f32>) -> bool {
        let h = y.and_then(|y| self.row_at(y));
        let changed = h != self.hover;
        self.hover = h;
        changed
    }
    /// Scroll by mouse-wheel notches (positive = up), three rows per notch.
    pub fn wheel(&mut self, notches: f32) { self.scroll_by(-notches * 3.0 * self.row_h); }
    /// Animate the scroll target by `d` DIPs.
    pub fn scroll_by(&mut self, d: f32) { self.scroll.target += d; self.clamp(); }
    /// Scroll just enough to show row `i`.
    pub fn ensure_visible(&mut self, i: usize) {
        let top = i as f32 * self.row_h;
        let bot = top + self.row_h;
        if top < self.scroll.target { self.scroll.target = top; }
        else if bot > self.scroll.target + self.view_h { self.scroll.target = bot - self.view_h; }
        self.clamp();
    }
    /// Select row `i` (clamped) and scroll it into view.
    pub fn select(&mut self, i: usize) {
        if self.len == 0 { return; }
        self.sel = i.min(self.len - 1);
        self.ensure_visible(self.sel);
    }
    /// Rows per page.
    pub fn page(&self) -> usize { ((self.view_h / self.row_h.max(1.0)) as usize).saturating_sub(1).max(1) }
    /// Handle Up/Down/PageUp/PageDown/Home/End; true if the key was used.
    pub fn nav(&mut self, k: u32) -> bool {
        let s = self.sel;
        match k {
            key::UP => self.select(s.saturating_sub(1)),
            key::DOWN => self.select(s + 1),
            key::PAGE_UP => self.select(s.saturating_sub(self.page())),
            key::PAGE_DOWN => self.select(s + self.page()),
            key::HOME => self.select(0),
            key::END => self.select(self.len.saturating_sub(1)),
            _ => return false,
        }
        true
    }
    /// Advance the scroll animation; true while moving.
    pub fn update(&mut self, dt: f32) -> bool { self.scroll.update(dt) }
    /// Draw a scrollbar thumb `w` wide at `x`, alongside a list whose top is `top`.
    pub fn scrollbar(&self, c: &mut Canvas, x: f32, top: f32, w: f32, col: Color) {
        let ms = self.max_scroll();
        if ms <= 0.0 { return; }
        let total = self.len as f32 * self.row_h;
        let th = (self.view_h / total * self.view_h).max(24.0);
        let ty = top + self.offset() / ms * (self.view_h - th);
        c.round(rect(x, ty, w, th), w / 2.0, col);
    }
    /// Bench helper: sweep top to bottom and back every `2 * period` frames, moving selection and hover.
    pub fn bench_sweep(&mut self, frame: usize, period: usize) {
        let v = pingpong(frame, period) * self.max_scroll();
        self.scroll.set(v);
        if self.len > 0 { self.sel = (frame / 4) % self.len; self.hover = Some((frame / 3) % self.len); }
    }
}
