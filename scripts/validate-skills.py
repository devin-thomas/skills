"""Validate skill entry points and local Markdown references without dependencies."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

root = Path(__file__).resolve().parents[1]
errors = []
skills = sorted(root.glob('*/SKILL.md'))
for entry in skills:
    text = entry.read_text()
    match = re.match(r'\A---\n(.*?)\n---\n', text, re.S)
    if not match:
        errors.append(f'{entry.relative_to(root)}: missing frontmatter')
        continue
    fields = match.group(1)
    if not re.search(rf'^name: {re.escape(entry.parent.name)}$', fields, re.M):
        errors.append(f'{entry.relative_to(root)}: folder/name mismatch')
    if not re.search(r'^description: .+', fields, re.M):
        errors.append(f'{entry.relative_to(root)}: missing description')
    if len(text.splitlines()) >= 500:
        errors.append(f'{entry.relative_to(root)}: entry point needs progressive disclosure')
for document in sorted(root.rglob('*.md')):
    if '.git' in document.parts:
        continue
    text = document.read_text()
    if re.search(r'/Users/[^/\s]+/|/home/[^/\s]+/', text):
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
print(f'PASS: {len(skills)} entry points, local Markdown links, and home-path checks')

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
