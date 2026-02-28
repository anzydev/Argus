"""
data/script_b.py — Obfuscated Two-Sum solution.
All variables are renamed to single letters, for-loop converted to while-loop,
and spurious print statements are injected — but the AST structure is identical.
Argus should detect HIGH similarity (~85%+) with script_a.py.
"""
import random


def xQ7(z: list, k: int) -> list:
    print("starting process...")
    q = {}
    p = 0
    print(f"DEBUG: list length is {len(z)}")
    while p < len(z):
        v = z[p]
        print("iteration:", p, "value:", v)
        r = k - v
        if r in q:
            print("match found!")
            return [q[r], p]
        q[v] = p
        p += 1
    print("no result found")
    return []


if __name__ == "__main__":
    a = [2, 7, 11, 15]
    b = 9
    print(random.random())   # useless noise
    c = xQ7(a, b)
    print(c)
