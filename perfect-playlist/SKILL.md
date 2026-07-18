---
name: perfect-playlist
description: Build, append, verify, export, search, and inspect exact Spotify playlists with the Perfect Playlist CLI. Use when a user asks to create a Spotify playlist from named songs or exact Spotify references, fill an owned empty playlist, append exact tracks, compare playlist order and contents, export a durable track Source, or discover and confirm Spotify track candidates without substitutions.
---

# Perfect Playlist

Use Perfect Playlist as a deterministic final-mile tool. Discovery may interpret
a user's request, but every write must receive the exact ordered Spotify track
references selected for that request.

## Preserve the safety boundary

- Use Search and Inspect for discovery; neither command chooses tracks or writes
  a playlist.
- Resolve every requested song to one inspected canonical Spotify track URI
  before any write. Never pass natural-language candidates to Build or Add.
- Preserve the user's order and duplicates. Never substitute, reorder, dedupe,
  or silently skip unavailable or invalid tracks.
- Build only a new public playlist or an owned empty public/private target.
- Use Add only for an explicit append request against a verified writable target.
  Add never changes visibility or earlier tracks.
- Never overwrite, repair, insert into, or generatively modify a playlist.
- Do not automatically retry Build or Add after a partial or unverified failure;
  a retry could duplicate tracks. Report the playlist URL and failure instead.

## Run the preflight

1. Run `perfect-playlist --help`. If the command is missing, install Python 3.11+
   and run `python -m pip install perfect-playlist` only when the user has
   authorized that software change. Then rerun `perfect-playlist --help`.
2. Run `perfect-playlist auth status` before Spotify-backed discovery or writes.
3. If configuration is missing, have the user set `SPOTIPY_CLIENT_ID`,
   `SPOTIPY_CLIENT_SECRET`, and `SPOTIPY_REDIRECT_URI` locally, or place them in
   an external environment file and set `PERFECT_PLAYLIST_SECRETS_FILE` to its
   path. Do not ask the user to paste secret values into the conversation.
4. Use `perfect-playlist auth login` for interactive authorization, then rerun
   `auth status`.

Never open, print, copy, commit, or expose an existing secrets file, OAuth code,
token cache, or credential value. Run separate CLI processes serially when they
share the same OAuth cache.

## Discover exact tracks

For each requested song, in the user's order:

1. Run `perfect-playlist search QUERY --json`; use `--limit 1..10` when the
   default four candidates are insufficient.
2. Compare title, artists, explicit status, duration, URI, and Spotify link with
   the request.
3. Run `perfect-playlist inspect TRACK_URI_OR_URL --json` on the intended result.
4. Record the canonical `spotify:track:<id>` URI returned by Inspect.

Treat an exact title-and-artist request as the caller's song choice, but do not
guess among live, remastered, clean, explicit, sped-up, slowed, re-recorded, or
otherwise plausible versions. Present ambiguous candidates and wait for the
user to choose. If no exact candidate is available, stop and report that track;
never choose a similar song.

## Create a durable Source

Create a new local YAML, JSON, or text Source containing only the inspected
tracks. Do not overwrite an existing Source without explicit permission. YAML
and JSON use a top-level `tracks` array; text uses one URI or typed Spotify track
URL per nonblank line and may contain `#` comments.

```yaml
tracks:
  - spotify:track:354WZaV3u6cuzTG2PmpYwm
  - spotify:track:78APbsosmvDYIwZHjzC5ZE
```

Prefer canonical track URIs. Typed `open.spotify.com/track/...` URLs are also
accepted and normalized. Raw 22-character IDs, stdin (`-`), arbitrary remote
documents, playlist metadata, names, targets, and privacy settings do not belong
in a TrackSequence. Invalid entries fail the entire Source.

## Choose one write workflow

- New public playlist with default settings:
  `perfect-playlist build SOURCE`
- New public playlist with an exact case-sensitive name:
  `perfect-playlist build SOURCE --name "NAME"`
- Owned empty public target:
  `perfect-playlist build SOURCE --target PLAYLIST_URI_OR_URL`
- Owned empty private target:
  `perfect-playlist build SOURCE --private --target PLAYLIST_URI_OR_URL`
- Explicit append to an owned or collaborative writable target:
  `perfect-playlist add SOURCE --target PLAYLIST_URI_OR_URL`

With no `--name` or `--target`, Build creates a new public `My Perfect Playlist`
and advances through numeric suffixes when needed. An explicit name collision
fails instead of changing the name. Perfect Playlist does not create a new
private playlist: ask the user for an owned empty private target. Never use a
collaborative playlist as a Build target.

## Verify and report

Build and Add validate before writing and read back Spotify state afterward.
After a successful write, also run
`perfect-playlist verify SOURCE PLAYLIST_URI_OR_URL` for an explicit peer
comparison when the playlist must exactly equal the Source. For Add, this full
comparison is appropriate only when the target was empty before the append;
otherwise rely on Add's verified appended-segment result.

Interpret exit codes exactly:

- `0`: success, or exact equality for Verify.
- `1`: two valid Verify Sources differ in count or first differing position.
- `2`: handled input, filesystem, authentication, Spotify, safety, or
  partial-write failure.

Report the durable Source path, playlist name and URL, requested visibility or
target mode, exact track count, and verification outcome. Surface failures
verbatim enough to preserve their actionable detail. Do not claim success from
a playlist URL alone, and do not delete or unfollow a result unless the user
explicitly asks.

## Use read-only workflows when appropriate

- Compare any two Sources with `perfect-playlist verify LEFT RIGHT`.
- Print canonical URI lines with `perfect-playlist export SOURCE`.
- Write a new `.yaml`, `.yml`, `.json`, or `.txt` file with
  `perfect-playlist export SOURCE --out NEW_PATH`.
- Render text-only Spotify links with `perfect-playlist export SOURCE --links`.

Export never overwrites an existing file. Search and Inspect JSON responses are
command data for discovery, not portable Sources.
