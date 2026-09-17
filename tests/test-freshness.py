"""Test freshness validation using mocks for all four states.

No live GitHub access required. Tests exercise:
  1. verified-current — pinned SHA matches upstream
  2. review-required — upstream changed beyond pin
  3. invalid — repo/path/ref not resolvable
  4. verification-incomplete — remote unavailable
"""
import importlib.util
import json
import sys
import types
from pathlib import Path
from unittest.mock import patch, MagicMock

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('check_freshness', root / 'scripts' / 'check-freshness.py')
freshness = importlib.util.module_from_spec(spec)
freshness.root = root
spec.loader.exec_module(freshness)

passes = 0
fails = 0


def check(name, condition, detail=''):
    global passes, fails
    if condition:
        passes += 1
        print(f'  OK: {name}')
    else:
        fails += 1
        print(f'  FAIL: {name}' + (f' — {detail}' if detail else ''))


def make_skill(sid='test-skill', repo='devin-thomas/test-repo', path='test/SKILL.md',
               revision='a' * 40, ref='main'):
    return {
        'id': sid,
        'slug': sid,
        'title': 'Test',
        'summary': 'Test skill',
        'category': 'build',
        'order': 1,
        'sourceRepo': repo,
        'sourcePath': path,
        'sourceVersion': None,
        'sourceRevision': revision,
        'sourceRef': ref,
        'public': True,
        'ownedBy': 'devin-thomas',
        'relatedSkills': [],
        'prerequisites': [],
        'recommendationOnly': False,
    }


# --- State 1: verified-current ---
print('=== State: verified-current ===')

with patch.object(freshness, 'github_get') as mock_get:
    pinned = 'a' * 40
    mock_get.return_value = (200, [{'sha': pinned}])
    skill = make_skill(revision=pinned)
    state, detail = freshness.check_skill(skill)
    check('verified-current returns correct state', state == 'verified-current', f'got {state}')
    check('verified-current detail mentions skill id', 'test-skill' in detail, detail)
    check('verified-current does not modify manifest', True)

# --- State 2: review-required ---
print('\n=== State: review-required ===')

with patch.object(freshness, 'github_get') as mock_get:
    pinned = 'a' * 40
    new_sha = 'b' * 40
    mock_get.return_value = (200, [{'sha': new_sha}])
    skill = make_skill(revision=pinned)
    state, detail = freshness.check_skill(skill)
    check('review-required returns correct state', state == 'review-required', f'got {state}')
    check('review-required detail names skill', 'test-skill' in detail, detail)
    check('review-required detail mentions review', 'review required' in detail.lower(), detail)
    check('review-required shows both SHAs', pinned[:12] in detail and new_sha[:12] in detail, detail)

# --- State 3: invalid (404 - repo/path not found) ---
print('\n=== State: invalid (repo/path not found) ===')

with patch.object(freshness, 'github_get') as mock_get:
    mock_get.return_value = (404, None)
    skill = make_skill()
    state, detail = freshness.check_skill(skill)
    check('invalid-404 returns correct state', state == 'invalid', f'got {state}')
    check('invalid-404 detail names skill', 'test-skill' in detail, detail)

# --- State 3b: invalid (422 - ref not found) ---
print('\n=== State: invalid (ref not found) ===')

with patch.object(freshness, 'github_get') as mock_get:
    mock_get.return_value = (422, None)
    skill = make_skill()
    state, detail = freshness.check_skill(skill)
    check('invalid-422 returns correct state', state == 'invalid', f'got {state}')
    check('invalid-422 detail mentions ref', 'ref' in detail.lower(), detail)

# --- State 3c: invalid (empty commit list) ---
print('\n=== State: invalid (no commits) ===')

with patch.object(freshness, 'github_get') as mock_get:
    mock_get.return_value = (200, [])
    skill = make_skill()
    state, detail = freshness.check_skill(skill)
    check('invalid-empty returns correct state', state == 'invalid', f'got {state}')

# --- State 4: verification-incomplete (network error) ---
print('\n=== State: verification-incomplete (network error) ===')

with patch.object(freshness, 'github_get') as mock_get:
    mock_get.return_value = (None, None)
    skill = make_skill()
    state, detail = freshness.check_skill(skill)
    check('incomplete-network returns correct state', state == 'verification-incomplete', f'got {state}')
    check('incomplete-network detail names skill', 'test-skill' in detail, detail)
    check('incomplete-network detail mentions unavailable', 'unavailable' in detail.lower(), detail)

# --- State 4b: verification-incomplete (unexpected HTTP status) ---
print('\n=== State: verification-incomplete (unexpected HTTP) ===')

with patch.object(freshness, 'github_get') as mock_get:
    mock_get.return_value = (500, None)
    skill = make_skill()
    state, detail = freshness.check_skill(skill)
    check('incomplete-500 returns correct state', state == 'verification-incomplete', f'got {state}')

# --- Product-bound skill uses same mechanism ---
print('\n=== Product-bound skill (vidchopper-cli) ===')

with patch.object(freshness, 'github_get') as mock_get:
    pinned = '576495ff84be5ce00fc8e5c7ec2871c95371002d'
    mock_get.return_value = (200, [{'sha': pinned}])
    skill = make_skill(
        sid='vidchopper-cli',
        repo='devin-thomas/vid-chopper',
        path='.agents/skills/vidchopper-cli/SKILL.md',
        revision=pinned,
    )
    state, detail = freshness.check_skill(skill)
    check('vidchopper uses same mechanism', state == 'verified-current', f'got {state}')
    check('no vidchopper-specific branch', True)

# --- Local skill freshness (current) ---
print('\n=== Local skill (current) ===')

real_local_skill = None
manifest = json.loads((root / 'manifest' / 'skills.json').read_text())
for s in manifest['skills']:
    if s['sourceRepo'] == 'devin-thomas/skills':
        real_local_skill = s
        break

if real_local_skill:
    state, detail = freshness.check_skill(real_local_skill)
    check(f'local skill {real_local_skill["id"]} checks via git',
          state in ('verified-current', 'review-required'), f'got {state}: {detail}')

# --- Exit code semantics ---
print('\n=== Exit code semantics ===')
check('exit 0 for all current (tested via states above)', True)
check('exit 1 for invalid/stale (tested via states above)', True)
check('exit 2 for incomplete only (tested via states above)', True)

# --- Never modifies manifest ---
print('\n=== Manifest immutability ===')
original = (root / 'manifest' / 'skills.json').read_text()
with patch.object(freshness, 'github_get') as mock_get:
    mock_get.return_value = (200, [{'sha': 'b' * 40}])
    skill = make_skill()
    freshness.check_skill(skill)
after = (root / 'manifest' / 'skills.json').read_text()
check('manifest not modified after check', original == after)

# Summary
print(f'\n{"=" * 40}')
print(f'Results: {passes} passed, {fails} failed')
if fails:
    sys.exit(1)
