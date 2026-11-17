# Hosts and existing research workspaces

Read when the work spans more than one machine, or when earlier video research may already exist. These are discovery steps, not guarantees of current capacity or installed software. Probe before choosing a route; leave existing archives and environments intact.

## Find prior evidence first

Search the relevant collection's filenames and metadata for the exact video ID or canonical URL, then inspect matching records. Avoid dumping whole transcript collections into context. Use SQLite/FTS when the collection already has an index.

Typical places to look: the project's own media and research folders (often `source/` plus `work/audio/`, `work/transcripts/` and `work/frames/`, keyed by source ID), creator transcript collections with metadata and glossaries, and historical research exports. Treat exports and backups as leads, then verify identity and provenance against the owning source.

Reuse sources in place and put new derivatives in the relevant project's ignored workspace or outside its repository. A collection's Markdown or database record can locate evidence; it does not prove that local ASR or visual review occurred. Record the exact raw/corrected/caption artifact used and its provenance. Preserve existing indexes; add a source-ID/run-path entry only where the project's normal index supports it. Creating a new database is unnecessary for one video.

## Choose the execution host

### Acquisition

Use the maintained download route for the source (yt-dlp for supported video pages). Authenticated cookies stay in the signed-in browser on their own machine; run the downloader there rather than moving a browser profile or cookies between hosts. Keep one-video requests scoped to one item. Verify the merged file's duration and audio/video streams before transfer or transcription. Check free disk space rather than assuming a drive has room.

### ASR on an NVIDIA GPU

Look for an existing Python environment with faster-whisper before installing anything: a missing `whisper` executable on PATH does not mean ASR is missing. Check it directly:

~~~sh
<python> -c "import importlib.metadata as m; import torch; print(m.version('faster-whisper')); print(torch.cuda.is_available())"
nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv
ffmpeg -version && ffprobe -version
~~~

Run the preparation helper with that interpreter and explicit `--backend faster-whisper --device cuda --compute-type float16`. Select the model for available memory and required accuracy; `--local-files-only` prevents new model downloads on this backend. Smoke-test a short source before launching a long job. Run one large model job at a time. If CUDA fails, diagnose the actual runtime/DLL/memory error before choosing an explicit alternative and record the changed backend/settings.

On Windows, load torch and expose its `lib` directory before importing faster-whisper, so CTranslate2 can find the CUDA DLLs that the torch wheel installed. The helper does this without requiring torch on CPU-only hosts. Upstream API/runtime reference: [faster-whisper](https://github.com/SYSTRAN/faster-whisper).

### Apple Silicon or CPU hosts

A model cache alone does not establish a working ASR runtime. Probe the intended interpreter/backend and run a short inference before assigning transcription. Use Apple-compatible tooling (whisper.cpp, or faster-whisper on CPU) only after verifying it; CUDA settings do not transfer.

### Moving work between hosts

Weigh actual load, free disk and transfer size. Keep GPU ASR near its cached models and source when practical; transfer derived WAV, frame selections or reports when that suffices. If full-resolution visual review needs the video, transfer that too and verify its SHA-256. Quote paths for the receiving shell (PowerShell on Windows), and use `ffmpeg -nostdin` in scripts. Record host-qualified paths: a path on another machine is not automatically local to the reviewing agent. Transfer required frames/reports before trying to open them.

## Preserve checkpoints and review evidence

A useful pattern for a consequential transcript: separate raw model passes, corrected candidate, glossary, correction decisions, commands and hashes. Reuse the pattern when needed, rather than forcing two full model passes on every job. Use targeted second passes for consequential ambiguities.

Keep acquisition, ASR, visual review, correction, synthesis and skill publication as separately recorded outcomes. On interruption, preserve logs and successful artifacts; verify their identity and fill the missing stages in a new derivative run. Neither existing captions nor a successfully written ASR JSON proves that the video was watched. Retain exact section offsets and remaining gaps.
