//! triage: skill-triage ported onto fastwin. Decide which Claude Code skills to trim.
//! Reads skills.tsv (next to the exe, or the first non-flag argument) and keeps decisions.json beside it.
#![windows_subsystem = "windows"]

use fastwin::file::{exe_dir, local_hms, read_text, utc_iso, write_atomic};
use fastwin::{key, rect, rgb, run, Align, Answer, App, Button, Canvas, Color, Config, Ctx, Event, Font, List, Rect};

// ---------------------------------------------------------------- look
const CH_COL: [Color; 4] = [rgb(112, 176, 140), rgb(216, 178, 76), rgb(226, 138, 92), rgb(232, 98, 124)];
const CH_NAME: [&str; 4] = ["keep", "name-only", "off", "remove"];
const SORT_NAME: [&str; 5] = ["uses (low first)", "last used (stalest first)", "context (high first)", "name", "source"];
const TAG: Color = rgb(38, 43, 53);
const WHITE: Color = rgb(255, 255, 255);
const BODY: Font = Font::new(15.0);
const BOLD: Font = Font::new(15.0).bold();
const SMALL: Font = Font::new(12.5);
const TITLE: Font = Font::new(21.0).bold();
const COLS: [&str; 7] = ["CHOICE", "SKILL", "SOURCE", "USES", "LAST USED", "CONTEXT", "DESCRIPTION"];
const NOTE_HINT: &str = "free-text note for me (click or F2 to type, Enter to leave)";
const HINT: &str = "Up/Down move   1 keep  2 name-only  3 off  4 remove   Space cycle   type to filter (letters)   Tab sort   Right-click pill = back";

// ---------------------------------------------------------------- model
struct Skill {
    name: String, name_lc: String, source: String, uses: u32, uses_s: String, last: String, last_days: i32,
    ctx: u32, ctx_s: String, user_only: bool, desc: String, choice: u8,
}

fn parse_days(s: &str) -> i32 {
    let s = s.trim();
    if s == "never" || s.is_empty() { return i32::MAX; }
    if s == "today" { return 0; }
    if s == "yesterday" { return 1; }
    let n: i32 = s.chars().take_while(|c| c.is_ascii_digit()).collect::<String>().parse().unwrap_or(0);
    if s.contains("week") { n * 7 } else if s.contains("month") { n * 30 } else if s.contains("year") { n * 365 }
    else if s.contains("hour") || s.contains("min") || s.contains("sec") { 0 } else { n }
}

fn load_tsv(path: &str) -> Result<Vec<Skill>, String> {
    let txt = read_text(path).map_err(|e| format!("cannot read {path}: {e}"))?;
    let mut v = Vec::new();
    for (i, line) in txt.lines().enumerate() {
        if i == 0 || line.is_empty() { continue; }
        let f: Vec<&str> = line.splitn(8, '\t').collect();
        if f.len() < 7 { continue; }
        let uses: u32 = f[4].parse().unwrap_or(0);
        let ctx: u32 = f[2].parse().unwrap_or(0);
        v.push(Skill {
            name: f[0].to_string(), name_lc: f[0].to_ascii_lowercase(), source: f[1].to_string(),
            uses, uses_s: uses.to_string(), last: f[5].to_string(), last_days: parse_days(f[5]),
            ctx, ctx_s: if ctx == 0 { "\u{2013}".into() } else { format!("~{ctx}") },
            user_only: f[6] == "true", desc: f.get(7).copied().unwrap_or("").to_string(), choice: 0,
        });
    }
    if v.is_empty() { return Err(format!("{path} has no rows")); }
    Ok(v)
}

// ---- tiny JSON for decisions.json
enum Tok { S(String), Open, Close, Colon, Other }
fn tokenize(t: &str) -> Vec<Tok> {
    let b = t.as_bytes();
    let mut i = 0;
    let mut out = Vec::new();
    while i < b.len() {
        match b[i] {
            b'"' => {
                i += 1;
                let mut s: Vec<u8> = Vec::new();
                while i < b.len() && b[i] != b'"' {
                    if b[i] == b'\\' && i + 1 < b.len() {
                        i += 1;
                        match b[i] {
                            b'n' => s.push(b'\n'), b't' => s.push(b'\t'), b'r' => s.push(b'\r'),
                            b'b' => s.push(8), b'f' => s.push(12),
                            b'u' if i + 4 < b.len() => {
                                let hex = |k: usize| u32::from_str_radix(std::str::from_utf8(&b[k..k + 4]).unwrap_or("0"), 16).unwrap_or(0xFFFD);
                                let mut cp = hex(i + 1);
                                i += 4;
                                if (0xD800..0xDC00).contains(&cp) && i + 6 < b.len() && b[i + 1] == b'\\' && b[i + 2] == b'u' {
                                    let lo = hex(i + 3);
                                    if (0xDC00..0xE000).contains(&lo) { cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00); i += 6; }
                                }
                                let ch = char::from_u32(cp).unwrap_or('\u{FFFD}');
                                let mut buf = [0u8; 4];
                                s.extend_from_slice(ch.encode_utf8(&mut buf).as_bytes());
                            }
                            c => s.push(c),
                        }
                    } else { s.push(b[i]); }
                    i += 1;
                }
                out.push(Tok::S(String::from_utf8_lossy(&s).into_owned()));
            }
            b'{' => out.push(Tok::Open),
            b'}' => out.push(Tok::Close),
            b':' => out.push(Tok::Colon),
            b',' | b' ' | b'\n' | b'\r' | b'\t' => {}
            _ => {
                while i < b.len() && !matches!(b[i], b',' | b'}' | b'{' | b':' | b' ' | b'\n' | b'\r') { i += 1; }
                i -= 1;
                out.push(Tok::Other);
            }
        }
        i += 1;
    }
    out
}
fn parse_decisions(txt: &str) -> (String, Vec<(String, String)>) {
    let t = tokenize(txt);
    let mut note = String::new();
    let mut dec = Vec::new();
    let mut j = 0;
    while j < t.len() {
        if let Tok::S(k) = &t[j] {
            if k == "note" && matches!(t.get(j + 1), Some(Tok::Colon)) {
                if let Some(Tok::S(v)) = t.get(j + 2) { note = v.clone(); }
            } else if k == "decisions" && matches!(t.get(j + 1), Some(Tok::Colon)) && matches!(t.get(j + 2), Some(Tok::Open)) {
                let mut m = j + 3;
                while m + 2 < t.len() {
                    match (&t[m], &t[m + 1], &t[m + 2]) {
                        (Tok::S(a), Tok::Colon, Tok::S(b)) => { dec.push((a.clone(), b.clone())); m += 3; }
                        _ => break,
                    }
                }
            }
        }
        j += 1;
    }
    (note, dec)
}
fn jesc(s: &str, out: &mut String) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""), '\\' => out.push_str("\\\\"), '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"), '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

// ---------------------------------------------------------------- layout (DIPs)
#[derive(Default, Clone, Copy)]
struct Lay {
    hdr_h: f32, cols_h: f32, list_top: f32, list_bot: f32, pill_x: f32, pill_w: f32, name_x: f32, name_w: f32,
    src_x: f32, src_w: f32, uses_x: f32, uses_w: f32, last_x: f32, last_w: f32, ctx_x: f32, ctx_w: f32,
    desc_x: f32, desc_w: f32, note: Rect, btn: Rect,
}
const PAD: f32 = 18.0;
const ROW_H: f32 = 36.0;

struct Triage {
    skills: Vec<Skill>,
    extras: Vec<(String, String)>,
    view: Vec<usize>,
    list: List,
    sort: usize,
    filter: String,
    hover_btn: bool,
    note: String,
    note_focus: bool,
    err: String,
    counts: [u32; 4],
    cw: f32, ch: f32,
    lay: Lay,
    unsaved: bool,
    status: String,
    status_kind: u8, // 0 info, 1 ok, 2 unsaved, 3 error
    save_path: String,
}

impl Triage {
    fn relayout(&mut self) {
        let (cw, ch) = (self.cw, self.ch);
        let mut l = Lay { hdr_h: 76.0, cols_h: 28.0, ..Default::default() };
        let foot_h = 92.0;
        l.list_top = l.hdr_h + l.cols_h;
        l.list_bot = (ch - foot_h).max(l.list_top);
        let mut x = PAD;
        l.pill_x = x; l.pill_w = 100.0; x += l.pill_w + 14.0;
        l.name_x = x; l.name_w = 270.0; x += l.name_w + 10.0;
        l.src_x = x; l.src_w = 118.0; x += l.src_w + 10.0;
        l.uses_x = x; l.uses_w = 46.0; x += l.uses_w + 20.0;
        l.last_x = x; l.last_w = 84.0; x += l.last_w + 18.0;
        l.ctx_x = x; l.ctx_w = 56.0; x += l.ctx_w + 24.0;
        l.desc_x = x; l.desc_w = cw - x - 24.0;
        let btn_w = 150.0;
        let note_y = ch - foot_h + 14.0;
        l.btn = rect(cw - PAD - btn_w, note_y, btn_w, 36.0);
        let note_x = PAD + 52.0;
        l.note = rect(note_x, note_y, l.btn.x - 12.0 - note_x, 36.0);
        self.lay = l;
        self.list.set_view(l.list_bot - l.list_top);
    }

    fn recount(&mut self) {
        self.counts = [0; 4];
        for s in &self.skills { self.counts[s.choice as usize] += 1; }
    }

    fn rebuild_view(&mut self) {
        let keep = self.view.get(self.list.sel).copied();
        let f = &self.filter;
        let sk = &self.skills;
        let mut v: Vec<usize> = (0..sk.len()).filter(|&i| f.is_empty() || sk[i].name_lc.contains(f.as_str())).collect();
        match self.sort {
            0 => v.sort_by(|&a, &b| (sk[a].uses, std::cmp::Reverse(sk[a].ctx), &sk[a].name).cmp(&(sk[b].uses, std::cmp::Reverse(sk[b].ctx), &sk[b].name))),
            1 => v.sort_by(|&a, &b| (std::cmp::Reverse(sk[a].last_days), &sk[a].name).cmp(&(std::cmp::Reverse(sk[b].last_days), &sk[b].name))),
            2 => v.sort_by(|&a, &b| (std::cmp::Reverse(sk[a].ctx), &sk[a].name).cmp(&(std::cmp::Reverse(sk[b].ctx), &sk[b].name))),
            4 => v.sort_by(|&a, &b| (&sk[a].source, &sk[a].name).cmp(&(&sk[b].source, &sk[b].name))),
            _ => v.sort_by(|&a, &b| sk[a].name.cmp(&sk[b].name)),
        }
        let sel = keep.and_then(|k| v.iter().position(|&i| i == k)).unwrap_or(0);
        self.view = v;
        self.list.set_len(self.view.len());
        self.list.sel = sel.min(self.view.len().saturating_sub(1));
        if !self.view.is_empty() { self.list.ensure_visible(self.list.sel); }
    }

    fn title(&self) -> String {
        let ch = self.counts[1] + self.counts[2] + self.counts[3];
        format!("Skill triage - {} skills, {} marked{}", self.skills.len(), ch, if self.unsaved { " *" } else { "" })
    }

    fn set_status(&mut self, kind: u8, s: &str) { self.status = s.to_string(); self.status_kind = kind; }
    fn touched(&mut self) { self.unsaved = true; self.set_status(2, "Unsaved changes"); }

    fn set_choice(&mut self, vi: usize, c: u8) {
        if let Some(&i) = self.view.get(vi) {
            if self.skills[i].choice != c { self.skills[i].choice = c; self.recount(); self.touched(); }
        }
    }
    fn cycle(&mut self, vi: usize, back: bool) {
        if let Some(&i) = self.view.get(vi) {
            let c = self.skills[i].choice;
            self.set_choice(vi, if back { (c + 3) % 4 } else { (c + 1) % 4 });
        }
    }

    // ---- persistence
    fn load_decisions(&mut self) {
        let Ok(txt) = read_text(&self.save_path) else { return };
        let (note, dec) = parse_decisions(&txt);
        self.note = note;
        let mut n = 0;
        for (k, v) in dec {
            let c = match v.as_str() { "name-only" => 1, "off" => 2, "remove" => 3, _ => 0 };
            if c == 0 { continue; }
            if let Some(s) = self.skills.iter_mut().find(|s| s.name == k) { s.choice = c; n += 1; } else { self.extras.push((k, v)); }
        }
        self.recount();
        self.set_status(0, &format!("Loaded {n} decisions"));
    }

    fn save(&mut self) {
        let mut o = String::from("{\n  \"saved_at\": ");
        jesc(&utc_iso(), &mut o);
        o.push_str(",\n  \"note\": ");
        jesc(&self.note, &mut o);
        o.push_str(",\n  \"decisions\": {");
        let mut first = true;
        let mut n = 0;
        let mut put = |k: &str, v: &str, o: &mut String| {
            o.push_str(if first { "\n    " } else { ",\n    " });
            first = false;
            jesc(k, o); o.push_str(": "); jesc(v, o);
        };
        for s in &self.skills { if s.choice != 0 { put(&s.name, CH_NAME[s.choice as usize], &mut o); n += 1; } }
        for (k, v) in &self.extras { put(k, v, &mut o); n += 1; }
        o.push_str(if first { "}\n}\n" } else { "\n  }\n}\n" });
        match write_atomic(&self.save_path, o) {
            Ok(_) => {
                self.unsaved = false;
                let (h, m, s) = local_hms();
                self.set_status(1, &format!("Saved {n} decisions  {h:02}:{m:02}:{s:02}"));
            }
            Err(e) => self.set_status(3, &format!("Save failed: {e}")),
        }
    }

    // ---- input
    fn on_char(&mut self, c: char) {
        if self.note_focus { self.note.push(c); self.touched(); return; }
        match c {
            '1'..='4' => { let s = self.list.sel; self.set_choice(s, c as u8 - b'1'); }
            'a'..='z' | 'A'..='Z' | '-' | '_' | '.' => { self.filter.push(c.to_ascii_lowercase()); self.rebuild_view(); }
            ' ' => { let s = self.list.sel; self.cycle(s, false); }
            _ => {}
        }
    }

    fn on_key(&mut self, k: u32, ctrl: bool) -> bool {
        if ctrl && k == b'S' as u32 { self.save(); return true; }
        let nf = self.note_focus;
        match k {
            key::F2 => self.note_focus = true,
            key::BACK => {
                if nf { if self.note.pop().is_some() { self.touched(); } }
                else if self.filter.pop().is_some() { self.rebuild_view(); }
            }
            key::ESC => {
                if nf { self.note_focus = false; } else if !self.filter.is_empty() { self.filter.clear(); self.rebuild_view(); }
            }
            key::ENTER => { if nf { self.note_focus = false; } else { let s = self.list.sel; self.cycle(s, false); } }
            key::TAB => { self.note_focus = false; self.sort = (self.sort + 1) % SORT_NAME.len(); self.rebuild_view(); }
            key::UP | key::DOWN => { self.note_focus = false; self.list.nav(k); }
            key::PAGE_UP | key::PAGE_DOWN => { self.list.nav(k); }
            key::HOME | key::END if !nf => { self.list.nav(k); }
            _ => return false,
        }
        true
    }

    fn on_click(&mut self, x: f32, y: f32, back: bool) {
        let l = self.lay;
        if l.btn.contains(x, y) && !back { self.save(); return; }
        if l.note.contains(x, y) { self.note_focus = true; return; }
        if y < l.hdr_h && y > l.hdr_h - 34.0 && x < 420.0 {
            self.sort = (self.sort + 1) % SORT_NAME.len(); self.rebuild_view(); return;
        }
        if y >= l.list_top && y < l.list_bot {
            if let Some(vi) = self.list.row_at(y - l.list_top) {
                self.note_focus = false;
                self.list.select(vi);
                if x >= l.pill_x && x < l.pill_x + l.pill_w + 8.0 { self.cycle(vi, back); }
            }
        }
    }

    fn on_move(&mut self, x: f32, y: f32) -> bool {
        let l = self.lay;
        let inside = y >= l.list_top && y < l.list_bot;
        let hc = self.list.hover_at(inside.then_some(y - l.list_top));
        let hb = l.btn.contains(x, y);
        let bc = hb != self.hover_btn;
        self.hover_btn = hb;
        hc || bc
    }
}

impl App for Triage {
    fn init(&mut self, cx: &mut Ctx) { cx.set_title(&self.title()); }

    fn event(&mut self, e: &Event, cx: &mut Ctx) {
        match *e {
            Event::Resize { w, h } => { self.cw = w; self.ch = h; self.relayout(); }
            Event::Key { key, mods } => if !self.on_key(key, mods.ctrl) { return },
            Event::Char(c) => self.on_char(c),
            Event::MouseDown { x, y, button } if button != Button::Middle => self.on_click(x, y, button == Button::Right),
            Event::MouseMove { x, y } => if !self.on_move(x, y) { return },
            Event::MouseLeave => { self.list.hover = None; self.hover_btn = false; }
            Event::Wheel { delta, .. } => self.list.wheel(delta),
            _ => return,
        }
        cx.set_title(&self.title());
        cx.redraw();
    }

    fn update(&mut self, dt: f32) -> bool { self.list.update(dt) }

    fn bench_step(&mut self, frame: usize, _cx: &mut Ctx) { self.list.bench_sweep(frame, 240) }

    fn close(&mut self, cx: &mut Ctx) -> bool {
        if !self.unsaved { return true; }
        match cx.ask("Save decisions before closing?") {
            Answer::Cancel => false,
            Answer::Yes => { self.save(); true }
            Answer::No => true,
        }
    }

    fn draw(&mut self, c: &mut Canvas) {
        let t = *c.theme();
        let l = self.lay;
        let (cw, chh) = (self.cw, self.ch);
        let px = c.px();
        c.clear(t.bg);

        // ---- rows (only the visible ones)
        if self.view.is_empty() {
            let msg = if !self.err.is_empty() { self.err.as_str() } else { "No skills match the filter" };
            c.text(msg, rect(PAD, l.list_top, cw - 2.0 * PAD, ROW_H * 2.0), BODY, Align::Left, t.dim);
        } else {
            c.clip(rect(0.0, l.list_top, cw, l.list_bot - l.list_top));
            let pill_h = ROW_H - 10.0;
            let tagw = 66.0;
            for (vi, y) in self.list.rows(l.list_top) {
                let sk = &self.skills[self.view[vi]];
                if vi == self.list.sel { c.fill(rect(0.0, y, cw, ROW_H), t.sel); }
                else if Some(vi) == self.list.hover { c.fill(rect(0.0, y, cw, ROW_H), t.hover); }
                c.hline(0.0, y + ROW_H - px, cw, t.div);
                let ch = sk.choice as usize;
                if ch != 0 { c.fill(rect(0.0, y + 4.0, 3.0, ROW_H - 8.0), CH_COL[ch]); }
                let py = y + (ROW_H - pill_h) / 2.0;
                let mixes = [0.13, 0.18, 0.18, 0.20];
                c.round(rect(l.pill_x, py, l.pill_w, pill_h), pill_h / 2.0, t.bg.mix(CH_COL[ch], mixes[ch]));
                c.text(CH_NAME[ch], rect(l.pill_x, py, l.pill_w, pill_h), BODY, Align::Center, CH_COL[ch]);
                c.text(&sk.name, rect(l.name_x, y, l.name_w, ROW_H), BOLD, Align::Left, t.text);
                c.text(&sk.source, rect(l.src_x, y, l.src_w, ROW_H), BODY, Align::Left, t.dim);
                c.text(&sk.uses_s, rect(l.uses_x, y, l.uses_w, ROW_H), BODY, Align::Right, if sk.uses == 0 { t.faint } else { t.text });
                c.text(&sk.last, rect(l.last_x, y, l.last_w, ROW_H), BODY, Align::Left, if sk.last_days == i32::MAX { t.faint } else { t.dim });
                let cc = if sk.ctx == 0 { t.faint } else if sk.ctx >= 200 { CH_COL[1] } else if sk.ctx >= 100 { t.text } else { t.dim };
                c.text(&sk.ctx_s, rect(l.ctx_x, y, l.ctx_w, ROW_H), BODY, Align::Right, cc);
                let mut dx = l.desc_x;
                if sk.user_only {
                    let th = pill_h - 8.0;
                    let ty = y + (ROW_H - th) / 2.0;
                    c.round(rect(dx, ty, tagw, th), th / 2.0, TAG);
                    c.text("user-only", rect(dx, ty, tagw, th), SMALL, Align::Center, t.dim);
                    dx += tagw + 10.0;
                }
                c.text(&sk.desc, rect(dx, y, (l.desc_x + l.desc_w - dx).max(1.0), ROW_H), BODY, Align::Left, t.faint);
            }
            self.list.scrollbar(c, cw - 10.0, l.list_top, 5.0, t.thumb);
            c.unclip();
        }

        // ---- header
        c.fill(rect(0.0, 0.0, cw, l.hdr_h), t.panel);
        c.hline(0.0, l.hdr_h - px, cw, t.div);
        c.text("Skill triage", rect(PAD, 8.0, 200.0, 34.0), TITLE, Align::Left, t.text);
        let mut x = PAD + 190.0;
        for i in 0..4 {
            let col = if self.counts[i] == 0 && i != 0 { t.faint } else { CH_COL[i] };
            c.text(&format!("{} {}", CH_NAME[i], self.counts[i]), rect(x, 8.0, 140.0, 34.0), BOLD, Align::Left, col);
            x += 138.0;
        }
        let st = c.stats();
        let fs = if st.active { format!("{:.0} fps", st.fps) } else if st.fps > 0.0 { format!("idle - last {:.0} fps", st.fps) } else { "idle".into() };
        let fc = if !st.active { t.faint } else if st.fps >= 110.0 { CH_COL[0] } else { CH_COL[1] };
        c.text(&fs, rect(cw - 220.0 - PAD, 8.0, 220.0, 30.0), SMALL, Align::Right, fc);
        let y2 = l.hdr_h - 34.0;
        c.text(&format!("Sort (Tab): {}", SORT_NAME[self.sort]), rect(PAD, y2, 300.0, 30.0), BODY, Align::Left, t.dim);
        let fx = PAD + 320.0;
        c.text("Filter:", rect(fx, y2, 60.0, 30.0), BODY, Align::Left, t.faint);
        let (ft, fcol) = if self.filter.is_empty() { ("type to filter", t.faint) } else { (self.filter.as_str(), t.accent) };
        c.text(ft, rect(fx + 58.0, y2, 300.0, 30.0), BOLD, Align::Left, fcol);
        c.text(&format!("{} of {}", self.view.len(), self.skills.len()), rect(cw - 220.0 - PAD, y2, 220.0, 30.0), BODY, Align::Right, t.dim);

        // ---- column heads
        let (hy, hh) = (l.hdr_h, l.cols_h);
        c.fill(rect(0.0, hy, cw, hh), t.panel2);
        c.hline(0.0, hy + hh - px, cw, t.div);
        let heads = [(l.pill_x, l.pill_w, Align::Center), (l.name_x, l.name_w, Align::Left), (l.src_x, l.src_w, Align::Left),
            (l.uses_x, l.uses_w, Align::Right), (l.last_x, l.last_w, Align::Left), (l.ctx_x, l.ctx_w, Align::Right), (l.desc_x, l.desc_w, Align::Left)];
        for (i, (hx, hw, al)) in heads.into_iter().enumerate() { c.text(COLS[i], rect(hx, hy, hw, hh), SMALL, al, t.faint); }

        // ---- footer
        let fy = l.list_bot;
        c.fill(rect(0.0, fy, cw, chh - fy), t.panel);
        c.hline(0.0, fy, cw, t.div);
        let n = l.note;
        c.text("Note", rect(PAD, n.y, 48.0, n.h), BODY, Align::Left, t.dim);
        c.round(n, 8.0, t.field);
        let inner = rect(n.x + 12.0, n.y, n.w - 24.0, n.h);
        if self.note_focus {
            c.text(&format!("{}|", self.note), inner, BODY, Align::Tail, t.text);
            c.fill(rect(n.x + 8.0, n.y + n.h - 2.0, n.w - 16.0, 2.0), t.accent);
        } else if self.note.is_empty() {
            c.text(NOTE_HINT, inner, BODY, Align::Left, t.faint);
        } else {
            c.text(&self.note, inner, BODY, Align::Left, t.text);
        }
        let bb = if self.hover_btn { t.accent.mix(WHITE, 0.15) } else { t.accent };
        c.round(l.btn, 8.0, bb);
        c.text("Save  (Ctrl+S)", l.btn, BOLD, Align::Center, t.on_accent);
        let hy2 = n.y + n.h + 10.0;
        c.text(HINT, rect(PAD, hy2, cw - 2.0 * PAD - 330.0, 24.0), SMALL, Align::Left, t.faint);
        let sc = match self.status_kind { 1 => CH_COL[0], 2 => CH_COL[1], 3 => CH_COL[3], _ => t.dim };
        c.text(&self.status, rect(cw - PAD - 320.0, hy2, 320.0, 24.0), BODY, Align::Right, sc);
    }
}

fn main() {
    let bench = fastwin::bench_requested();
    let tsv = fastwin::app_args().into_iter().next()
        .unwrap_or_else(|| exe_dir().join("skills.tsv").to_string_lossy().into_owned());
    let data_dir = std::path::Path::new(&tsv).parent().map(|p| p.to_path_buf()).unwrap_or_else(exe_dir);
    let mut list = List::new(ROW_H);
    list.pad = 6.0;
    let mut app = Triage {
        skills: Vec::new(), extras: Vec::new(), view: Vec::new(), list, sort: 0, filter: String::new(),
        hover_btn: false, note: String::new(), note_focus: false, err: String::new(), counts: [0; 4],
        cw: 1.0, ch: 1.0, lay: Lay::default(), unsaved: false, status: String::new(), status_kind: 0,
        save_path: data_dir.join("decisions.json").to_string_lossy().into_owned(),
    };
    match load_tsv(&tsv) { Ok(v) => app.skills = v, Err(e) => app.err = e }
    if bench {
        for (i, s) in app.skills.iter_mut().enumerate() { s.choice = (i % 4) as u8; }
    } else {
        app.load_decisions();
    }
    app.recount();
    app.rebuild_view();
    let cfg = Config { title: "Skill triage".into(), size: (1400.0, 900.0), min_size: (760.0, 480.0), ..Default::default() };
    run(cfg, app);
}
