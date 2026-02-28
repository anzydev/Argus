"""
ngrams.py — Convert a flat AST node list into a set of N-gram tuples.
"""


def generate_ngrams(nodes: list[str], n: int = 3) -> set[tuple[str, ...]]:
    """
    Produce a set of N-gram tuples from a list of AST node type names.

    A sliding window of size `n` is moved across the list one step at a
    time. Each window becomes a tuple that forms one N-gram.

    Args:
        nodes: List of AST node type name strings (e.g. ['FunctionDef', 'Assign']).
        n:     The desired N-gram size (window length). Must be >= 1.

    Returns:
        A set of tuples, each of length `n`. Returns an empty set if
        the node list is shorter than `n`.
    """
    if n < 1:
        raise ValueError(f"N-gram size must be >= 1, got {n}")
    if len(nodes) < n:
        return set()
    return {tuple(nodes[i + j] for j in range(n)) for i in range(len(nodes) - n + 1)}
