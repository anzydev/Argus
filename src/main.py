"""
main.py — CLI entry point for the Argus plagiarism detector.

Usage:
    python src/main.py <file1> <file2> [--ngram-size N]
"""

import argparse
import sys
import os

# Allow running as `python src/main.py` from the project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.parser import read_file, get_ast_nodes
from src.ngrams import generate_ngrams
from src.similarity import jaccard_similarity

PLAGIARISM_THRESHOLD = 0.70


def analyze(file1: str, file2: str, ngram_size: int) -> None:
    print("\n" + "═" * 55)
    print("  👁️  ARGUS — Code Plagiarism Detector")
    print("═" * 55)
    print(f"  File 1 : {file1}")
    print(f"  File 2 : {file2}")
    print(f"  N-gram : {ngram_size}")
    print("═" * 55)

    try:
        code1 = read_file(file1)
        code2 = read_file(file2)
    except FileNotFoundError as e:
        print(f"\n  ❌  Error: {e}")
        sys.exit(1)

    try:
        nodes1 = get_ast_nodes(code1)
        nodes2 = get_ast_nodes(code2)
    except SyntaxError as e:
        print(f"\n  ❌  Syntax error in one of the files: {e}")
        sys.exit(1)

    ngrams1 = generate_ngrams(nodes1, ngram_size)
    ngrams2 = generate_ngrams(nodes2, ngram_size)
    score = jaccard_similarity(ngrams1, ngrams2)

    print(f"\n  Structural Similarity Score : {score * 100:.1f}%")
    print(f"  N-grams in File 1          : {len(ngrams1)}")
    print(f"  N-grams in File 2          : {len(ngrams2)}")
    print(f"  Shared N-grams             : {len(ngrams1 & ngrams2)}")
    print(f"  Union N-grams              : {len(ngrams1 | ngrams2)}")

    print()
    if score >= PLAGIARISM_THRESHOLD:
        print("  ⚠️  WARNING: High structural overlap detected. Plagiarism suspected.")
    elif score >= 0.40:
        print("  🔍  NOTICE: Moderate structural overlap. Manual review recommended.")
    else:
        print("  ✅  CLEAR: Low structural similarity. No plagiarism detected.")

    print("═" * 55 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="Argus — AST-based structural code plagiarism detector for Python."
    )
    parser.add_argument("file1", help="Path to the first Python file.")
    parser.add_argument("file2", help="Path to the second Python file.")
    parser.add_argument(
        "--ngram-size",
        type=int,
        default=3,
        metavar="N",
        help="Size of the N-gram window (default: 3).",
    )
    args = parser.parse_args()

    if args.ngram_size < 1:
        print("  ❌  Error: --ngram-size must be >= 1.")
        sys.exit(1)

    analyze(args.file1, args.file2, args.ngram_size)


if __name__ == "__main__":
    main()
