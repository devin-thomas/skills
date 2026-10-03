"""Validate skill entry points and local Markdown references without dependencies."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

root = Path(__file__).resolve().parents[1]
errors = []
skills = sorted(root.glob('*/SKILL.md'))
skill_name_pattern = re.compile(r'^[a-z][a-z0-9-]*$')
xml_tag_pattern = re.compile(r'</?[A-Za-z][^>]*>')

for entry in skills:
    text = entry.read_text(encoding='utf-8')
    match = re.match(r'\A---\n(.*?)\n---\n', text, re.S)
    if not match:
        errors.append(f'{entry.relative_to(root)}: missing frontmatter')
        continue

    fields = match.group(1)
    name_match = re.search(r'^name:\s*(.+)$', fields, re.M)
    description_match = re.search(r'^description:\s*(.+)$', fields, re.M)

    if not name_match:
        errors.append(f'{entry.relative_to(root)}: missing name')
    else:
        name = name_match.group(1).strip()
        if name != entry.parent.name:
            errors.append(f'{entry.relative_to(root)}: folder/name mismatch')
        if len(name) > 64:
            errors.append(f'{entry.relative_to(root)}: name exceeds 64 characters')
        if not skill_name_pattern.fullmatch(name):
            errors.append(f'{entry.relative_to(root)}: name must use lowercase letters, digits, and hyphens')
        if xml_tag_pattern.search(name):
            errors.append(f'{entry.relative_to(root)}: name must not contain XML tags')

    if not description_match:
        errors.append(f'{entry.relative_to(root)}: missing description')
    else:
        description = description_match.group(1).strip()
        if len(description) > 1024:
            errors.append(f'{entry.relative_to(root)}: description exceeds 1024 characters')
        if xml_tag_pattern.search(description):
            errors.append(f'{entry.relative_to(root)}: description must not contain XML tags')

    if len(text.splitlines()) >= 500:
        errors.append(f'{entry.relative_to(root)}: entry point needs progressive disclosure')

for document in sorted(root.rglob('*.md')):
    if {'.git', 'node_modules', 'dist', 'build', 'coverage'} & set(document.parts):
        continue
    text = document.read_text(encoding='utf-8')
    # Grok Bot reports these logical and physical roots as part of its host contract.
    portable_text = text.replace('/home/box/agent-data', '<grokbot-logical-root>')
    portable_text = portable_text.replace('/home/box/sand-data', '<grokbot-physical-root>')
    if re.search(r'/Users/[^/\s]+/|/home/[^/\s]+/', portable_text):
        errors.append(f'{document.relative_to(root)}: machine-specific home path')
    for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', text):
        parsed = urlsplit(target.strip('<>'))
        if parsed.scheme or not parsed.path:
            continue
        if not (document.parent / unquote(parsed.path)).exists():
            errors.append(f'{document.relative_to(root)}: missing link {target}')

for error in errors:
    print(error, file=sys.stderr)
if errors:
    sys.exit(1)
print(f'PASS: {len(skills)} entry points, portable frontmatter, local Markdown links, and home-path checks')

# Run manifest validation as part of the standard validation flow
import subprocess
manifest_script = Path(__file__).resolve().parent / 'validate-manifest.py'
if manifest_script.exists():
    result = subprocess.run([sys.executable, str(manifest_script)],
                            capture_output=True, text=True)
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)
    if result.returncode != 0:
        sys.exit(result.returncode)
