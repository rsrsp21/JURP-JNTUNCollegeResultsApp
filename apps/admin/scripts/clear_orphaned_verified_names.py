import argparse
import re

from dotenv import load_dotenv

from apps.admin.common import ADMIN_ENV_PATH
from apps.admin.utils import d1_storage
from apps.admin.utils.r2_storage import is_r2_configured, list_keys_under


ID_IMAGES_PREFIX = 'idsImages'
ROLL_PATTERN = re.compile(r'^([0-9]{2}[0-9A-Z]{3}A[0-9A-Z]{4})\.(jpg|jpeg|png|webp)$', re.IGNORECASE)


def rolls_with_id_image():
    rolls = set()
    for item in list_keys_under(ID_IMAGES_PREFIX):
        match = ROLL_PATTERN.match(item['name'])
        if match:
            rolls.add(match.group(1).upper())
    return rolls


def rolls_with_saved_name():
    rows = d1_storage.query(
        "SELECT student_id, name, name_status FROM student_cgpa WHERE name IS NOT NULL AND name != ''"
    )
    return {row['student_id'].upper(): row for row in rows}


def main():
    parser = argparse.ArgumentParser(
        description='Find (and optionally clear) student_cgpa rows whose verified name has no matching R2 ID image.'
    )
    parser.add_argument('--apply', action='store_true', help='Actually run the UPDATE. Default is dry-run (print only).')
    args = parser.parse_args()

    load_dotenv(ADMIN_ENV_PATH)

    if not is_r2_configured():
        raise SystemExit('Missing R2 configuration.')
    if not d1_storage.is_d1_configured():
        raise SystemExit('Missing D1 configuration. Set D1_ACCOUNT_ID, D1_DATABASE_ID, and D1_API_TOKEN.')

    has_image = rolls_with_id_image()
    named_rows = rolls_with_saved_name()

    orphaned = sorted(roll for roll in named_rows if roll not in has_image)

    if not orphaned:
        print('No orphaned rows found: every saved name has a matching R2 ID image.')
        return

    print(f'Found {len(orphaned)} row(s) with a saved name but no R2 ID image:')
    for roll in orphaned:
        row = named_rows[roll]
        print(f"  {roll}\tname={row['name']!r}\tname_status={row['name_status']!r}")

    if not args.apply:
        print('\nDry run only - no changes made. Re-run with --apply to clear these rows.')
        return

    placeholders = ','.join('?' * len(orphaned))
    d1_storage.execute(
        f"""
        UPDATE student_cgpa
        SET name = NULL, name_status = NULL, grade_card_name = NULL
        WHERE student_id IN ({placeholders})
        """,
        orphaned,
    )
    print(f'\nCleared {len(orphaned)} row(s). Affected students can now re-verify their name.')


if __name__ == '__main__':
    main()
