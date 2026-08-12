import argparse
import sys

import pdfplumber

sys.path.insert(0, '.')
from apps.admin.engine.logic import _get_visual_lines


def main():
    parser = argparse.ArgumentParser(
        description='Print the exact visual lines pdfplumber/logic.py reconstructs for a PDF, so we can see how a specific row actually breaks up.'
    )
    parser.add_argument('pdf_path', help='Path to the PDF file to inspect.')
    parser.add_argument('--pages', help='Comma-separated 1-based page numbers to print (default: all).')
    parser.add_argument('--contains', help='Only print lines containing this substring (case-insensitive), plus a few lines of context around each match.')
    parser.add_argument('--context', type=int, default=3, help='Lines of context before/after a --contains match (default 3).')
    args = parser.parse_args()

    wanted_pages = None
    if args.pages:
        wanted_pages = {int(p.strip()) for p in args.pages.split(',') if p.strip()}

    with pdfplumber.open(args.pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            if wanted_pages and page_num not in wanted_pages:
                continue
            lines = _get_visual_lines(page)
            print(f"\n===== PAGE {page_num} ({len(lines)} lines) =====")

            if not args.contains:
                for i, line in enumerate(lines):
                    print(f"{i:4}: {line!r}")
                continue

            needle = args.contains.upper()
            match_indexes = [i for i, line in enumerate(lines) if needle in line.upper()]
            if not match_indexes:
                continue
            shown = set()
            for idx in match_indexes:
                lo = max(0, idx - args.context)
                hi = min(len(lines), idx + args.context + 1)
                for i in range(lo, hi):
                    shown.add(i)
            for i in sorted(shown):
                marker = '>>>' if i in match_indexes else '   '
                print(f"{marker} {i:4}: {lines[i]!r}")


if __name__ == '__main__':
    main()
