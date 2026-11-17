"""Summarize a PresentMon CSV: displayed-frame cadence against the display period.

Usage: python measure/analyze.py <capture.csv> [display Hz]. A late frame is one displayed more than 1.5 periods after the last.
"""
import csv, json, sys, statistics

def pct(v, p):
    return v[min(len(v) - 1, int(p / 100 * len(v)))]

def summarize(path, hz=119.0):
    period = 1000.0 / hz
    rows = list(csv.DictReader(open(path, newline="", encoding="utf-8-sig")))
    disp = sorted(float(r["msBetweenDisplayChange"]) for r in rows
                  if r.get("msBetweenDisplayChange") not in (None, "", "NA") and float(r["msBetweenDisplayChange"]) > 0)
    pres = sorted(float(r["msBetweenPresents"]) for r in rows if float(r["msBetweenPresents"]) > 0)
    dropped = sum(1 for r in rows if r.get("Dropped") not in ("0", "", None))
    modes = {}
    for r in rows:
        modes[r["PresentMode"]] = modes.get(r["PresentMode"], 0) + 1
    span = float(rows[-1]["TimeInSeconds"]) - float(rows[0]["TimeInSeconds"]) if len(rows) > 1 else 0.0
    out = {"file": path, "presents": len(rows), "displayed": len(disp), "dropped": dropped, "seconds": round(span, 2),
           "presentModes": modes, "periodMs": round(period, 3)}
    if disp:
        late = sum(1 for x in disp if x > 1.5 * period)
        out.update({
            "displayedFps": round(len(disp) / span, 1) if span else None,
            "p50": round(pct(disp, 50), 3), "p95": round(pct(disp, 95), 3), "p99": round(pct(disp, 99), 3),
            "max": round(disp[-1], 3), "latePct": round(100.0 * late / len(disp), 2), "lateFrames": late,
            # Premium-bar rule 25 as corrected: at most 1 late frame per 1,000 and p99 within 5% of the refresh interval.
            "pass": abs(pct(disp, 50) - period) < 0.3 and pct(disp, 99) <= 1.05 * period and late * 1000 <= len(disp),
        })
    if pres:
        out["presentP50"] = round(pct(pres, 50), 3)
    return out

if __name__ == "__main__":
    hz = float(sys.argv[2]) if len(sys.argv) > 2 else 119.0
    print(json.dumps(summarize(sys.argv[1], hz), indent=2))
