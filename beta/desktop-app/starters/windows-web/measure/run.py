"""Measure the app in its development shell: start-up, displayed frames, memory, idle CPU.

Needs PresentMon (the Intel PresentMon service and PresentMonCli.exe) and a built page (pnpm build).
The window opens on the primary display without taking focus. Run it only when the owner has said
the machine is free: a covered or occluded Chromium window stops rendering, and the numbers are
only about the display the window is on.

Timeline for a full run (seconds after the page's first frame):
  12   screenshot of the window
  15   memory snapshot "launch"
  16   idle CPU over 10 s
  30   the workload starts inside the page (measure/workload.js waits until then)
  32   PresentMon capture of the GPU process, started two seconds into the list scroll, for 7 s
  +3   memory snapshot "after workload"
  +idle  memory snapshot "idle"
Start-up runs (--startup N) launch N times and record launch to first frame after load.

PresentMon service quirks this timeline works around (seen on Windows 11, PresentMon 2.x, Chromium 140s):
  - Capture the GPU process, not the main process: Chromium presents from its GPU process.
  - A capture that starts while the window is idle records nothing, whether or not frames are
    presented. Start it after motion has begun. So presents-while-idle cannot be measured this way;
    idle CPU near zero is the evidence instead.
  - A capture that follows another capture of the same process comes back empty. One capture per launch.
  - After a pause in rendering the service stops seeing the presents. Capture one continuous phase
    (the list scroll); the palette and typing phases have only the in-page frame clock.
  - The in-page frame clock is the compositor's schedule, not proof of display. Report the two apart.
"""
from __future__ import annotations

import argparse
import json
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PRESENTMON = r"C:\Program Files\Intel\PresentMon\PresentMonApplication\PresentMonCli.exe"
ELECTRON = ROOT / "node_modules" / "electron" / "dist" / "electron.exe"
CONFIG = json.loads((ROOT / "app.config.json").read_text(encoding="utf-8"))

sys.path.insert(0, str(HERE))
from analyze import summarize  # noqa: E402


def powershell(script: str) -> str:
    done = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
        capture_output=True, text=True, timeout=120,
    )
    return done.stdout.strip()


TREE = r"""
$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId
$ids = [System.Collections.Generic.List[int]]::new(); $ids.Add(%d)
for ($i = 0; $i -lt $ids.Count; $i++) {
  $all | Where-Object { $_.ParentProcessId -eq $ids[$i] -and -not $ids.Contains([int]$_.ProcessId) } | ForEach-Object { $ids.Add([int]$_.ProcessId) }
}
$p = Get-Process -Id $ids -ErrorAction SilentlyContinue
$gpu = @(Get-CimInstance Win32_Process | Where-Object { $ids.Contains([int]$_.ProcessId) -and $_.CommandLine -match '--type=gpu-process' } | ForEach-Object { [int]$_.ProcessId })
[pscustomobject]@{
  gpu = $gpu
  processes = $p.Count
  privateMB = [math]::Round(($p | Measure-Object PrivateMemorySize64 -Sum).Sum / 1MB, 1)
  workingSetMB = [math]::Round(($p | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 1)
  cpuSeconds = [math]::Round(($p | Measure-Object -Property CPU -Sum).Sum, 2)
} | ConvertTo-Json -Compress
"""

SHOT = r"""
Add-Type @'
using System; using System.Runtime.InteropServices;
public class W { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  public struct RECT { public int L, T, R, B; } }
'@
[W]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Drawing
$h = (Get-Process -Id %d).MainWindowHandle
$r = New-Object W+RECT; [W]::GetWindowRect($h, [ref]$r) | Out-Null
$bmp = New-Object System.Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
$bmp.Save('%s'); "$($r.R - $r.L)x$($r.B - $r.T)"
"""


def tree(pid: int) -> dict:
    text = powershell(TREE % pid)
    return json.loads(text) if text else {}


def launch(marks: Path, data: Path, scenario: Path | None, exit_after: int) -> tuple[subprocess.Popen, float]:
    """Start the development shell with its own data folder, so it never meets an installed copy."""
    if marks.exists():
        marks.unlink()
    cmd = [str(ELECTRON), ".", "--no-activate", f"--data-dir={data}", f"--qa-marks={marks}", f"--qa-exit-after={exit_after}"]
    if scenario:
        cmd.append(f"--qa-bench={scenario}")
    t0 = time.time() * 1000.0
    return subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL), t0


def read_marks(marks: Path) -> dict:
    try:
        return json.loads(marks.read_text(encoding="utf-8"))["marks"]
    except (OSError, ValueError, KeyError):
        return {}


def first_frame(marks: Path, timeout: float = 60.0) -> float | None:
    """Epoch ms of the first frame after load, as stamped by the page."""
    end = time.time() + timeout
    while time.time() < end:
        m = read_marks(marks)
        if "firstFrameAfterLoad" in m:
            return float(m["firstFrameAfterLoad"])
        time.sleep(0.02)
    return None


def startup(out: Path, data: Path, runs: int) -> dict:
    times = []
    for i in range(runs):
        marks = out / f"startup-{i}.json"
        proc, t0 = launch(marks, data, None, 6)
        frame = first_frame(marks, 30)
        times.append(round(frame - t0, 1) if frame else None)
        proc.wait(timeout=30)
        time.sleep(2)
    good = [t for t in times if t is not None]
    return {"runsMs": times, "medianMs": statistics.median(good) if good else None, "note": "warm starts of the development shell"}


def full(out: Path, data: Path, scenario: Path, idle: int, workload: int) -> dict:
    marks = out / "marks.json"
    for old in out.glob("frames*.csv"):
        old.unlink()
    proc, t0 = launch(marks, data, scenario, 30 + workload + idle + 40)
    frame = first_frame(marks, 60)
    if frame is None:
        proc.kill()
        raise SystemExit("The page never reported a first frame. Is dist/ built?")
    result: dict = {"launchToFirstFrameMs": round(frame - t0, 1), "display": read_marks(marks).get("display")}
    hz = float((result["display"] or {}).get("hz") or 60)
    at = lambda s: time.sleep(max(0.0, (frame / 1000.0 + s) - time.time()))  # noqa: E731
    at(12)
    result["screenshot"] = powershell(SHOT % (proc.pid, str(out / "window.png")))
    at(15)
    result["memoryLaunch"] = tree(proc.pid)
    gpu = (result["memoryLaunch"].get("gpu") or [proc.pid])[0]
    at(16)
    cpu0 = tree(proc.pid).get("cpuSeconds")
    time.sleep(10)
    result["idleCpuSeconds10s"] = round((tree(proc.pid).get("cpuSeconds") or 0) - (cpu0 or 0), 2)
    at(32)
    subprocess.Popen(
        [PRESENTMON, "--process_id", str(gpu), "--output_file", str(out / "frames.csv"), "--timed", "7"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    ).wait(timeout=60)
    captures = []
    for path in sorted(out.glob("frames*.csv")):
        try:
            captures.append(summarize(str(path), hz))
        except Exception as error:  # an empty capture is a finding, not a crash
            captures.append({"file": str(path), "presents": 0, "note": str(error)})
    result["listScrollDisplayed"] = captures
    at(30 + workload + 3)
    result["memoryAfterWork"] = tree(proc.pid)
    time.sleep(idle)
    result["memoryIdle"] = tree(proc.pid)
    result["idleSeconds"] = idle
    result["page"] = read_marks(marks).get("bench")
    result["pageError"] = read_marks(marks).get("benchError")
    budget, ceiling = CONFIG["memory"]["budgetMB"], CONFIG["memory"]["ceilingMB"]
    peak = max((result[k].get("privateMB") or 0) for k in ("memoryLaunch", "memoryAfterWork", "memoryIdle"))
    result["memoryVerdict"] = {"budgetMB": budget, "ceilingMB": ceiling, "idleWithinBudget": (result["memoryIdle"].get("privateMB") or 0) <= budget, "peakUnderCeiling": peak <= ceiling}
    proc.wait(timeout=120)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=HERE / "out")
    parser.add_argument("--scenario", type=Path, default=HERE / "workload.js")
    parser.add_argument("--startup", type=int, default=0, help="only measure start-up, this many launches")
    parser.add_argument("--idle", type=int, default=300, help="seconds to sit idle before the last memory snapshot")
    parser.add_argument("--workload", type=int, default=18, help="seconds the scenario runs after its 30 s wait")
    args = parser.parse_args()
    if not ELECTRON.exists() or not (ROOT / "dist" / "index.html").exists():
        raise SystemExit("Run pnpm install and pnpm build first.")
    if not args.startup and not Path(PRESENTMON).exists():
        raise SystemExit(f"PresentMon was not found at {PRESENTMON}.")
    args.out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="measure-data-") as data:
        if args.startup:
            result, name = {"startup": startup(args.out, Path(data), args.startup)}, "startup.json"
        else:
            result, name = full(args.out, Path(data), args.scenario.resolve(), args.idle, args.workload), "result.json"
    (args.out / name).write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
