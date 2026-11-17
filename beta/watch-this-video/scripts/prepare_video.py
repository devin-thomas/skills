#!/usr/bin/env python3
"""Prepare a locally accessible video for evidence-led analysis, using local Whisper."""
from __future__ import annotations

import argparse
import hashlib
import importlib
import importlib.metadata
import importlib.util
import json
import math
import os
import platform
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from dataclasses import asdict
from pathlib import Path


def run(argv: list[str]) -> str:
    result = subprocess.run(argv, capture_output=True, text=True, check=False)
    if result.returncode:
        detail = (result.stderr or result.stdout).strip()[-2000:]
        raise RuntimeError(f"{argv[0]} failed (exit {result.returncode}): {detail}")
    return result.stdout


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def select_backend(requested: str, cpp_model: str | None) -> str:
    if requested == "faster-whisper":
        if importlib.util.find_spec("faster_whisper") is None:
            raise RuntimeError(f"faster-whisper is not installed in {sys.executable}; use the existing ASR environment")
        return requested
    if requested == "openai":
        if not shutil.which("whisper"):
            raise RuntimeError("Local OpenAI Whisper CLI not found on PATH")
        return requested
    if requested == "cpp":
        if not shutil.which("whisper-cli") or not cpp_model or not Path(cpp_model).is_file():
            raise RuntimeError("whisper.cpp needs whisper-cli and --cpp-model PATH")
        return requested
    if shutil.which("whisper"):
        return "openai"
    if shutil.which("whisper-cli") and cpp_model and Path(cpp_model).is_file():
        return "cpp"
    raise RuntimeError("No local Whisper CLI found; use --backend faster-whisper in the existing ASR environment, or provide whisper/whisper-cli --cpp-model")


def transcribe_faster(audio: Path, out: Path, opts: argparse.Namespace) -> dict:
    # A CUDA torch wheel supplies CUDA DLLs. Load it before CTranslate2 on Windows.
    if sys.platform == "win32" and importlib.util.find_spec("torch") is not None:
        torch = importlib.import_module("torch")
        dlls = Path(torch.__file__).parent / "lib"
        os.environ["PATH"] = str(dlls) + os.pathsep + os.environ.get("PATH", "")
    faster = importlib.import_module("faster_whisper")
    model = faster.WhisperModel(
        opts.model, device=opts.device or "auto", compute_type=opts.compute_type or "default",
        local_files_only=opts.local_files_only,
    )
    prompt = opts.initial_prompt_file.read_text(encoding="utf-8") if opts.initial_prompt_file else None
    segments, info = model.transcribe(
        str(audio), language=opts.language, word_timestamps=True, beam_size=5,
        vad_filter=True, initial_prompt=prompt,
    )
    # The iterator performs inference lazily; consume it before writing a success artifact.
    raw_segments = [asdict(segment) for segment in segments]
    raw = {
        "text": "".join(segment["text"] for segment in raw_segments),
        "language": info.language, "language_probability": info.language_probability,
        "duration": info.duration, "segments": raw_segments,
    }
    (out / "audio.json").write_text(json.dumps(raw, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (out / "audio.txt").write_text(raw["text"] + "\n", encoding="utf-8")
    return {
        "model": opts.model, "package_version": importlib.metadata.version("faster-whisper"),
        "device": model.model.device, "compute_type": model.model.compute_type,
        "local_files_only": opts.local_files_only,
        "language_detected": info.language, "beam_size": 5,
        "vad_filter": True, "word_timestamps": True,
    }


def probe(path: Path) -> dict:
    return json.loads(run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)]))


def frame_interval(duration: float, requested: int, max_frames: int) -> int:
    return max(requested, math.ceil(duration / max_frames)) if duration > 0 else requested


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Local video or audio file; acquire URLs separately")
    parser.add_argument("--out", required=True, type=Path, help="New, empty run directory")
    parser.add_argument("--source-url", default=None)
    parser.add_argument("--source-title", default=None, help="Original source title (never the analysis title)")
    parser.add_argument("--model", default="medium", help="OpenAI/faster-whisper model name or supported local model path; default medium")
    parser.add_argument("--backend", choices=("auto", "openai", "cpp", "faster-whisper"), default="auto", help="Auto preserves CLI selection; use faster-whisper explicitly with its Python environment")
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), help="faster-whisper device (default auto)")
    parser.add_argument("--compute-type", help="faster-whisper compute type (default backend's default)")
    parser.add_argument("--local-files-only", action="store_true", help="faster-whisper: require an already cached/local model")
    parser.add_argument("--cpp-model", default=None, help="Local GGML model file for whisper.cpp")
    parser.add_argument("--language", default=None, help="Speech language; autodetect if omitted")
    parser.add_argument("--initial-prompt-file", type=Path, default=None, help="Verified glossary, not guesses")
    parser.add_argument("--frame-seconds", type=int, default=45)
    parser.add_argument("--max-frames", type=int, default=240)
    opts = parser.parse_args(argv)
    source = opts.input.expanduser().resolve()
    out = opts.out.expanduser().resolve()
    if not source.is_file():
        parser.error(f"Input file missing: {source}")
    if opts.frame_seconds < 1 or opts.max_frames < 1:
        parser.error("--frame-seconds and --max-frames must be positive")
    if out.exists() and (not out.is_dir() or any(out.iterdir())):
        parser.error(f"Output must be a new or empty directory: {out}; use a fresh directory")
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        parser.error("Local ffmpeg and ffprobe must be on PATH")
    if opts.initial_prompt_file is not None and not opts.initial_prompt_file.is_file():
        parser.error("--initial-prompt-file does not exist")

    info = probe(source)
    streams = info.get("streams", [])
    has_audio = any(item.get("codec_type") == "audio" for item in streams)
    has_video = any(item.get("codec_type") == "video" and not item.get("disposition", {}).get("attached_pic") for item in streams)
    duration = float(info.get("format", {}).get("duration", 0) or 0)
    if not has_audio and not has_video:
        raise RuntimeError("No usable audio or video stream")
    backend = select_backend(opts.backend, opts.cpp_model) if has_audio else None
    if backend != "faster-whisper" and (opts.device is not None or opts.compute_type is not None or opts.local_files_only):
        parser.error("--device, --compute-type and --local-files-only require --backend faster-whisper with audio")
    if backend == "cpp" and opts.initial_prompt_file:
        parser.error("--initial-prompt-file is supported by openai and faster-whisper, not this cpp adapter")
    out.mkdir(parents=True, exist_ok=True)
    transcript_status = "no_audio"
    execution = {
        "host": platform.node(), "platform": platform.platform(), "python": sys.executable,
        "language_requested": opts.language,
        "prompt_sha256": file_hash(opts.initial_prompt_file) if opts.initial_prompt_file else None,
    }
    if has_audio:
        audio = out / "audio.wav"
        run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(audio)])
        if backend == "faster-whisper":
            execution.update(transcribe_faster(audio, out, opts))
        elif backend == "openai":
            cmd = ["whisper", str(audio), "--model", opts.model, "--output_dir", str(out), "--output_format", "all", "--verbose", "False", "--word_timestamps", "True", "--task", "transcribe"]
            if opts.language:
                cmd.extend(["--language", opts.language])
            if opts.initial_prompt_file:
                cmd.extend(["--initial_prompt", opts.initial_prompt_file.read_text(encoding="utf-8")[:1000]])
            run(cmd)
            if not (out / "audio.json").is_file():
                raise RuntimeError("Whisper did not produce audio.json")
            execution.update({"model": opts.model, "device": None, "compute_type": None})
        else:
            cmd = ["whisper-cli", "-m", str(Path(opts.cpp_model).resolve()), "-f", str(audio), "-oj", "-of", str(out / "audio")]
            if opts.language:
                cmd.extend(["-l", opts.language])
            run(cmd)
            if not (out / "audio.json").is_file():
                raise RuntimeError("whisper.cpp did not produce audio.json")
            execution.update({"model": str(Path(opts.cpp_model).resolve()), "device": None, "compute_type": None})
        transcript_status = "local_whisper_raw_needs_correction"

    interval = frame_interval(duration, opts.frame_seconds, opts.max_frames)
    sampled_frames: list[dict] = []
    if has_video:
        frames = out / "frames"
        frames.mkdir(exist_ok=True)
        run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source), "-vf", f"fps=1/{interval},scale=960:-2", "-frames:v", str(opts.max_frames), "-q:v", "3", str(frames / "frame-%05d.jpg")])
        for i, path in enumerate(sorted(frames.glob("frame-*.jpg"))):
            sampled_frames.append({"file": str(path.relative_to(out)), "nominal_second": i * interval, "timestamp_verified": False})
        (frames / "index.json").write_text(json.dumps(sampled_frames, indent=2) + "\n", encoding="utf-8")

    metadata = {
        "schema": "watch-this-video-preparation/v1",
        "prepared_utc": datetime.now(timezone.utc).isoformat(),
        "source": {"local_path": str(source), "sha256": file_hash(source), "url": opts.source_url, "original_title": opts.source_title or source.stem},
        "probe": info,
        "duration_seconds": duration,
        "has_audio": has_audio,
        "has_video": has_video,
        "transcription_backend": backend,
        "execution": execution,
        "transcription_status": transcript_status,
        "frame_interval_seconds": interval if has_video else None,
        "frame_count": len(sampled_frames),
        "frame_time_note": "nominal only; verify exact times by seeking the source video",
        "analysis_status": "NOT_DONE: audio/frames need human or vision-capable agent review and glossary correction",
    }
    (out / "preparation.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"prepared": str(out), "transcript": transcript_status, "frames": len(sampled_frames)}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
