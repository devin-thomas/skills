"""Every public skill must stay model-invocable (scripts/invocability.py)."""
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('invocability', ROOT / 'scripts' / 'invocability.py')
invocability = importlib.util.module_from_spec(spec)
spec.loader.exec_module(invocability)
CASES = json.loads((ROOT / 'tests' / 'invocability-cases.json').read_text(encoding='utf-8'))


class Rules(unittest.TestCase):
    def test_hiding_settings_fail(self):
        for text in CASES['fail']:
            with self.subTest(text=text):
                self.assertNotEqual(invocability.violations(text), [])

    def test_invocable_settings_and_prose_pass(self):
        for text in CASES['pass']:
            with self.subTest(text=text):
                self.assertEqual(invocability.violations(text), [])

    def test_violations_name_the_setting(self):
        self.assertEqual(
            invocability.violations('disable-model-invocation: true\npolicy:\n  allow_implicit_invocation: false'),
            ['disable-model-invocation: true', 'policy.allow_implicit_invocation: false'])

    def test_skill_folder_reads_frontmatter_and_codex_settings(self):
        with tempfile.TemporaryDirectory() as temp:
            entry = Path(temp) / 'alpha' / 'SKILL.md'
            (entry.parent / 'agents').mkdir(parents=True)
            entry.write_text('---\nname: alpha\ndescription: x\ndisable-model-invocation: true\n---\n\nBody mentions\ndisable-model-invocation: true\n', encoding='utf-8')
            (entry.parent / 'agents' / 'openai.yaml').write_text('policy:\n  allow_implicit_invocation: false\n', encoding='utf-8')
            self.assertEqual(invocability.skill_violations(entry), [
                'SKILL.md disable-model-invocation: true',
                'agents/openai.yaml policy.allow_implicit_invocation: false'])


class ValidateSkills(unittest.TestCase):
    def test_repository_skills_pass(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'validate-skills.py')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('model invocability', result.stdout)

    def test_hidden_skill_fails_validation(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'scripts').mkdir()
            for name in ('validate-skills.py', 'invocability.py'):
                (root / 'scripts' / name).write_text((ROOT / 'scripts' / name).read_text(encoding='utf-8'), encoding='utf-8')
            skill = root / 'hidden' / 'SKILL.md'
            skill.parent.mkdir()
            skill.write_text('---\nname: hidden\ndescription: Synthetic hidden skill.\nuser-invocable-only: true\n---\n\nBody.\n', encoding='utf-8')
            result = subprocess.run([sys.executable, str(root / 'scripts' / 'validate-skills.py')], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertIn('hidden/SKILL.md: not model-invocable: SKILL.md user-invocable-only: true.', result.stderr)
            self.assertIn('Every skill must stay model-invocable', result.stderr)


if __name__ == '__main__':
    unittest.main()
