# Watch this video: evidence contract

Create a source-backed derivative run folder per analysis attempt. Keep raw evidence immutable; add review artifacts without rewriting raw outputs. Use a unique run ID under the existing project's ignored workspace or outside Git (for example `video-analysis/<source-id>/<run-id>/`). Reused artifacts stay in place with explicit provenance. Keep downloaded media and full transcriptions out of any skill repository.

## Files

- `provenance.json`: source identity/URL, acquisition route, original metadata/caption paths, host-qualified media and artifact paths, SHA-256 hashes, duration/streams checked, current skill source revision, reused artifact origins and verification, and execution records. For each executed stage record host, interpreter/tool versions, command (without secrets), model and local cache identity where available, language, prompt file hash, device/compute settings, output paths, and success/failure. Record failed attempts and missing stages separately from completed ones. Preserve these records even if preparation stops before producing its final manifest.
- `preparation.json`: required when the helper ran, including file hash, streams, declared original title, and tool/coverage limitations. When reusing ASR or preparing with other tools, record corresponding verified probe/hash/execution evidence in provenance instead of fabricating this file. Do not edit a helper manifest to imply review is complete.
- `audio.json` and backend-produced text/timing sidecars: untouched raw local-ASR evidence. OpenAI Whisper, faster-whisper, and whisper.cpp formats differ; inspect the recorded backend before reading segments or converting timestamp units. Preserve original times and words. Record a reference to reused raw ASR instead of requiring a duplicate. Captions retain their manual/automatic/unknown origin separately and never acquire an ASR label through conversion.
- `frames/`: baseline frame samples and nominal index. Add targeted exact-offset captures/short clips as required, and distinguish them from nominal samples.
- `glossary-corrections.json`: each entry `{ "timestamp": "HH:MM:SS", "raw": "...", "correction": "...", "domain_term": "...", "evidence": "audio|screen|official-reference|mixed", "confidence": "high|medium|uncertain", "reason": "..." }`. Only applied high/medium corrections go into the corrected transcript; retain unresolved words explicitly.
- `transcript-corrected.md`: segment timestamps plus corrected text; keep the original segment order and times. Never replace the raw Whisper files.
- `analysis.md`: useful human-readable analysis, not just an executive summary.
- `analysis.json`: structured handoff below. `source.original_title` and `independent_title` must be different meaningful titles.

## `analysis.json` minimal schema (illustrative)

~~~json
{
  "schema": "watch-this-video/v1",
  "source": {
    "original_title": "Title as published",
    "url": "https://example.invalid/video",
    "creator": null,
    "published": null,
    "duration_seconds": 0,
    "sha256": "media file hash or null"
  },
  "independent_title": "Specific analytical title describing the real lesson",
  "domain": "observed subject area",
  "coverage": {
    "audio": "local-whisper|missing|silent",
    "visual": "reviewed|partial|unavailable|no-video",
    "sections_reviewed": ["00:00:00-00:04:30"],
    "audio_sections_reviewed": ["00:00:00-00:04:30"],
    "visual_sections_reviewed": ["00:00:00-00:04:30"],
    "gaps": [],
    "limitations": []
  },
  "summary": "Original synthesis",
  "chapters": [
    {
      "start": "00:00:00",
      "end": "00:04:30",
      "heading": "Chapter insight",
      "explanation": "Detailed explanation",
      "visual_evidence": ["00:01:32 on-screen UI state"],
      "audio_evidence": ["00:01:15 explanation"],
      "uncertainties": []
    }
  ],
  "claims": [
    {"claim": "Specific assertion", "at": "00:02:10", "status": "speaker-claimed|observed|external-verified|uncertain|contradicted", "support": "what was actually checked"}
  ],
  "methods": [
    {"name": "Repeatable technique", "evidence_times": ["00:02:10"], "prerequisites": [], "steps": [], "expected_result": "", "pitfalls": [], "independent_checks": []}
  ],
  "glossary_file": "glossary-corrections.json",
  "provenance_file": "provenance.json",
  "raw_transcript_file": "audio.json",
  "corrected_transcript_file": "transcript-corrected.md",
  "open_questions": []
}
~~~

For a URL without meaningful public metadata, use null where appropriate; never invent a creator/date. If no audio was present, raw transcript paths are null and the gap is explicit. A missing segment is never an empty `sections_reviewed` range implying completion. Separate audio and visual review ranges from tool-processing ranges: a full ASR pass is not full auditory review. Preserve original-media offsets for excerpts and chunks, including each chunk's offset and any overlap. These provenance and modality fields extend the v1 handoff without changing existing field meanings; identify older artifacts that lack them and verify the missing evidence before reuse.

## `analysis.md` sequence

1. Independent analytical title, original source title, URL/author/date (when known), duration, acquisition route and whether audio/video were actually processed.
2. Three to six sentence substantive synopsis and why the video matters.
3. Detailed timestamped chapters, including what is *shown* versus *said*, examples, transitions, diagrams or code, and nonverbal context.
4. Concepts, terms, techniques, prerequisites and full reproducible workflow(s).
5. Claims and disagreements: `observed`, `speaker-claimed`, `external-verified`, `uncertain` or `contradicted`; evidence for each consequential claim.
6. Mistakes, subtle caveats, alternatives, hidden assumptions, relevant counterexamples and unanswered questions.
7. Practical next actions and tests of understanding. If procedural value is low, explain that instead of manufacturing a tutorial.
8. Glossary correction summary, media evidence index, coverage limitations, and file paths.

## Review bar

- Important assertions and procedures have timestamp references and matching audio or visual evidence.
- All significant visual-only information is represented, especially demos, screen text, equations, slides, and code.
- Technical corrections are auditable; undecidable terms stay undecided.
- The independent title reflects **your analysis**, not title SEO or an untested promise.
- Deep synthesis is paraphrased; do not republish large transcript excerpts, assets, or the video.
- Do not collapse a long video into a few frame samples and call it complete. Report a partial result with scope if review cannot be finished.
