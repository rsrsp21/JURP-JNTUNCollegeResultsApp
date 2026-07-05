import argparse

from dotenv import load_dotenv

from apps.admin.common import ADMIN_ENV_PATH, ROOT_DIR
from apps.admin.utils import portal_db


def parse_years(raw_years):
    if not raw_years:
        return None
    return [year.strip() for year in raw_years.split(',') if year.strip()]


def main():
    parser = argparse.ArgumentParser(
        description='Create and backfill the D1 academic summary table from student_cgpa.'
    )
    parser.add_argument(
        '--years',
        help='Comma-separated batch years to backfill. Defaults to every batch_year currently in student_cgpa.',
    )
    parser.add_argument(
        '--skip-schema',
        action='store_true',
        help='Skip CREATE TABLE/INDEX statements and only refresh summary rows.',
    )
    args = parser.parse_args()

    load_dotenv(ADMIN_ENV_PATH)

    if not portal_db.is_portal_db_configured():
        raise SystemExit('Missing D1 configuration. Set D1_ACCOUNT_ID, D1_DATABASE_ID, and D1_API_TOKEN.')

    if not args.skip_schema:
        portal_db.apply_schema()
        print('D1 schema applied.')

    years = parse_years(args.years)
    total = portal_db.refresh_all_academic_summaries(years)
    print(f'Academic summary rows refreshed: {total}')


if __name__ == '__main__':
    main()
