//! Time-based motion. Everything takes elapsed seconds, so speed is the same at 60, 120 or 240 Hz.

/// Exponential approach toward a target (smooth scroll); frame-rate independent.
#[derive(Clone, Copy, Debug)]
pub struct Smooth {
    /// Current value.
    pub value: f32,
    /// Where the value is heading.
    pub target: f32,
    /// Speed: fraction of the remaining distance covered per second is 1 - e^-rate.
    pub rate: f32,
}

impl Smooth {
    /// At rest at 0 with the given rate (22 feels like a fast native scroll).
    pub const fn new(rate: f32) -> Smooth { Smooth { value: 0.0, target: 0.0, rate } }
    /// Jump to `v` with no animation.
    pub fn set(&mut self, v: f32) { self.value = v; self.target = v; }
    /// True while value has not reached target.
    pub fn moving(&self) -> bool { self.value != self.target }
    /// Advance by `dt` seconds; lands exactly on target when within a quarter DIP. Returns true while still moving.
    pub fn update(&mut self, dt: f32) -> bool {
        let d = self.target - self.value;
        if d.abs() < 0.25 { self.value = self.target; return false; }
        self.value += d * (1.0 - (-dt.min(0.05) * self.rate).exp());
        true
    }
    /// The value rounded to whole device pixels at `scale` (pixel-snapped scroll offset).
    pub fn snapped(&self, scale: f32) -> f32 { snap(self.value, scale) }
}

/// Fixed-duration tween from `from` to `to` with ease-out-cubic.
#[derive(Clone, Copy, Debug, Default)]
pub struct Tween {
    /// Start value.
    pub from: f32,
    /// End value.
    pub to: f32,
    /// Elapsed seconds.
    pub t: f32,
    /// Duration in seconds.
    pub dur: f32,
}

impl Tween {
    /// Start a tween from `from` to `to` over `dur` seconds.
    pub fn new(from: f32, to: f32, dur: f32) -> Tween { Tween { from, to, t: 0.0, dur } }
    /// Current eased value.
    pub fn value(&self) -> f32 { lerp(self.from, self.to, ease_out_cubic(if self.dur > 0.0 { self.t / self.dur } else { 1.0 })) }
    /// Advance by `dt`; returns true while still running.
    pub fn update(&mut self, dt: f32) -> bool { self.t = (self.t + dt).min(self.dur); self.t < self.dur }
}

/// Linear interpolation.
pub fn lerp(a: f32, b: f32, t: f32) -> f32 { a + (b - a) * t }
/// Ease-out cubic on t in 0..=1.
pub fn ease_out_cubic(t: f32) -> f32 { let u = 1.0 - t.clamp(0.0, 1.0); 1.0 - u * u * u }
/// Round a DIP value to whole device pixels.
pub fn snap(v: f32, scale: f32) -> f32 { (v * scale).round() / scale }
/// 0 -> 1 -> 0 triangle wave over `period` frames; handy for `bench_step` sweeps.
pub fn pingpong(frame: usize, period: usize) -> f32 {
    let p = (frame % (2 * period)) as f32 / period as f32;
    if p < 1.0 { p } else { 2.0 - p }
}
