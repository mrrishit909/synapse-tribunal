"""Check that freshly regenerated fixtures match the committed ones (CI parity step).

    python -I scripts/compare_fixtures.py public/data/precomputed/*.json

Each file is compared with its committed version (`git show HEAD:<path>`): same structure, same
strings and booleans, every number within 1e-4 (the project's documented Python/TypeScript parity
bound). Not byte-for-byte: scikit-learn's lbfgs lands ~1e-7 apart on Linux vs macOS BLAS, which a
plain `git diff` reports as a full rewrite.
"""
import json
import subprocess
import sys

TOL = 1e-4


def diffs(a, b, path="$"):
    if isinstance(a, bool) or isinstance(b, bool) or not (
        isinstance(a, (int, float)) and isinstance(b, (int, float))
    ):
        if type(a) is not type(b):
            yield f"{path}: type {type(a).__name__} != {type(b).__name__}"
        elif isinstance(a, dict):
            if a.keys() != b.keys():
                yield f"{path}: keys differ {sorted(a.keys() ^ b.keys())[:5]}"
            for k in a.keys() & b.keys():
                yield from diffs(a[k], b[k], f"{path}.{k}")
        elif isinstance(a, list):
            if len(a) != len(b):
                yield f"{path}: length {len(a)} != {len(b)}"
            for i, (x, y) in enumerate(zip(a, b)):
                yield from diffs(x, y, f"{path}[{i}]")
        elif a != b:
            yield f"{path}: {a!r} != {b!r}"
    elif abs(a - b) > TOL * max(1.0, abs(a), abs(b)):
        yield f"{path}: {a} != {b}"


def main(paths):
    bad = 0
    for p in paths:
        committed = json.loads(subprocess.run(["git", "show", f"HEAD:{p}"], check=True, capture_output=True).stdout)
        found = list(diffs(committed, json.load(open(p))))
        print(f"{'FAIL' if found else 'ok  '} {p}" + (f" ({len(found)} differences)" if found else ""))
        for d in found[:10]:
            print("     ", d)
        bad += bool(found)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
