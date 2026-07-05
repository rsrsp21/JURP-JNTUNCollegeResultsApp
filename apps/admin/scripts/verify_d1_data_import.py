import argparse
import io
import json

import pandas as pd
from dotenv import load_dotenv

from apps.admin.common import ADMIN_ENV_PATH, ROOT_DIR
from apps.admin.utils import d1_storage, portal_db
from apps.admin.utils.r2_storage import is_r2_configured, read_text_key


DEFAULT_BATCH_YEARS = ['2021', '2022', '2023', '2024', '2025']


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
    if not raw_years:
        return DEFAULT_BATCH_YEARS
    return [year.strip() for year in raw_years.split(',') if year.strip()]


def dataframe_from_csv(csv_text):
    return pd.read_csv(io.StringIO(csv_text), encoding='utf-8-sig')


def expected_counts_from_r2(years):
    expected = {
        'student_cgpa': {},
        'student_academic_summary': {},
        'semester_results': {},
        'toppers': {},
        'notifications': None,
    }

    for year in years:
        cgpa_content = read_optional_r2_key(f'data/cgpa_data_{year}.csv')
        if cgpa_content:
            rows = portal_db._cgpa_rows_from_dataframe(
                year,
                dataframe_from_csv(cgpa_content),
                sync_token='verify',
            )
            expected['student_cgpa'][year] = len(rows)
            expected['student_academic_summary'][year] = len(rows)

        for semester in range(1, 10):
            semester_content = read_optional_r2_key(f'data/semesters/{year}/semester{semester}.csv')
            if not semester_content:
                continue
            rows = portal_db._semester_rows_from_dataframe(
                year,
                semester,
                dataframe_from_csv(semester_content),
                is_honors_minor=(semester == 9),
                sync_token='verify',
            )
            expected['semester_results'][(year, semester)] = len(rows)

        toppers_content = read_optional_r2_key(f'data/toppers_{year}.csv')
        if toppers_content:
            rows = portal_db._toppers_rows_from_dataframe(
                year,
                dataframe_from_csv(toppers_content),
                sync_token='verify',
            )
            expected['toppers'][year] = len(rows)

    notifications_content = read_optional_r2_key('data/notifications.json')
    if notifications_content:
        notifications = json.loads(notifications_content)
        expected['notifications'] = sum(
            1 for item in notifications or []
            if isinstance(item, dict) and str(item.get('text') or '').strip()
        )

    return expected


def actual_counts_from_d1():
    return {
        'student_cgpa': {
            row['batch_year']: int(row['row_count'])
            for row in d1_storage.query(
                'SELECT batch_year, COUNT(*) AS row_count FROM student_cgpa GROUP BY batch_year',
                timeout=60,
            )
        },
        'student_academic_summary': {
            row['batch_year']: int(row['row_count'])
            for row in d1_storage.query(
                'SELECT batch_year, COUNT(*) AS row_count FROM student_academic_summary GROUP BY batch_year',
                timeout=60,
            )
        },
        'semester_results': {
            (row['batch_year'], int(row['semester_number'])): int(row['row_count'])
            for row in d1_storage.query(
                """
                SELECT batch_year, semester_number, COUNT(*) AS row_count
                FROM semester_results
                GROUP BY batch_year, semester_number
                """,
                timeout=60,
            )
        },
        'toppers': {
            row['batch_year']: int(row['row_count'])
            for row in d1_storage.query(
                'SELECT batch_year, COUNT(*) AS row_count FROM toppers GROUP BY batch_year',
                timeout=60,
            )
        },
        'notifications': _single_count('SELECT COUNT(*) AS row_count FROM notifications'),
    }


def _single_count(sql):
    rows = d1_storage.query(sql, timeout=60)
    if not rows:
        return 0
    return int(rows[0].get('row_count') or 0)


def print_comparison(years, expected, actual):
    missing = []

    print('\nD1 import verification')
    print('======================')

    for year in years:
        missing.extend(compare_item('student_cgpa', year, expected['student_cgpa'].get(year), actual['student_cgpa'].get(year, 0)))
        missing.extend(compare_item('student_academic_summary', year, expected['student_academic_summary'].get(year), actual['student_academic_summary'].get(year, 0)))

        for semester in range(1, 10):
            key = (year, semester)
            if key not in expected['semester_results']:
                continue
            label = f'{year} semester{semester}'
            missing.extend(compare_item('semester_results', label, expected['semester_results'].get(key), actual['semester_results'].get(key, 0)))

        missing.extend(compare_item('toppers', year, expected['toppers'].get(year), actual['toppers'].get(year, 0)))

    if expected['notifications'] is not None:
        missing.extend(compare_item('notifications', 'all', expected['notifications'], actual['notifications']))

    if missing:
        print('\nMissing/incomplete items:')
        for item in missing:
            print(f'- {item}')
    else:
        print('\nAll checked D1 counts match the R2 data source.')


def compare_item(table, label, expected, actual):
    if expected is None:
        print(f'{table:24} {label:16} source missing, D1={actual}')
        return []

    status = 'OK' if actual >= expected else 'MISSING'
    print(f'{table:24} {label:16} expected={expected:<6} D1={actual:<6} {status}')
    if actual >= expected:
        return []
    return [f'{table} {label}: missing {expected - actual} rows']


def main():
    parser = argparse.ArgumentParser(description='Compare D1 import counts against existing R2 data/ source files.')
    parser.add_argument('--years', help='Comma-separated batch years. Defaults to 2021,2022,2023,2024,2025.')
    args = parser.parse_args()

    load_dotenv(ADMIN_ENV_PATH)

    if not is_r2_configured():
        raise SystemExit('Missing R2 configuration. This verification reads old R2 data/ source files.')
    if not portal_db.is_portal_db_configured():
        raise SystemExit('Missing D1 configuration. Set D1_ACCOUNT_ID, D1_DATABASE_ID, and D1_API_TOKEN.')

    years = parse_years(args.years)
    expected = expected_counts_from_r2(years)
    actual = actual_counts_from_d1()
    print_comparison(years, expected, actual)


if __name__ == '__main__':
    main()
