"""Test manifest validation logic with fixtures and intentional error cases.

Covers: local skill, external Starter Pack source, product-bound external
source, and structural error detection — all without network access.
"""
from pathlib import Path
import json
import subprocess
import sys
import tempfile
import os

root = Path(__file__).resolve().parents[1]
validator = root / 'scripts' / 'validate-manifest.py'
manifest_src = root / 'manifest' / 'skills.json'
fixtures = root / 'tests' / 'fixtures'

passes = 0
fails = 0


def run_validator_on_real():
    """Run validate-manifest.py against the real manifest."""
    result = subprocess.run(
        [sys.executable, str(validator)],
        capture_output=True, text=True,
        cwd=str(root)
    )
    return result.returncode, result.stderr, result.stdout


def run_validator_on_bad(manifest_data):
    """Run validate-manifest.py with a modified manifest in a temp directory.

    Symlinks skill directories so local source checks still work.
    """
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        manifest_dir = tmp_path / 'manifest'
        manifest_dir.mkdir()
        (manifest_dir / 'skills.json').write_text(json.dumps(manifest_data, indent=2))
        for skill_dir in root.iterdir():
            if skill_dir.is_dir() and (skill_dir / 'SKILL.md').exists():
                os.symlink(skill_dir, tmp_path / skill_dir.name)

        result = subprocess.run(
            [sys.executable, str(validator), str(tmp_path)],
            capture_output=True, text=True,
        )
        return result.returncode, result.stderr, result.stdout


def check(name, condition, detail=''):
    global passes, fails
    if condition:
        passes += 1
        print(f'  OK: {name}')
    else:
        fails += 1
        print(f'  FAIL: {name}' + (f' — {detail}' if detail else ''))


# Load the real manifest
manifest = json.loads(manifest_src.read_text())

print('=== Real manifest validation ===')
rc, stderr, stdout = run_validator_on_real()
check('real manifest passes validation', rc == 0, stderr)

print('\n=== Fixture: local skill (grill-to-build) ===')
fixture = json.loads((fixtures / 'valid-local-skill.json').read_text())
check('fixture has sourceRepo devin-thomas/skills', fixture['skill']['sourceRepo'] == 'devin-thomas/skills')
check('fixture has valid 40-char SHA', len(fixture['skill']['sourceRevision']) == 40)
check('fixture id matches local directory', (root / fixture['skill']['sourcePath']).exists())

print('\n=== Fixture: external Starter Pack source ===')
fixture = json.loads((fixtures / 'valid-external-starter-pack.json').read_text())
check('fixture has sourceRepo devin-thomas/starter-pack', fixture['skill']['sourceRepo'] == 'devin-thomas/starter-pack')
check('fixture has sourceVersion', fixture['skill']['sourceVersion'] is not None)

print('\n=== Fixture: product-bound external source (vid-chopper) ===')
fixture = json.loads((fixtures / 'valid-external-product-bound.json').read_text())
check('fixture has sourceRepo devin-thomas/vid-chopper', fixture['skill']['sourceRepo'] == 'devin-thomas/vid-chopper')
check('fixture has platform prerequisite', any(p.get('platform') for p in fixture['skill']['prerequisites']))
check('fixture is not recommendation-only', not fixture['skill']['recommendationOnly'])

print('\n=== Error detection: duplicate IDs ===')
bad = json.loads(json.dumps(manifest))
bad['skills'].append(json.loads(json.dumps(bad['skills'][0])))
rc, stderr, _ = run_validator_on_bad(bad)
check('duplicate id rejected', rc != 0 and 'duplicate id' in stderr, stderr)

print('\n=== Error detection: invalid category ===')
bad = json.loads(json.dumps(manifest))
bad['skills'][0]['category'] = 'unknown'
rc, stderr, _ = run_validator_on_bad(bad)
check('invalid category rejected', rc != 0 and 'invalid category' in stderr, stderr)

print('\n=== Error detection: unknown related skill ===')
bad = json.loads(json.dumps(manifest))
bad['skills'][0]['relatedSkills'] = ['nonexistent-skill-xyz']
rc, stderr, _ = run_validator_on_bad(bad)
check('unknown related skill rejected', rc != 0 and 'unknown related skill' in stderr, stderr)

print('\n=== Error detection: malformed SHA ===')
bad = json.loads(json.dumps(manifest))
bad['skills'][0]['sourceRevision'] = 'not-a-sha'
rc, stderr, _ = run_validator_on_bad(bad)
check('malformed SHA rejected', rc != 0 and 'sourceRevision' in stderr, stderr)

print('\n=== Error detection: missing required field ===')
bad = json.loads(json.dumps(manifest))
del bad['skills'][0]['sourcePath']
rc, stderr, _ = run_validator_on_bad(bad)
check('missing field rejected', rc != 0 and 'missing required field' in stderr, stderr)

print('\n=== Error detection: duplicate slug ===')
bad = json.loads(json.dumps(manifest))
bad['skills'][1]['slug'] = bad['skills'][0]['slug']
rc, stderr, _ = run_validator_on_bad(bad)
check('duplicate slug rejected', rc != 0 and 'duplicate slug' in stderr, stderr)

print('\n=== Error detection: recommendation-only but public ===')
bad = json.loads(json.dumps(manifest))
bad['skills'][0]['recommendationOnly'] = True
rc, stderr, _ = run_validator_on_bad(bad)
check('recommendation-only + public rejected', rc != 0 and 'recommendation-only' in stderr, stderr)

print('\n=== Manifest content checks ===')
skills_by_id = {s['id']: s for s in manifest['skills']}
all_ids = set(skills_by_id.keys())
expected_ids = {
    'starter-pack', 'computer-setup', 'grill-to-build', 'task-execution-prompt',
    'quick-build', 'execute-task', 'execute-task-cycles',
    'surface-sweep', 'surface-sweep-showcase', 'no-useless-copy',
    'pwa-development', 'vidchopper-cli', 'perfect-playlist'
}
check('all 13 skills present', all_ids == expected_ids,
      f'missing={expected_ids - all_ids}, extra={all_ids - expected_ids}')
check('categories match spec', manifest['categories'] == ['plan', 'build', 'specialized', 'fun'])

plan_skills = [s['id'] for s in manifest['skills'] if s['category'] == 'plan']
check('plan has correct skills', set(plan_skills) == {'starter-pack', 'computer-setup', 'grill-to-build', 'task-execution-prompt'})

build_skills = [s['id'] for s in manifest['skills'] if s['category'] == 'build']
check('build has correct skills', set(build_skills) == {'quick-build', 'execute-task', 'execute-task-cycles', 'surface-sweep', 'surface-sweep-showcase', 'no-useless-copy'})

specialized_skills = [s['id'] for s in manifest['skills'] if s['category'] == 'specialized']
check('specialized has correct skills', set(specialized_skills) == {'pwa-development', 'vidchopper-cli'})

fun_skills = [s['id'] for s in manifest['skills'] if s['category'] == 'fun']
check('fun has correct skills', set(fun_skills) == {'perfect-playlist'})

check('vidchopper-cli source is vid-chopper repo', skills_by_id['vidchopper-cli']['sourceRepo'] == 'devin-thomas/vid-chopper')
check('starter-pack source is starter-pack repo', skills_by_id['starter-pack']['sourceRepo'] == 'devin-thomas/starter-pack')
check('grill-to-build source is skills repo', skills_by_id['grill-to-build']['sourceRepo'] == 'devin-thomas/skills')
check('no external implementations copied locally',
      not (root / '.agents').exists() and not (root / 'vidchopper-cli').exists())

# Summary
print(f'\n{"=" * 40}')
print(f'Results: {passes} passed, {fails} failed')
if fails:
    sys.exit(1)
