"""Validate the central owned-skill manifest without network access.

Checks structural integrity, uniqueness constraints, category conformance,
related-skill references, source-derived fact consistency for local skills,
and recommendation-only separation.
"""
from pathlib import Path
import json
import re
import sys

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
manifest_path = root / 'manifest' / 'skills.json'

VALID_CATEGORIES = ['plan', 'build', 'specialized', 'fun']
SHA_PATTERN = re.compile(r'^[0-9a-f]{40}$')
SLUG_PATTERN = re.compile(r'^[a-z][a-z0-9-]*$')

errors = []


def err(msg):
    errors.append(msg)


# --- Load manifest ---

if not manifest_path.exists():
    print('FAIL: manifest/skills.json not found', file=sys.stderr)
    sys.exit(1)

try:
    manifest = json.loads(manifest_path.read_text())
except json.JSONDecodeError as e:
    print(f'FAIL: manifest/skills.json is not valid JSON: {e}', file=sys.stderr)
    sys.exit(1)

# --- Top-level structure ---

if manifest.get('categories') != VALID_CATEGORIES:
    err(f'categories must be {VALID_CATEGORIES}, got {manifest.get("categories")}')

skills = manifest.get('skills', [])
if not isinstance(skills, list) or len(skills) == 0:
    err('skills array is missing or empty')
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)

# --- Per-skill structural checks ---

seen_ids = set()
seen_slugs = set()
all_ids = {s['id'] for s in skills if 'id' in s}
category_orders = {}

for skill in skills:
    sid = skill.get('id', '<missing>')
    label = sid

    # Required fields
    for field in ['id', 'slug', 'title', 'summary', 'category', 'order',
                  'sourceRepo', 'sourcePath', 'sourceRevision',
                  'public', 'ownedBy', 'relatedSkills', 'prerequisites',
                  'recommendationOnly']:
        if field not in skill:
            err(f'{label}: missing required field "{field}"')

    # ID/slug format and uniqueness
    if 'id' in skill:
        if not SLUG_PATTERN.match(skill['id']):
            err(f'{label}: invalid id format')
        if skill['id'] in seen_ids:
            err(f'{label}: duplicate id')
        seen_ids.add(skill['id'])

    if 'slug' in skill:
        if not SLUG_PATTERN.match(skill['slug']):
            err(f'{label}: invalid slug format')
        if skill['slug'] in seen_slugs:
            err(f'{label}: duplicate slug')
        seen_slugs.add(skill['slug'])

    # Category
    cat = skill.get('category')
    if cat not in VALID_CATEGORIES:
        err(f'{label}: invalid category "{cat}"')

    # Order uniqueness within category
    order = skill.get('order')
    if isinstance(order, int) and cat:
        key = (cat, order)
        if key in category_orders:
            err(f'{label}: duplicate order {order} in category "{cat}" (conflicts with {category_orders[key]})')
        category_orders[key] = label

    # Source revision format
    rev = skill.get('sourceRevision', '')
    if not SHA_PATTERN.match(str(rev)):
        err(f'{label}: sourceRevision must be a 40-char hex SHA, got "{rev}"')

    # Related skills reference valid IDs
    for ref in skill.get('relatedSkills', []):
        if ref not in all_ids:
            err(f'{label}: unknown related skill "{ref}"')

    # Prerequisite skill references
    for prereq in skill.get('prerequisites', []):
        if 'skillId' in prereq and prereq['skillId'] not in all_ids:
            err(f'{label}: unknown prerequisite skill "{prereq["skillId"]}"')

    # Recommendation-only must not be public owned
    if skill.get('recommendationOnly') and skill.get('public'):
        err(f'{label}: recommendation-only record must not be marked public')

# --- Source-derived fact checks for local skills ---

for skill in skills:
    if skill.get('sourceRepo') != 'devin-thomas/skills':
        continue
    sid = skill['id']
    source_path = root / skill['sourcePath']
    if not source_path.exists():
        err(f'{sid}: local source path does not exist: {skill["sourcePath"]}')
        continue

    text = source_path.read_text()
    fm_match = re.match(r'\A---\n(.*?)\n---\n', text, re.S)
    if not fm_match:
        err(f'{sid}: local SKILL.md missing frontmatter')
        continue

    fm = fm_match.group(1)

    # Check name matches directory / skill id
    name_match = re.search(r'^name:\s*(.+)$', fm, re.M)
    if name_match:
        local_name = name_match.group(1).strip()
        if local_name != sid:
            err(f'{sid}: manifest id does not match local SKILL.md name "{local_name}"')

    # Check description exists
    desc_match = re.search(r'^description:\s*(.+)', fm, re.M)
    if not desc_match:
        err(f'{sid}: local SKILL.md missing description in frontmatter')

# --- Category ordering continuity ---

for cat in VALID_CATEGORIES:
    cat_skills = sorted(
        [(s['order'], s['id']) for s in skills if s.get('category') == cat],
        key=lambda x: x[0]
    )
    expected = 1
    for order, sid in cat_skills:
        if order != expected:
            err(f'{sid}: expected order {expected} in category "{cat}", got {order}')
        expected += 1

# --- Report ---

if errors:
    for e in errors:
        print(e, file=sys.stderr)
    sys.exit(1)

public_count = sum(1 for s in skills if s.get('public') and not s.get('recommendationOnly'))
print(f'PASS: {len(skills)} manifest entries, {public_count} public owned skills, '
      f'{len(VALID_CATEGORIES)} categories validated')
