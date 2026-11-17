//! hello: the smallest useful fastwin app. A scrollable 1,000-row list and a click counter.
#![windows_subsystem = "windows"]

use fastwin::{rect, run, Align, App, Canvas, Config, Ctx, Event, Font, List};

const TOP: f32 = 56.0; // header height in DIPs
const BODY: Font = Font::new(15.0);
const TITLE: Font = Font::new(20.0).bold();

struct Hello { list: List, rows: Vec<String>, clicks: u32 }

impl App for Hello {
    fn event(&mut self, e: &Event, cx: &mut Ctx) {
        match *e {
            Event::Resize { h, .. } => self.list.set_view(h - TOP),
            Event::Wheel { delta, .. } => self.list.wheel(delta),
            Event::MouseMove { y, .. } => if !self.list.hover_at(Some(y - TOP)) { return },
            Event::MouseLeave => { self.list.hover = None; }
            Event::MouseDown { y, .. } => match self.list.row_at(y - TOP) {
                Some(i) => { self.list.select(i); self.clicks += 1; }
                None => return,
            },
            Event::Key { key: k, .. } => if !self.list.nav(k) { return },
            _ => return,
        }
        cx.redraw();
    }

    fn update(&mut self, dt: f32) -> bool { self.list.update(dt) }

    fn draw(&mut self, c: &mut Canvas) {
        let t = *c.theme();
        let (w, h) = c.size();
        c.clear(t.bg);
        c.clip(rect(0.0, TOP, w, h - TOP));
        for (i, y) in self.list.rows(TOP) {
            let row = rect(0.0, y, w, self.list.row_h);
            if i == self.list.sel { c.fill(row, t.sel) } else if Some(i) == self.list.hover { c.fill(row, t.hover) }
            c.hline(0.0, y + self.list.row_h - c.px(), w, t.div);
            c.text(&self.rows[i], rect(18.0, y, w - 160.0, self.list.row_h), BODY, Align::Left, t.text);
            c.text(&format!("#{i}"), rect(w - 140.0, y, 110.0, self.list.row_h), BODY, Align::Right, t.faint);
        }
        self.list.scrollbar(c, w - 10.0, TOP, 5.0, t.thumb);
        c.unclip();
        c.fill(rect(0.0, 0.0, w, TOP), t.panel);
        c.hline(0.0, TOP - c.px(), w, t.div);
        c.text("Hello, fastwin", rect(18.0, 0.0, 300.0, TOP), TITLE, Align::Left, t.text);
        let s = c.stats();
        let info = format!("clicks {}   {}", self.clicks, if s.active { format!("{:.0} fps", s.fps) } else { "idle".into() });
        c.text(&info, rect(w - 318.0, 0.0, 300.0, TOP), BODY, Align::Right, t.dim);
    }

    fn bench_step(&mut self, frame: usize, _cx: &mut Ctx) { self.list.bench_sweep(frame, 240) }
}

fn main() {
    let rows: Vec<String> = (0..1000).map(|i| format!("Row {i}  -  click me, scroll me, arrow keys work too")).collect();
    let mut list = List::new(36.0);
    list.set_len(rows.len());
    run(Config { title: "Hello, fastwin".into(), size: (720.0, 560.0), ..Default::default() }, Hello { list, rows, clicks: 0 });
}
