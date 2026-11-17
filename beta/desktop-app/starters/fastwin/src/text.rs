//! DirectWrite formats and a frame-aged layout cache. Layouts are device-independent, so they survive
//! device loss and DPI changes (everything is in DIPs).

use std::collections::HashMap;
use std::hash::{BuildHasherDefault, Hasher};

use windows::core::{w as wide, PCWSTR};
use windows::Win32::Graphics::DirectWrite::*;

/// A font: family, size in DIPs and weight (400 regular, 600 semibold, 700 bold).
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Font {
    /// Font family name.
    pub family: &'static str,
    /// Size in DIPs.
    pub size: f32,
    /// Weight, 100..=900.
    pub weight: u16,
}

impl Font {
    /// Segoe UI at `size` DIPs, regular weight.
    pub const fn new(size: f32) -> Font { Font { family: "Segoe UI", size, weight: 400 } }
    /// Same font with another weight.
    pub const fn weight(self, weight: u16) -> Font { Font { weight, ..self } }
    /// Same font at semibold (600).
    pub const fn bold(self) -> Font { self.weight(600) }
    /// Same font with another family, e.g. "Consolas".
    pub const fn family(self, family: &'static str) -> Font { Font { family, ..self } }
}

/// Horizontal alignment of single-line text; text is vertically centred in its rect.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Align {
    /// Left, ellipsis when too long.
    Left,
    /// Centre, ellipsis when too long.
    Center,
    /// Right, ellipsis when too long.
    Right,
    /// Right-aligned, no ellipsis: shows the end of long text (input fields).
    Tail,
}

const TRIM: DWRITE_TRIMMING = DWRITE_TRIMMING { granularity: DWRITE_TRIMMING_GRANULARITY_CHARACTER, delimiter: 0, delimiterCount: 0 };
const NO_TRIM: DWRITE_TRIMMING = DWRITE_TRIMMING { granularity: DWRITE_TRIMMING_GRANULARITY_NONE, delimiter: 0, delimiterCount: 0 };

/// Hasher that passes a precomputed u64 key straight through.
#[derive(Default)]
struct Pass(u64);
impl Hasher for Pass {
    fn finish(&self) -> u64 { self.0 }
    fn write(&mut self, b: &[u8]) { self.0 = fnv(self.0 ^ 0xcbf2_9ce4_8422_2325, b) }
    fn write_u64(&mut self, v: u64) { self.0 = v }
}

fn fnv(mut h: u64, b: &[u8]) -> u64 {
    for &x in b { h ^= x as u64; h = h.wrapping_mul(0x100_0000_01b3); }
    h
}

struct Entry { layout: IDWriteTextLayout, used: u32 }

pub(crate) struct TextSys {
    dw: IDWriteFactory,
    formats: Vec<(u64, IDWriteTextFormat, Option<IDWriteInlineObject>)>,
    cache: HashMap<u64, Entry, BuildHasherDefault<Pass>>,
    frame: u32,
}

fn font_key(f: Font, al: Align) -> u64 {
    let h = fnv(0xcbf2_9ce4_8422_2325, f.family.as_bytes());
    let h = fnv(h, &f.size.to_bits().to_le_bytes());
    fnv(h, &[f.weight as u8, (f.weight >> 8) as u8, al as u8])
}

impl TextSys {
    pub unsafe fn new() -> windows::core::Result<TextSys> {
        Ok(TextSys { dw: DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED)?, formats: Vec::new(), cache: HashMap::default(), frame: 0 })
    }

    unsafe fn format(&mut self, key: u64, f: Font, al: Align) -> Option<usize> {
        if let Some(i) = self.formats.iter().position(|e| e.0 == key) { return Some(i); }
        let fam: Vec<u16> = f.family.encode_utf16().chain(Some(0)).collect();
        let fmt = self.dw.CreateTextFormat(PCWSTR(fam.as_ptr()), None, DWRITE_FONT_WEIGHT(f.weight as i32), DWRITE_FONT_STYLE_NORMAL,
            DWRITE_FONT_STRETCH_NORMAL, f.size, wide!("en-us")).ok()?;
        let _ = fmt.SetTextAlignment(match al {
            Align::Left => DWRITE_TEXT_ALIGNMENT_LEADING,
            Align::Center => DWRITE_TEXT_ALIGNMENT_CENTER,
            Align::Right | Align::Tail => DWRITE_TEXT_ALIGNMENT_TRAILING,
        });
        let _ = fmt.SetParagraphAlignment(DWRITE_PARAGRAPH_ALIGNMENT_CENTER);
        let _ = fmt.SetWordWrapping(DWRITE_WORD_WRAPPING_NO_WRAP);
        let sign = if al == Align::Tail { None } else { self.dw.CreateEllipsisTrimmingSign(&fmt).ok() };
        let _ = match &sign { Some(s) => fmt.SetTrimming(&TRIM, s), None => fmt.SetTrimming(&NO_TRIM, None::<&IDWriteInlineObject>) };
        self.formats.push((key, fmt, sign));
        Some(self.formats.len() - 1)
    }

    /// The (cached) text format for a font and alignment.
    pub unsafe fn format_for(&mut self, f: Font, al: Align) -> Option<&IDWriteTextFormat> {
        let i = self.format(font_key(f, al), f, al)?;
        Some(&self.formats[i].1)
    }

    /// Cached layout for this exact text, font, alignment and box size.
    pub unsafe fn layout(&mut self, s: &str, f: Font, al: Align, w: f32, h: f32) -> Option<&IDWriteTextLayout> {
        let fk = font_key(f, al);
        let mut k = fnv(fk, s.as_bytes());
        k = fnv(k, &w.to_bits().to_le_bytes());
        k = fnv(k, &h.to_bits().to_le_bytes());
        let frame = self.frame;
        if !self.cache.contains_key(&k) {
            let fi = self.format(fk, f, al)?;
            let wide: Vec<u16> = s.encode_utf16().collect();
            let (_, fmt, sign) = &self.formats[fi];
            let l = self.dw.CreateTextLayout(&wide, fmt, w.max(1.0), h.max(1.0)).ok()?;
            if let Some(sg) = sign { let _ = l.SetTrimming(&TRIM, sg); }
            self.cache.insert(k, Entry { layout: l, used: frame });
        }
        let e = self.cache.get_mut(&k)?;
        e.used = frame;
        Some(&e.layout)
    }

    /// Width in DIPs of `s` set in `f`.
    pub unsafe fn measure(&mut self, s: &str, f: Font) -> f32 {
        let Some(l) = self.layout(s, f, Align::Left, 1.0e6, f.size * 2.0) else { return 0.0 };
        let mut m = DWRITE_TEXT_METRICS::default();
        if l.GetMetrics(&mut m).is_ok() { m.widthIncludingTrailingWhitespace } else { 0.0 }
    }

    /// Age the cache; drop layouts not drawn in the last ~300 frames once it grows large.
    pub fn end_frame(&mut self) {
        self.frame = self.frame.wrapping_add(1);
        if self.frame % 60 == 0 && self.cache.len() > 1024 {
            let f = self.frame;
            self.cache.retain(|_, e| f.wrapping_sub(e.used) < 300);
        }
    }
}
