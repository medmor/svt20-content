#!/usr/bin/env python3
"""One-off migration: move flat images/* files into content-mirrored dirs.

Moves (all via `git mv`, so no new blobs are created):
  images/chapters_<uuid>_<hash>.<ext>   -> images/chapters/{level}/{unit}/{chapter-slug}/
  images/exercises_<gdriveId>_<hash>.*   -> images/exercises/{level}/{unit}/{chapter}/{exercise}/
  images/exams_<gdriveId>_<hash>.*       -> images/exams/{branch}/{year}{Normal|Rattrapage}{BRANCH}/

Then rewrites every absolute CDN reference (2163 occurrences across the
repo) to the new path. Basenames are shortened to their trailing
hash segment (e.g. chapters_<uuid>_<hash>.png -> <hash>.png) since the
new directory already encodes the context — and full names would breach
the Windows 260-char path limit in deeply nested chapter dirs.

Untouched: images/exams/{branch}/{yearSession}/ (1280 files),
images/figures/ (168 files, pinned by figures.json + svt20 DB).

Usage:
  python scripts/migrate-images.py          # dry run: print plan, change nothing
  python scripts/migrate-images.py --apply  # execute moves + ref rewrite
"""
import collections
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CDN_PREFIX = "https://medmor.github.io/svt20-content/images/"
URL_RE = re.compile(r"https://medmor\.github\.io/svt20-content/images/([^\"'\s)]+)")
SCAN_EXTS = (".html", ".json", ".md")
SKIP_DIRS = (".git", "node_modules")


def git(*args):
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("git %s failed:\n%s" % (" ".join(args), r.stderr))
    return r.stdout


def uuid_map():
    with open(os.path.join(ROOT, "index.json"), encoding="utf-8") as f:
        idx = json.load(f)
    m = {}
    for lv in idx["levels"]:
        for un in lv["units"]:
            for ch in un["chapters"]:
                m[ch["id"]] = (lv["slug"], un["slug"], ch["slug"])
    return m


def scan_owners():
    """Return {image_relpath: set(referencing repo-relative files)}."""
    owners = collections.defaultdict(set)
    for dp, _, fn in os.walk(ROOT):
        if any(x in dp for x in SKIP_DIRS):
            continue
        for f in fn:
            if not f.endswith(SCAN_EXTS):
                continue
            p = os.path.join(dp, f)
            try:
                with open(p, encoding="utf-8") as fh:
                    content = fh.read()
            except (UnicodeDecodeError, OSError):
                continue
            for m in URL_RE.findall(content):
                owners["images/" + m].add(os.path.relpath(p, ROOT).replace(os.sep, "/"))
    return owners


def build_plan():
    uuid2path = uuid_map()
    owners = scan_owners()
    tracked = set(git("ls-files", "images").split())
    flat = sorted(
        p for p in tracked
        if p.startswith("images/") and "/" not in p[len("images/"):]
    )
    moves = {}   # old relpath -> new relpath
    refs = {}    # old relpath -> set of owner files
    problems = []

    def target_for(base, o):
        """Return target dir (without basename) or None if unmappable."""
        parts = o.split("/")
        if base.startswith("chapters_"):
            uuid = base.split("_")[1]
            if uuid in uuid2path:
                lv, un, sl = uuid2path[uuid]
                expect = "chapters/%s/%s/%s.html" % (lv, un, sl)
                if o != expect and not o.endswith(".fiche.html"):
                    return None  # UUID/OWNER MISMATCH
                return "images/chapters/%s/%s/%s" % (lv, un, sl)
            if o.startswith("chapters/") and o.count("/") == 3:
                return "images/chapters/%s/%s/%s" % (
                    parts[1], parts[2], parts[3][:-5])
            return None
        if base.startswith("exercises_"):
            if o.startswith("exercises/") and o.count("/") == 4 and o.endswith(".html"):
                return "images/exercises/%s/%s/%s/%s" % (
                    parts[1], parts[2], parts[3], parts[4][:-5])
            return None
        if base.startswith("exams_"):
            if o.startswith("exams/") and len(parts) == 5 and parts[1].isdigit():
                year, branch, sess = parts[1], parts[2], parts[3]
                sess_cap = "Normal" if sess.lower().startswith("norm") else "Rattrapage"
                return "images/exams/%s/%s%s%s" % (
                    branch.lower(), year, sess_cap, branch.upper())
            return None
        return None

    for old in flat:
        base = old[len("images/"):]
        old_url = CDN_PREFIX + base
        url_path = "images/" + base
        own = sorted(owners.get(url_path, ()))
        if not own:
            problems.append("ORPHAN (no referencing file): %s" % old)
            continue
        targets = {target_for(base, o) for o in own}
        if None in targets:
            problems.append("UNMAPPABLE %s <- %s" % (old, own))
            continue
        if len(targets) > 1:
            problems.append("CONFLICTING OWNERS %s <- %s" % (old, own))
            continue
        moves[old] = targets.pop() + "/" + base
        refs[old] = set(own)

    # Shorten basenames to the trailing segment (hash + ext).
    # The redundant prefix (chapters_<uuid>_ / exercises_<id>_ / exams_<id>_)
    # is already encoded by the new directory, and full-length names breach
    # the Windows 260-char path limit inside deeply nested chapter dirs.
    short = {}
    for old, new in moves.items():
        d, base = new.rsplit("/", 1)
        short[old] = d + "/" + base.rsplit("_", 1)[1]
    taken = collections.defaultdict(list)
    for old, new in short.items():
        taken[new].append(old)
    for new, olds in taken.items():
        if len(olds) > 1:
            problems.append("FILENAME COLLISION after shorten: %s <- %s" % (new, olds))
    for new in short.values():
        if len(os.path.join(ROOT, new.replace("/", os.sep))) >= 250:
            problems.append("PATH STILL TOO LONG: %s" % new)
    moves = short

    return moves, refs, problems


def main():
    apply = "--apply" in sys.argv
    moves, refs, problems = build_plan()

    print("flat images found : %d" % (len(moves) + len(problems)))
    print("mapped to move   : %d" % len(moves))
    by_area = collections.Counter(m.split("/")[1] for m in moves.values())
    print("by target area   : %s" % dict(by_area))
    print("new dirs to make : %d" % len({os.path.dirname(m) for m in moves.values()}))

    if problems:
        print("\nPROBLEMS (aborting):")
        for p in problems:
            print("  " + p)
        sys.exit(1)

    if not apply:
        print("\nDry run only. Re-run with --apply to execute.")
        print("Sample moves:")
        for old in sorted(moves)[:5]:
            print("  %s\n    -> %s" % (old, moves[old]))
        return

    # 1. git mv every file (create destination dirs first: git mv won't)
    for new in sorted(set(moves.values())):
        os.makedirs(os.path.join(ROOT, os.path.dirname(new).replace("/", os.sep)),
                    exist_ok=True)
    for old in sorted(moves):
        git("mv", old, moves[old])
    print("moved %d files" % len(moves))

    # 2. rewrite refs (exact full-URL replacement, encoding/newlines preserved)
    touched = collections.Counter()
    for old in sorted(moves):
        base = old[len("images/"):]
        new_rel = moves[old][len("images/"):]
        old_url = CDN_PREFIX + base
        new_url = CDN_PREFIX + new_rel
        for owner in sorted(refs[old]):
            p = os.path.join(ROOT, owner.replace("/", os.sep))
            with open(p, encoding="utf-8", newline="") as fh:
                content = fh.read()
            n = content.count(old_url)
            assert n > 0, "expected ref missing in %s" % owner
            content = content.replace(old_url, new_url)
            with open(p, "w", encoding="utf-8", newline="") as fh:
                fh.write(content)
            touched[owner] += n
    print("rewrote %d occurrences in %d files" % (sum(touched.values()), len(touched)))

    # 3. verify
    errors = []
    for old, new in moves.items():
        if os.path.exists(os.path.join(ROOT, old.replace("/", os.sep))):
            errors.append("old path still exists: %s" % old)
        if not os.path.exists(os.path.join(ROOT, new.replace("/", os.sep))):
            errors.append("new path missing: %s" % new)
    owners = scan_owners()
    for old in moves:
        base = old[len("images/"):]
        if ("images/" + base) in owners:
            errors.append("stale ref remains: %s" % old)
    warnings = []
    for url_path, own in owners.items():
        if url_path.startswith("images/") and not os.path.exists(
                os.path.join(ROOT, url_path.replace("/", os.sep))):
            if "{level}" not in url_path:  # skip README placeholder
                warnings.append("pre-existing broken ref: %s <- %s"
                                % (url_path, sorted(own)[0]))
    if warnings:
        print("\nWARNINGS (pre-existing, not caused by migration):")
        for w in sorted(set(warnings)):
            print("  " + w)
    for dp, _, fn in os.walk(ROOT):
        if any(x in dp for x in SKIP_DIRS):
            continue
        for f in fn:
            if f.endswith(".json"):
                p = os.path.join(dp, f)
                try:
                    with open(p, encoding="utf-8") as fh:
                        json.load(fh)
                except ValueError:
                    errors.append("invalid JSON: %s" % p)
    if errors:
        print("\nVERIFICATION FAILED:")
        for e in errors:
            print("  " + e)
        sys.exit(1)
    print("verification OK: all refs resolve, no stale refs, JSON valid")


if __name__ == "__main__":
    main()
