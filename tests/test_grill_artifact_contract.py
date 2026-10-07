"""Static regression checks for the Grill-to-Build v1.3 domain-document contract.

Run: python3 -m unittest discover -s tests -p 'test_grill_artifact_contract.py'
"""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class GlossaryContractTests(unittest.TestCase):
    def test_canonical_writers_are_separated(self):
        skill = read("grill-to-build/SKILL.md")
        contracts = read("grill-to-build/references/artifact-contracts.md")
        for text in (skill, contracts):
            self.assertIn("`GLOSSARY.md`", text)
            self.assertIn("`PROJECT.md`", text)
        self.assertIn("terms", skill.lower())
        self.assertIn("living", contracts.lower())
        self.assertIn("migration-from-context.md", skill)

    def test_migration_covers_both_legacy_shapes(self):
        guide = read("grill-to-build/references/migration-from-context.md")
        for item in (
            "CONTEXT.md", "CONTEXT-MAP.md", "Context.md",
            "GLOSSARY.md", "GLOSSARY-MAP.md", "PROJECT.md",
            "git mv", "Do not overwrite",
        ):
            self.assertIn(item.lower(), guide.lower())

    def test_consumer_uses_new_names(self):
        prompt = read("task-execution-prompt/SKILL.md")
        checklist = read("task-execution-prompt/references/authoring-checklist.md")
        for text in (prompt, checklist):
            self.assertIn("`GLOSSARY.md`", text)
            self.assertIn("`GLOSSARY-MAP.md`", text)
            self.assertIn("`PROJECT.md`", text)

    def test_related_skills_do_not_diverge(self):
        quick = read("quick-build/SKILL.md")
        execute = read("execute-task/SKILL.md")
        execution = read("execute-task/references/portable-workflow.md")
        for content in (quick, execute, execution):
            self.assertIn("`GLOSSARY.md`", content)
        self.assertIn("`GLOSSARY-MAP.md`", quick)
        self.assertIn("`PROJECT.md`", quick)
        self.assertIn("does not require or create a glossary", quick)
        self.assertIn("Do not automatically", execute)

    def test_no_active_context_as_glossary_claims(self):
        files = (
            "grill-to-build/SKILL.md",
            "grill-to-build/references/grilling-and-modeling.md",
            "grill-to-build/references/specification-tickets-and-build.md",
            "grill-to-build/references/presentation-and-interaction.md",
            "grill-to-build/README.md",
        )
        forbidden = (
            "Context defines terminology",
            "Context as shared terminology",
            "canonical Context sections",
            "default Markdown/Mermaid in `Context.md`",
        )
        for path in files:
            body = read(path)
            for bad in forbidden:
                with self.subTest(file=path, stale=bad):
                    self.assertNotIn(bad, body)


if __name__ == "__main__":
    unittest.main()
