//! `--bench`: present 120 warm-up + 600 measured frames back to back and write bench.txt next to the exe.

use crate::host::{pump, App, Host};
use crate::sys::*;

const WARM: usize = 120;
const FRAMES: usize = 600;

pub(crate) unsafe fn run<A: App>(host: &mut Host<A>, title: &str) {
    let f = qpf() as f64;
    let mut frame_ms: Vec<f64> = Vec::with_capacity(FRAMES);
    let mut cpu_ms: Vec<f64> = Vec::with_capacity(FRAMES);
    let mut prev = qpc();
    let mut last_t0 = 0i64;
    host.stats.active = true;
    for i in 0..(WARM + FRAMES) {
        if !pump() { break; }
        // Wait until the swap chain can accept the next frame (this is the vsync pacing); a slower
        // display is paced by its vblank alone, in pace().
        loop {
            let wait = if host.vblank_paced() { 0 } else { host.wait_handle() };
            if wait == 0 { break; }
            if MsgWaitForMultipleObjectsEx(1, &wait, 1000, QS_ALLINPUT, MWMO_INPUTAVAILABLE) != 1 { break; }
            pump();
        }
        host.pace();
        let t0 = qpc();
        let dt = if last_t0 == 0 { 1.0 / 120.0 } else { ((t0 - last_t0) as f64 / f) as f32 };
        last_t0 = t0;
        host.app.bench_step(i, &mut host.cx);
        host.app.update(dt);
        host.render();
        let t1 = qpc();
        if i >= WARM {
            let ms = (t0 - prev) as f64 / f * 1000.0;
            frame_ms.push(ms);
            cpu_ms.push((t1 - t0) as f64 / f * 1000.0);
            let n = frame_ms.len().min(60);
            host.stats.fps = (n as f64 / (frame_ms[frame_ms.len() - n..].iter().sum::<f64>() / 1000.0)) as f32;
        }
        prev = t0;
    }
    if frame_ms.is_empty() { DestroyWindow(host.cx.hwnd); return; }
    let total: f64 = frame_ms.iter().sum();
    let avg_fps = frame_ms.len() as f64 / (total / 1000.0);
    let mut sorted = frame_ms.clone();
    sorted.sort_by(|x, y| x.partial_cmp(y).unwrap());
    let k = (sorted.len() / 100).max(1);
    let low1 = 1000.0 / (sorted[sorted.len() - k..].iter().sum::<f64>() / k as f64);
    let worst = 1000.0 / sorted[sorted.len() - 1];
    let median = sorted[sorted.len() / 2];
    let hitches: Vec<String> = frame_ms.iter().enumerate().filter(|(_, &x)| x > 1.5 * median)
        .map(|(i, x)| format!("#{i}={x:.1}ms")).collect();
    cpu_ms.sort_by(|x, y| x.partial_cmp(y).unwrap());
    let cpu_avg = cpu_ms.iter().sum::<f64>() / cpu_ms.len() as f64;
    let cpu_p99 = cpu_ms[(cpu_ms.len() * 99 / 100).min(cpu_ms.len() - 1)];
    let cpu_max = cpu_ms[cpu_ms.len() - 1];
    let mut pmc: PMC = std::mem::zeroed();
    pmc.cb = std::mem::size_of::<PMC>() as u32;
    K32GetProcessMemoryInfo(GetCurrentProcess(), &mut pmc, pmc.cb);
    let exe = std::env::current_exe().ok();
    let exe_kb = exe.as_ref().and_then(|p| std::fs::metadata(p).ok()).map_or(0, |m| m.len()) / 1024;
    let mb = |b: usize| b as f64 / 1_048_576.0;
    let disp = host.cx.placed.as_ref().map_or_else(|| "unknown".to_string(), |p| p.describe());
    let pacing = if host.vblank_paced() { "latency waitable + vblank of this display (slower than the fastest one)" } else { "latency waitable" };
    let out = format!(
        "app: {title}\nexe size: {exe_kb} KB\ndisplay: {disp}\nfocus: never taken (no-focus mode)\npacing: {pacing}\nframes: {}\nclient: {}x{} px  dpi scale: {:.2}\n\
         median frame time: {median:.2} ms ({:.1} Hz)\navg fps: {avg_fps:.1}\n1% low fps: {low1:.1}\nworst frame fps: {worst:.1}\n\
         hitches (frame time > 1.5x median): {}\nrender cpu ms (draw + Present): avg {cpu_avg:.2}  p99 {cpu_p99:.2}  max {cpu_max:.2}\n\
         peak working set: {:.2} MB\nfinal working set: {:.2} MB\nprivate commit: {:.2} MB\nhitch frames: {}\n",
        frame_ms.len(), host.pw, host.ph, host.cx.scale, 1000.0 / median, hitches.len(),
        mb(pmc.peak_ws), mb(pmc.ws), mb(pmc.pagefile), hitches.join(" "),
    );
    let _ = std::fs::write(crate::file::exe_dir().join("bench.txt"), out);
    DestroyWindow(host.cx.hwnd);
}
