"""
similarity.py — Jaccard Similarity calculation between two N-gram sets.
"""


def jaccard_similarity(set_a: set[tuple[str, ...]], set_b: set[tuple[str, ...]]) -> float:
    """
    Calculate the Jaccard Similarity Index between two sets.

    J(A, B) = |A ∩ B| / |A ∪ B|

    Args:
        set_a: First set of N-gram tuples.
        set_b: Second set of N-gram tuples.

    Returns:
        A float in [0.0, 1.0]. Returns 0.0 if both sets are empty
        (to avoid division by zero).
    """
    if not set_a and not set_b:
        return 0.0

    intersection = set_a & set_b
    union = set_a | set_b
    return len(intersection) / len(union)
