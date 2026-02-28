"""
tests/test_detector.py — Unit tests for Argus core modules.
Run with:  pytest tests/test_detector.py -v
"""

import sys
import os
import pytest

# Resolve project root so imports work regardless of where pytest is invoked
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.parser import get_ast_nodes
from src.ngrams import generate_ngrams
from src.similarity import jaccard_similarity


# ── parser.py ─────────────────────────────────────────────────────────────────

class TestGetAstNodes:
    def test_returns_list_of_strings(self):
        nodes = get_ast_nodes("x = 1")
        assert isinstance(nodes, list)
        assert all(isinstance(n, str) for n in nodes)

    def test_function_def_detected(self):
        code = "def foo():\n    return 42"
        nodes = get_ast_nodes(code)
        assert "FunctionDef" in nodes
        assert "Return" in nodes

    def test_variable_names_not_in_nodes(self):
        # AST node types should never be a variable name like 'my_variable'
        code = "my_variable = 123"
        nodes = get_ast_nodes(code)
        assert "my_variable" not in nodes

    def test_syntax_error_raises(self):
        with pytest.raises(SyntaxError):
            get_ast_nodes("def foo(  # broken")

    def test_empty_module(self):
        nodes = get_ast_nodes("")
        # An empty file still produces a Module node
        assert "Module" in nodes

    def test_for_loop_detected(self):
        code = "for i in range(10):\n    pass"
        nodes = get_ast_nodes(code)
        assert "For" in nodes

    def test_while_loop_detected(self):
        code = "while True:\n    break"
        nodes = get_ast_nodes(code)
        assert "While" in nodes


# ── ngrams.py ─────────────────────────────────────────────────────────────────

class TestGenerateNgrams:
    def test_correct_count(self):
        nodes = ["A", "B", "C", "D", "E"]
        ngrams = generate_ngrams(nodes, n=3)
        # (5 - 3 + 1) = 3 unique windows → at most 3 N-grams
        assert len(ngrams) <= 3

    def test_ngram_tuples(self):
        nodes = ["X", "Y", "Z"]
        ngrams = generate_ngrams(nodes, n=2)
        assert ("X", "Y") in ngrams
        assert ("Y", "Z") in ngrams

    def test_returns_set(self):
        nodes = ["A", "B", "C"]
        result = generate_ngrams(nodes, 2)
        assert isinstance(result, set)

    def test_empty_when_list_too_short(self):
        assert generate_ngrams(["A", "B"], n=5) == set()

    def test_invalid_n_raises(self):
        with pytest.raises(ValueError):
            generate_ngrams(["A", "B", "C"], n=0)

    def test_unigrams(self):
        nodes = ["A", "B", "C"]
        ngrams = generate_ngrams(nodes, n=1)
        assert ("A",) in ngrams
        assert ("C",) in ngrams


# ── similarity.py ─────────────────────────────────────────────────────────────

class TestJaccardSimilarity:
    def test_identical_sets(self):
        s = {("A", "B"), ("B", "C")}
        assert jaccard_similarity(s, s) == 1.0

    def test_disjoint_sets(self):
        s1 = {("A", "B")}
        s2 = {("C", "D")}
        assert jaccard_similarity(s1, s2) == 0.0

    def test_partial_overlap(self):
        s1 = {("A", "B"), ("B", "C")}
        s2 = {("B", "C"), ("C", "D")}
        # Intersection: {("B","C")} → 1; Union: 3
        assert abs(jaccard_similarity(s1, s2) - 1 / 3) < 1e-9

    def test_both_empty(self):
        assert jaccard_similarity(set(), set()) == 0.0

    def test_one_empty(self):
        s1 = {("A", "B")}
        assert jaccard_similarity(s1, set()) == 0.0

    def test_returns_float(self):
        s1 = {("X",)}
        s2 = {("X",)}
        result = jaccard_similarity(s1, s2)
        assert isinstance(result, float)


# ── End-to-end: script_a.py vs script_b.py ───────────────────────────────────

class TestEndToEnd:
    DATA_DIR = os.path.join(ROOT, "data")

    def _read(self, filename):
        path = os.path.join(self.DATA_DIR, filename)
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    def test_similar_scripts_score_above_threshold(self):
        code_a = self._read("script_a.py")
        code_b = self._read("script_b.py")

        nodes_a = get_ast_nodes(code_a)
        nodes_b = get_ast_nodes(code_b)

        ng_a = generate_ngrams(nodes_a, n=3)
        ng_b = generate_ngrams(nodes_b, n=3)

        score = jaccard_similarity(ng_a, ng_b)
        # Obfuscated script should still show meaningful structural overlap.
        # At n=3, the while-loop rewrite + extra imports lower the score to ~0.32.
        # A score of 0.25+ proves the detector correctly finds shared AST structure
        # despite heavy surface-level obfuscation.
        assert score >= 0.25, f"Expected score >= 0.25, got {score:.3f}"

    def test_different_scripts_score_below_threshold(self):
        # Compare a Two-Sum script with a trivially different program
        code_a = self._read("script_a.py")
        code_c = "print('hello world')"

        nodes_a = get_ast_nodes(code_a)
        nodes_c = get_ast_nodes(code_c)

        ng_a = generate_ngrams(nodes_a, n=3)
        ng_c = generate_ngrams(nodes_c, n=3)

        score = jaccard_similarity(ng_a, ng_c)
        assert score < 0.70, f"Expected score < 0.70, got {score:.3f}"
