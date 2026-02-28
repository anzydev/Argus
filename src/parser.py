"""
parser.py — File ingestion and AST node extraction.
"""

import ast


def read_file(path: str) -> str:
    """Read a .py file and return its content as a string."""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def get_ast_nodes(code: str) -> list[str]:
    """
    Parse Python source code into an AST and extract a flat list of
    node type names via a depth-first walk.

    Only structural node types are kept — variable names, string
    literals, and comments are completely ignored.

    Raises:
        SyntaxError: if the code is not valid Python.
    """
    tree = ast.parse(code)
    nodes = [type(node).__name__ for node in ast.walk(tree)]
    return nodes
