import argparse
import json
import os

from dotenv import load_dotenv

from apps.admin.common import ADMIN_ENV_PATH, ROOT_DIR
from apps.admin.utils import portal_db
from apps.admin.utils.r2_storage import is_r2_configured, read_text_key


DEFAULT_BATCH_YEARS = ['2021', '2022', '2023', '2024', '2025']


class WriteBudget:
    def __init__(self, max_new_rows=None):
        self.remaining = max_new_rows
        self.stopped = False

    def allow(self, label, estimated_new_rows):
        if self.remaining is None:
            return True
        estimated_new_rows = int(estimated_new_rows or 0)
        if estimated_new_rows > self.remaining:
            print(
                f'{label} paused: estimated {estimated_new_rows} new row writes, '
                f'but --max-new-rows has {self.remaining} remaining.'
            )
            self.stopped = True
            return False
        self.remaining -= estimated_new_rows
        return True


def read_optional_r2_key(key):
    try:
        _, content = read_text_key(key)
        return content
    except Exception as exc:
        message = str(exc)
        if 'NoSuchKey' in message or '404' in message or 'not found' in message.lower():
            return None
        raise


def parse_years(raw_years):
    if raw_years:
        return [year.strip() for year in raw_years.split(',') if year.strip()]

    env_years = os.getenv('D1_MIGRATION_BATCH_YEARS')
    if env_years:
        return [year.strip() for year in env_years.split(',') if year.strip()]

    return DEFAULT_BATCH_YEARS


def migrate_year(year, force_replace=False, budget=None):
    imported = {
        'cgpa_rows': 0,
        'semester_rows': 0,
        'toppers_rows': 0,
    }

    cgpa_key = f'data/cgpa_data_{year}.csv'
    cgpa_content = read_optional_r2_key(cgpa_key)
    if cgpa_content:
        if force_replace:
            imported['cgpa_rows'] = portal_db.replace_cgpa_from_csv(year, cgpa_content)
            print(f'{cgpa_key} -> student_cgpa replaced ({imported["cgpa_rows"]} rows)')
        else:
            preview = portal_db.preview_missing_cgpa_from_csv(year, cgpa_content)
            if budget and not budget.allow(cgpa_key, _estimated_cgpa_writes(preview)):
                return imported
            result = portal_db.insert_missing_cgpa_from_csv(year, cgpa_content)
            imported['cgpa_rows'] = result['inserted_rows']
            print(_resume_message(cgpa_key, 'student_cgpa', result))
    else:
        print(f'{cgpa_key} skipped: not found')

    for semester in range(1, 10):
        if budget and budget.stopped:
            return imported

        semester_key = f'data/semesters/{year}/semester{semester}.csv'
        semester_content = read_optional_r2_key(semester_key)
        if not semester_content:
            print(f'{semester_key} skipped: not found')
            continue

        if force_replace:
            row_count = portal_db.replace_semester_from_csv(
                year,
                semester,
                semester_content,
                is_honors_minor=(semester == 9)
            )
            print(f'{semester_key} -> semester_results replaced ({row_count} rows)')
        else:
            preview = portal_db.preview_missing_semester_from_csv(
                year,
                semester,
                semester_content,
                is_honors_minor=(semester == 9)
            )
            if budget and not budget.allow(semester_key, preview['estimated_new_rows']):
                return imported
            result = portal_db.insert_missing_semester_from_csv(
                year,
                semester,
                semester_content,
                is_honors_minor=(semester == 9)
            )
            row_count = result['inserted_rows']
            print(_resume_message(semester_key, 'semester_results', result))
        imported['semester_rows'] += row_count

    toppers_key = f'data/toppers_{year}.csv'
    toppers_content = read_optional_r2_key(toppers_key)
    if toppers_content:
        if force_replace:
            imported['toppers_rows'] = portal_db.replace_toppers_from_csv(year, toppers_content)
            print(f'{toppers_key} -> toppers replaced ({imported["toppers_rows"]} rows)')
        else:
            preview = portal_db.preview_missing_toppers_from_csv(year, toppers_content)
            if budget and not budget.allow(toppers_key, preview['estimated_new_rows']):
                return imported
            result = portal_db.insert_missing_toppers_from_csv(year, toppers_content)
            imported['toppers_rows'] = result['inserted_rows']
            print(_resume_message(toppers_key, 'toppers', result))
    else:
        print(f'{toppers_key} skipped: not found')

    return imported


def migrate_notifications():
    notifications_key = 'data/notifications.json'
    content = read_optional_r2_key(notifications_key)
    if not content:
        print(f'{notifications_key} skipped: not found')
        return 0

    notifications = json.loads(content)
    row_count = portal_db.replace_notifications(notifications)
    print(f'{notifications_key} -> notifications ({row_count} rows)')
    return row_count


def _resume_message(source_key, table_name, result):
    if result['inserted_rows'] == 0 and result['complete']:
        return f'{source_key} -> {table_name} skipped: already complete ({result["existing_rows_after"]}/{result["source_rows"]} rows)'
    return (
        f'{source_key} -> {table_name} inserted {result["inserted_rows"]} missing rows '
        f'({result["existing_rows_after"]}/{result["source_rows"]} present)'
    )


def _estimated_cgpa_writes(preview):
    if preview['complete']:
        return 0
    return preview['estimated_new_rows'] + preview['source_rows']


def main():
    parser = argparse.ArgumentParser(description='Migrate current R2 data/ objects into Cloudflare D1.')
    parser.add_argument('--years', help='Comma-separated batch years to migrate. Defaults to 2021,2022,2023,2024,2025.')
    parser.add_argument('--skip-schema', action='store_true', help='Skip CREATE TABLE/INDEX statements.')
    parser.add_argument('--force-replace', action='store_true', help='Rewrite/prune D1 rows instead of resume-safe missing-row inserts.')
    parser.add_argument('--max-new-rows', type=int, help='Pause before a file whose estimated row writes would exceed this budget.')
    args = parser.parse_args()

    load_dotenv(ADMIN_ENV_PATH)

    if not is_r2_configured():
        raise SystemExit('Missing R2 configuration. Existing data/ objects are read from R2 for this one-time migration.')
    if not portal_db.is_portal_db_configured():
        raise SystemExit('Missing D1 configuration. Set D1_ACCOUNT_ID, D1_DATABASE_ID, and D1_API_TOKEN.')

    if not args.skip_schema:
        portal_db.apply_schema()
        print('D1 schema applied.')

    totals = {
        'cgpa_rows': 0,
        'semester_rows': 0,
        'toppers_rows': 0,
        'notification_rows': 0,
    }
    budget = WriteBudget(args.max_new_rows)

    for year in parse_years(args.years):
        if budget.stopped:
            break
        print(f'\nMigrating batch {year}')
        imported = migrate_year(year, force_replace=args.force_replace, budget=budget)
        for key, value in imported.items():
            totals[key] += value

    if not budget.stopped:
        totals['notification_rows'] = migrate_notifications()
    else:
        print('\nMigration paused by --max-new-rows. Re-run the same command later to resume.')

    print('\nMigration complete.')
    for key, value in totals.items():
        print(f'{key}: {value}')


if __name__ == '__main__':
    main()
