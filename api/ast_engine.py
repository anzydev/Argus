"""
ast_engine.py — Self-contained AST analysis engine for the FastAPI server.
Extracts AST node-type sequences, builds N-grams, and computes Jaccard similarity.
"""

import tree_sitter
from tree_sitter import Language, Parser
from typing import Any

import tree_sitter_python
import tree_sitter_java
import tree_sitter_cpp
import tree_sitter_javascript
import tree_sitter_html
import tree_sitter_css
import tree_sitter_rust

LANGUAGES = {
    "python": Language(tree_sitter_python.language()),
    "java": Language(tree_sitter_java.language()),
    "cpp": Language(tree_sitter_cpp.language()),
    "javascript": Language(tree_sitter_javascript.language()),
    "html": Language(tree_sitter_html.language()),
    "css": Language(tree_sitter_css.language()),
    "rust": Language(tree_sitter_rust.language()),
}

def extract_nodes(code: str, language_name: str = "python") -> list[str]:
    """
    Parse source code using Tree-sitter and return a structurally ordered list of AST node type names.
    Ignores generic noise nodes.
    """
    language = LANGUAGES.get(language_name.lower())
    if not language:
        language = LANGUAGES["python"] # fallback
        
    parser = Parser(language)
    tree = parser.parse(bytes(code, "utf8"))
    
    nodes = []
    
    # Generic nodes that occur everywhere and dilute structural uniqueness
    IGNORED_NODES = {"module", "program", "document"}
    
    def traverse(node):
        if node.is_named and node.type not in IGNORED_NODES:
            nodes.append(node.type)
        for child in node.children:
            traverse(child)
            
    traverse(tree.root_node)
    
    if not nodes:
        nodes.append("empty")
        
    return nodes

def get_ngrams(nodes: list[str], n: int = 3) -> set[tuple[str, ...]]:
    """Return a set of N-gram tuples from the given node list."""
    if n < 1 or len(nodes) < n:
        return set()
    return {tuple(nodes[i : i + n]) for i in range(len(nodes) - n + 1)}


def compare(code1: str, code2: str, n: int = 3, language: str = "python") -> dict[str, Any]:
    """
    Compare two source strings structurally using Tree-sitter.

    Returns a dict with:
        score            — Jaccard similarity as a float [0, 1]
        ngrams_a_count   — number of unique N-grams in code1
        ngrams_b_count   — number of unique N-grams in code2
        intersection     — shared N-gram count
        union            — union N-gram count
        nodes_a_count    — number of AST nodes in code1
        nodes_b_count    — number of AST nodes in code2
    """
    nodes1 = extract_nodes(code1, language)
    nodes2 = extract_nodes(code2, language)

    ng1 = get_ngrams(nodes1, n)
    ng2 = get_ngrams(nodes2, n)

    intersection = ng1 & ng2
    union = ng1 | ng2
    score = len(intersection) / len(union) if union else 0.0

    return {
        "score": round(score, 6),
        "ngrams_a_count": len(ng1),
        "ngrams_b_count": len(ng2),
        "intersection": len(intersection),
        "union": len(union),
        "nodes_a_count": len(nodes1),
        "nodes_b_count": len(nodes2),
    }
