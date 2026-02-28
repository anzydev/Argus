"""
data/script_a.py — Clean Two-Sum solution using a hash map.
Used by Argus as a reference sample for plagiarism detection testing.
"""


def two_sum(numbers: list, target: int) -> list:
    """
    Find indices of two numbers that add up to target.
    Uses a hash map for O(n) time complexity.
    """
    seen = {}
    for index, value in enumerate(numbers):
        complement = target - value
        if complement in seen:
            return [seen[complement], index]
        seen[value] = index
    return []


if __name__ == "__main__":
    nums = [2, 7, 11, 15]
    t = 9
    result = two_sum(nums, t)
    print(f"Input: {nums}, Target: {t}")
    print(f"Output: {result}")  # Expected: [0, 1]
