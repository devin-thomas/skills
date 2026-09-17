"""Remote source freshness validation for the owned-skill manifest.

Checks each tracked source against its pinned immutable revision via the
GitHub API. Produces one of four states per skill:

  verified-current     — upstream matches the pinned revision
  review-required      — upstream changed; pin needs human review
  invalid              — source repo/path/revision no longer resolves
  verification-incomplete — remote unavailable; cannot confirm freshness

Never modifies the manifest. Exit code:
  0  all skills verified current
  1  at least one skill is review-required or invalid
  2  at least one skill is verification-incomplete (none invalid/stale)

Usage:
  python scripts/check-freshness.py [--token GITHUB_TOKEN]

The token can also be set via the GITHUB_TOKEN environment variable.
Without a token, public repos are accessible at lower rate limits.
"""
from pathlib import Path
import json
import os
import sys
import urllib.error
import urllib.request

root = Path(__file__).resolve().parents[1]
manifest_path = root / 'manifest' / 'skills.json'

GITHUB_API = 'https://api.github.com'

token = None
for i, arg in enumerate(sys.argv[1:], 1):
    if arg == '--token' and i < len(sys.argv) - 1:
        token = sys.argv[i + 1]
        break
if not token:
    token = os.environ.get('GITHUB_TOKEN')


def github_get(url):
    """Make a GitHub API GET request. Returns (status, json_or_none)."""
    headers = {'Accept': 'application/vnd.github.v3+json'}
    if token:
        headers['Authorization'] = f'token {token}'
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, None
    except (urllib.error.URLError, OSError):
        return None, None


def check_skill(skill):
    """Check one skill's freshness. Returns (state, detail)."""
    sid = skill['id']
    repo = skill['sourceRepo']
    path = skill['sourcePath']
    pinned = skill['sourceRevision']
    ref = skill.get('sourceRef', 'main')

    if skill.get('sourceRepo') == 'devin-thomas/skills':
        return check_local_skill(skill)

    url = f'{GITHUB_API}/repos/{repo}/commits?sha={ref}&path={path}&per_page=1'
    status, data = github_get(url)

    if status is None:
        return 'verification-incomplete', f'{sid}: remote service unavailable for {repo}'

    if status == 404:
        return 'invalid', f'{sid}: repository or path not found at {repo}/{path}'

    if status == 422:
        return 'invalid', f'{sid}: ref "{ref}" not found in {repo}'

    if status != 200:
        return 'verification-incomplete', f'{sid}: unexpected HTTP {status} from {repo}'

    if not data or not isinstance(data, list) or len(data) == 0:
        return 'invalid', f'{sid}: no commits found for {path} on {ref} in {repo}'

    latest_sha = data[0]['sha']
    if latest_sha == pinned:
        return 'verified-current', f'{sid}: pinned revision matches {ref} HEAD for {path}'

    return 'review-required', f'{sid}: source changed since pin; review required (pinned={pinned[:12]}, latest={latest_sha[:12]})'


def check_local_skill(skill):
    """Check a local skill against the git log."""
    sid = skill['id']
    path = skill['sourcePath']
    pinned = skill['sourceRevision']
    source_file = root / path

    if not source_file.exists():
        return 'invalid', f'{sid}: local source path not found: {path}'

    import subprocess
    result = subprocess.run(
        ['git', 'log', '-1', '--format=%H', '--', path],
        capture_output=True, text=True, cwd=str(root)
    )
    if result.returncode != 0:
        return 'verification-incomplete', f'{sid}: git log failed for local path {path}'

    latest_sha = result.stdout.strip()
    if not latest_sha:
        return 'invalid', f'{sid}: no git history for {path}'

    if latest_sha == pinned:
        return 'verified-current', f'{sid}: pinned revision matches local HEAD for {path}'

    return 'review-required', f'{sid}: source changed since pin; review required (pinned={pinned[:12]}, latest={latest_sha[:12]})'


def main():
    manifest = json.loads(manifest_path.read_text())
    skills = manifest.get('skills', [])

    results = {}
    has_invalid_or_stale = False
    has_incomplete = False

    for skill in skills:
        state, detail = check_skill(skill)
        results[skill['id']] = (state, detail)

        if state in ('invalid', 'review-required'):
            has_invalid_or_stale = True
        elif state == 'verification-incomplete':
            has_incomplete = True

    # Report
    for sid, (state, detail) in results.items():
        icon = {
            'verified-current': 'OK',
            'review-required': 'REVIEW',
            'invalid': 'INVALID',
            'verification-incomplete': 'INCOMPLETE',
        }[state]
        stream = sys.stderr if state != 'verified-current' else sys.stdout
        print(f'  [{icon}] {detail}', file=stream)

    current_count = sum(1 for s, _ in results.values() if s == 'verified-current')
    total = len(results)
    print(f'\nFreshness: {current_count}/{total} verified current')

    if has_invalid_or_stale:
        sys.exit(1)
    elif has_incomplete:
        sys.exit(2)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()
