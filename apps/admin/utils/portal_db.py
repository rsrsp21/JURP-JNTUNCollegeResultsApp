import csv
import copy
import io
import math
import os
import time
import uuid
from collections import defaultdict

import pandas as pd

from common import ROOT_DIR
from utils.academic_summary import calculate_academic_summary
import utils.d1_storage as d1_storage


BATCH_CONFIG = {
    '2021': {
        'batch_label': '2021-25',
        'regulation': 'R20',
        'prefixes': ('21031A', '22035A'),
    },
    '2022': {
        'batch_label': '2022-26',
        'regulation': 'R20',
        'prefixes': ('22031A', '23035A'),
    },
    '2023': {
        'batch_label': '2023-27',
        'regulation': 'R23',
        'prefixes': ('23031A', '24035A'),
    },
    '2024': {
        'batch_label': '2024-28',
        'regulation': 'R23',
        'prefixes': ('24031A', '25035A'),
    },
    '2025': {
        'batch_label': '2025-29',
        'regulation': 'R23',
        'prefixes': ('25031A', '26035A'),
    },
}

SEMESTER_DB_TO_API = {
    'sgpa_1_1': '1-1',
    'credits_1_1': 'Credits_1-1',
    'sgpa_1_2': '1-2',
    'credits_1_2': 'Credits_1-2',
    'sgpa_2_1': '2-1',
    'credits_2_1': 'Credits_2-1',
    'sgpa_2_2': '2-2',
    'credits_2_2': 'Credits_2-2',
    'sgpa_3_1': '3-1',
    'credits_3_1': 'Credits_3-1',
    'sgpa_3_2': '3-2',
    'credits_3_2': 'Credits_3-2',
    'sgpa_4_1': '4-1',
    'credits_4_1': 'Credits_4-1',
    'sgpa_4_2': '4-2',
    'credits_4_2': 'Credits_4-2',
}

CGPA_API_TO_DB = {
    '1-1': 'sgpa_1_1',
    'Credits_1-1': 'credits_1_1',
    '1-2': 'sgpa_1_2',
    'Credits_1-2': 'credits_1_2',
    '2-1': 'sgpa_2_1',
    'Credits_2-1': 'credits_2_1',
    '2-2': 'sgpa_2_2',
    'Credits_2-2': 'credits_2_2',
    '3-1': 'sgpa_3_1',
    'Credits_3-1': 'credits_3_1',
    '3-2': 'sgpa_3_2',
    'Credits_3-2': 'credits_3_2',
    '4-1': 'sgpa_4_1',
    'Credits_4-1': 'credits_4_1',
    '4-2': 'sgpa_4_2',
    'Credits_4-2': 'credits_4_2',
}

CGPA_INSERT_COLUMNS = [
    'student_id', 'batch_year', 'batch_label', 'regulation',
    'sgpa_1_1', 'credits_1_1', 'sgpa_1_2', 'credits_1_2',
    'sgpa_2_1', 'credits_2_1', 'sgpa_2_2', 'credits_2_2',
    'sgpa_3_1', 'credits_3_1', 'sgpa_3_2', 'credits_3_2',
    'sgpa_4_1', 'credits_4_1', 'sgpa_4_2', 'credits_4_2',
    'total_credits', 'cgpa', 'supplementary_appearances', 'sync_token'
]

ACADEMIC_SUMMARY_INSERT_COLUMNS = [
    'student_id', 'batch_year', 'regulation', 'percentage',
    'percentage_value', 'division', 'division_class',
    'progress_percentage', 'progress_class', 'supplementary_count',
    'sync_token',
]

_CACHE = {}


def clear_runtime_cache():
    _CACHE.clear()


def is_portal_db_configured():
    return d1_storage.is_d1_configured()


def batch_year_from_student_id(student_id):
    student_id = (student_id or '').strip().upper()
    for batch_year, config in BATCH_CONFIG.items():
        if student_id.startswith(config['prefixes']):
            return batch_year
    return None


def batch_metadata(batch_year):
    config = BATCH_CONFIG.get(str(batch_year), {})
    return {
        'batch_label': config.get('batch_label', f'{batch_year}-{str(int(batch_year) + 4)[-2:]}' if str(batch_year).isdigit() else ''),
        'regulation': config.get('regulation', 'R23' if str(batch_year).isdigit() and int(batch_year) >= 2023 else 'R20'),
    }


def apply_schema(schema_path=None):
    if schema_path is None:
        schema_path = ROOT_DIR / 'apps' / 'admin' / 'migrations' / 'd1_schema.sql'
    d1_storage.apply_schema_file(schema_path)


def get_student_cgpa(student_id):
    student_id = student_id.strip().upper()
    cache_key = ('student_cgpa', student_id)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    rows = _query_student_cgpa_with_summary(student_id)
    if not rows:
        return None
    result = _cgpa_db_row_to_api(rows[0], _academic_summary_from_joined_row(rows[0]))
    _cache_set(cache_key, result)
    return result


def get_cgpa_records_by_batch(batch_year):
    try:
        rows = d1_storage.query(
            """
            SELECT c.*,
                   s.percentage AS summary_percentage,
                   s.percentage_value AS summary_percentage_value,
                   s.division AS summary_division,
                   s.division_class AS summary_division_class,
                   s.progress_percentage AS summary_progress_percentage,
                   s.progress_class AS summary_progress_class,
                   s.supplementary_count AS summary_supplementary_count
            FROM student_cgpa c
            LEFT JOIN student_academic_summary s ON s.student_id = c.student_id
            WHERE c.batch_year = ?
            ORDER BY c.student_id
            """,
            [str(batch_year)]
        )
    except RuntimeError as exc:
        if not _is_missing_academic_summary_table_error(exc):
            raise
        rows = d1_storage.query(
            'SELECT * FROM student_cgpa WHERE batch_year = ? ORDER BY student_id',
            [str(batch_year)]
        )
    return [
        _cgpa_db_row_to_api(row, _academic_summary_from_joined_row(row))
        for row in rows
    ]


def get_academic_summary(student_id):
    student_id = student_id.strip().upper()
    cache_key = ('academic_summary', student_id)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        rows = d1_storage.query(
            'SELECT * FROM student_academic_summary WHERE student_id = ? LIMIT 1',
            [student_id]
        )
    except RuntimeError as exc:
        if _is_missing_academic_summary_table_error(exc):
            return None
        raise
    if not rows:
        return None
    result = _academic_summary_db_row_to_api(rows[0])
    _cache_set(cache_key, result)
    return result


def get_academic_summaries_by_batch(batch_year):
    try:
        rows = d1_storage.query(
            'SELECT * FROM student_academic_summary WHERE batch_year = ?',
            [str(batch_year)]
        )
    except RuntimeError as exc:
        if _is_missing_academic_summary_table_error(exc):
            return {}
        raise
    return {
        row.get('student_id'): _academic_summary_db_row_to_api(row)
        for row in rows
    }


def get_student_ids_by_batch(batch_year):
    cache_key = ('student_ids_by_batch', str(batch_year))
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    rows = d1_storage.query(
        'SELECT student_id FROM student_cgpa WHERE batch_year = ? ORDER BY student_id',
        [str(batch_year)]
    )
    result = [row['student_id'] for row in rows]
    _cache_set(cache_key, result)
    return result


def count_cgpa_rows(batch_year):
    return _count_rows(
        'SELECT COUNT(*) AS row_count FROM student_cgpa WHERE batch_year = ?',
        [str(batch_year)],
    )


def count_semester_rows(batch_year, semester_number):
    return _count_rows(
        """
        SELECT COUNT(*) AS row_count
        FROM semester_results
        WHERE batch_year = ? AND semester_number = ?
        """,
        [str(batch_year), int(semester_number)],
    )


def count_toppers_rows(batch_year):
    return _count_rows(
        'SELECT COUNT(*) AS row_count FROM toppers WHERE batch_year = ?',
        [str(batch_year)],
    )


def get_student_semester_records(student_id):
    semester_rows = _student_semester_rows(student_id)
    records = {}
    for semester, rows in semester_rows.items():
        label = 'Honors/Minor' if semester == 9 else f'{(semester + 1) // 2}-{2 if semester % 2 == 0 else 1}'
        records[str(semester)] = {
            'label': label,
            'subjects': [
                {
                    'subjectCode': row.get('subject_code') or '',
                    'subjectName': row.get('subject_name') or '',
                    'grade': row.get('grade') or '',
                    'credits': _blank_if_none(row.get('credits')),
                }
                for row in rows
            ],
        }
    return records


def get_student_semester_raw_records(student_id):
    semester_rows = _student_semester_rows(student_id)
    return {
        str(semester): [_semester_db_row_to_api(row) for row in rows]
        for semester, rows in semester_rows.items()
    }


def get_student_semester_summaries(student_id):
    cgpa_record = get_student_cgpa(student_id)
    semester_rows = _student_semester_rows(student_id)
    honors_credits = _honors_credits_from_semester_rows(semester_rows)
    return _semester_summaries_from_cgpa_record(cgpa_record, honors_credits)


def get_student_results(student_id):
    student_id = student_id.strip().upper()
    cache_key = ('student_results', student_id)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    cgpa_record = get_student_cgpa(student_id)
    semester_rows = _student_semester_rows(student_id)
    semester_records = {
        str(semester): [_semester_db_row_to_api(row) for row in rows]
        for semester, rows in semester_rows.items()
    }

    result = {
        'studentId': student_id,
        'cgpaData': cgpa_record,
        'semesterData': semester_records,
        'semesterSummaries': _semester_summaries_from_cgpa_record(
            cgpa_record,
            _honors_credits_from_semester_rows(semester_rows),
        ),
    }
    _cache_set(cache_key, result)
    return result


def get_batch_semester_records(batch_year, semester_number):
    rows = d1_storage.query(
        """
        SELECT * FROM semester_results
        WHERE batch_year = ? AND semester_number = ?
        ORDER BY student_id, row_order, id
        """,
        [str(batch_year), int(semester_number)]
    )
    return [_semester_db_row_to_api(row) for row in rows]


def get_batch_data(batch_year):
    cgpa_records = get_cgpa_records_by_batch(batch_year)
    if not cgpa_records:
        return []

    student_ids = [record['ID'] for record in cgpa_records]
    semester_rows = d1_storage.query(
        """
        SELECT * FROM semester_results
        WHERE batch_year = ?
        ORDER BY student_id, semester_number, row_order, id
        """,
        [str(batch_year)],
        timeout=60
    )

    semester_data_by_student = {student_id: {} for student_id in student_ids}
    honors_credits_by_student = defaultdict(float)
    honors_credit_found = set()
    for row in semester_rows:
        student_id = row.get('student_id')
        if student_id not in semester_data_by_student:
            continue
        semester_data_by_student[student_id].setdefault(str(row.get('semester_number')), []).append(
            _semester_db_row_to_api(row)
        )
        if int(row.get('semester_number') or 0) == 9:
            credits = _number_or_none(row.get('credits'))
            if credits is not None:
                honors_credits_by_student[student_id] += credits
                honors_credit_found.add(student_id)

    return [
        {
            'studentId': record['ID'],
            'cgpaData': record,
            'allSemesterData': semester_data_by_student.get(record['ID'], {}),
            'semesterSummaries': _semester_summaries_from_cgpa_record(
                record,
                honors_credits_by_student.get(record['ID']) if record['ID'] in honors_credit_found else None
            ),
        }
        for record in cgpa_records
    ]


def get_toppers_for_year(batch_year):
    batch_year = str(batch_year)
    cache_key = ('toppers_for_year', batch_year)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    rows = d1_storage.query(
        """
        SELECT category, roll_number, cgpa
        FROM toppers
        WHERE batch_year = ?
        ORDER BY category, rank_order
        """,
        [batch_year]
    )
    if not rows:
        return None

    result = {
        'overall': [],
        'cse': [],
        'ece': [],
        'eee': [],
        'mec': [],
        'ce': [],
    }
    for row in rows:
        category = (row.get('category') or '').lower()
        if category not in result:
            continue
        result[category].append({
            'roll_number': row.get('roll_number') or '',
            'cgpa': _number_or_zero(row.get('cgpa')),
        })
    _cache_set(cache_key, result)
    return result


def get_toppers_rag_data(years=None):
    years = tuple(str(year) for year in (years or BATCH_CONFIG.keys()))
    cache_key = ('toppers_rag_data', years)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    toppers_data = {}
    for year in years:
        toppers = get_toppers_for_year(year)
        if not toppers:
            continue
        toppers_data[str(year)] = {
            'overall': [
                {'rollNumber': item['roll_number'], 'cgpa': str(item['cgpa'])}
                for item in toppers['overall'][:5]
            ],
            'branches': {
                branch: [
                    {'rollNumber': item['roll_number'], 'cgpa': str(item['cgpa'])}
                    for item in toppers[branch][:3]
                ]
                for branch in ('cse', 'ece', 'eee', 'mec', 'ce')
            },
        }
    _cache_set(cache_key, toppers_data)
    return toppers_data


def list_notifications():
    cache_key = ('notifications',)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    rows = d1_storage.query(
        'SELECT id, text, date_text, is_new FROM notifications ORDER BY sort_order ASC, id DESC'
    )
    result = [
        {
            'text': row.get('text') or '',
            'date': row.get('date_text') or '',
            'is_new': bool(row.get('is_new')),
        }
        for row in rows
    ]
    _cache_set(cache_key, result)
    return result


def latest_notification_text():
    notifications = list_notifications()
    if notifications:
        return notifications[0].get('text', '').strip()
    return None


def add_notification(text, date_text, is_new=False):
    d1_storage.execute('UPDATE notifications SET sort_order = sort_order + 1, updated_at = CURRENT_TIMESTAMP')
    d1_storage.execute(
        """
        INSERT INTO notifications (text, date_text, is_new, sort_order)
        VALUES (?, ?, ?, 0)
        """,
        [text, date_text, 1 if is_new else 0]
    )
    clear_runtime_cache()
    return list_notifications()


def delete_notification(index):
    ordered = _ordered_notification_rows()
    if index < 0 or index >= len(ordered):
        return None

    d1_storage.execute('DELETE FROM notifications WHERE id = ?', [ordered[index]['id']])
    _reindex_notifications()
    clear_runtime_cache()
    return list_notifications()


def toggle_notification(index):
    ordered = _ordered_notification_rows()
    if index < 0 or index >= len(ordered):
        return None

    current = ordered[index]
    d1_storage.execute(
        'UPDATE notifications SET is_new = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [0 if current.get('is_new') else 1, current['id']]
    )
    clear_runtime_cache()
    return list_notifications()


def replace_cgpa_from_dataframe(batch_year, dataframe):
    batch_year = str(batch_year)
    sync_token = _sync_token('cgpa', batch_year)
    rows = _cgpa_rows_from_dataframe(batch_year, dataframe, sync_token)
    existing_rows = d1_storage.query(
        'SELECT * FROM student_cgpa WHERE batch_year = ? ORDER BY student_id',
        [batch_year],
        timeout=60
    )

    if not rows:
        if existing_rows:
            d1_storage.execute(
                'DELETE FROM student_cgpa WHERE batch_year = ?',
                [batch_year],
                timeout=60
            )
            refresh_academic_summaries_for_batch(batch_year, cgpa_rows=[])
            clear_runtime_cache()
        return 0

    changed_rows = _changed_rows_from_scope(
        existing_rows,
        rows,
        key_columns=['student_id'],
        compare_columns=[
            'student_id', 'batch_year', 'batch_label', 'regulation',
            'sgpa_1_1', 'credits_1_1', 'sgpa_1_2', 'credits_1_2',
            'sgpa_2_1', 'credits_2_1', 'sgpa_2_2', 'credits_2_2',
            'sgpa_3_1', 'credits_3_1', 'sgpa_3_2', 'credits_3_2',
            'sgpa_4_1', 'credits_4_1', 'sgpa_4_2', 'credits_4_2',
            'total_credits', 'cgpa', 'supplementary_appearances',
        ],
        numeric_columns=[
            'sgpa_1_1', 'credits_1_1', 'sgpa_1_2', 'credits_1_2',
            'sgpa_2_1', 'credits_2_1', 'sgpa_2_2', 'credits_2_2',
            'sgpa_3_1', 'credits_3_1', 'sgpa_3_2', 'credits_3_2',
            'sgpa_4_1', 'credits_4_1', 'sgpa_4_2', 'credits_4_2',
            'total_credits', 'cgpa',
        ],
    )
    stale_rows = _stale_keys_from_scope(existing_rows, rows, key_columns=['student_id'])

    if changed_rows:
        _bulk_upsert(
            table='student_cgpa',
            columns=CGPA_INSERT_COLUMNS,
            rows=changed_rows,
            conflict_columns=['student_id'],
            chunk_size=25,
        )

    if stale_rows:
        _delete_scope_rows_not_in_keys(
            table='student_cgpa',
            scope_sql='batch_year = ?',
            scope_params=[batch_year],
            key_expression='student_id',
            desired_keys=[key[0] for key in _row_keys(rows, ['student_id'])],
        )

    refresh_academic_summaries_for_batch(batch_year, cgpa_rows=rows)
    clear_runtime_cache()
    return len(changed_rows)


def replace_cgpa_from_csv(batch_year, csv_text):
    dataframe = pd.read_csv(io.StringIO(csv_text), encoding='utf-8-sig')
    return replace_cgpa_from_dataframe(batch_year, dataframe)


def preview_missing_cgpa_from_csv(batch_year, csv_text):
    dataframe = pd.read_csv(io.StringIO(csv_text), encoding='utf-8-sig')
    rows = _cgpa_rows_from_dataframe(str(batch_year), dataframe, sync_token='')
    existing_rows = count_cgpa_rows(batch_year)
    return _migration_preview(len(rows), existing_rows)


def insert_missing_cgpa_from_csv(batch_year, csv_text):
    dataframe = pd.read_csv(io.StringIO(csv_text), encoding='utf-8-sig')
    return insert_missing_cgpa_from_dataframe(batch_year, dataframe)


def insert_missing_cgpa_from_dataframe(batch_year, dataframe):
    batch_year = str(batch_year)
    sync_token = _sync_token('cgpa-migration', batch_year)
    rows = _cgpa_rows_from_dataframe(batch_year, dataframe, sync_token)
    before_count = count_cgpa_rows(batch_year)

    if not rows or before_count >= len(rows):
        return _migration_result(len(rows), before_count, before_count)

    _bulk_insert_ignore(
        table='student_cgpa',
        columns=CGPA_INSERT_COLUMNS,
        rows=rows,
        chunk_size=25,
    )
    after_count = count_cgpa_rows(batch_year)
    if after_count > before_count:
        refresh_academic_summaries_for_batch(batch_year)
        clear_runtime_cache()
    return _migration_result(len(rows), before_count, after_count)


def refresh_academic_summaries_for_batch(batch_year, _schema_retry=False, cgpa_rows=None):
    batch_year = str(batch_year)
    try:
        if cgpa_rows is None:
            cgpa_rows = d1_storage.query(
                'SELECT * FROM student_cgpa WHERE batch_year = ? ORDER BY student_id',
                [batch_year],
                timeout=60
            )

        if not cgpa_rows:
            d1_storage.execute(
                'DELETE FROM student_academic_summary WHERE batch_year = ?',
                [batch_year],
                timeout=60
            )
            clear_runtime_cache()
            return 0

        sync_token = _sync_token('academic-summary', batch_year)
        rows = [
            _academic_summary_row_from_cgpa_row(row, sync_token)
            for row in cgpa_rows
        ]
        existing_rows = d1_storage.query(
            'SELECT * FROM student_academic_summary WHERE batch_year = ? ORDER BY student_id',
            [batch_year],
            timeout=60
        )
        changed_rows = _changed_rows_from_scope(
            existing_rows,
            rows,
            key_columns=['student_id'],
            compare_columns=[
                'student_id', 'batch_year', 'regulation', 'percentage',
                'percentage_value', 'division', 'division_class',
                'progress_percentage', 'progress_class', 'supplementary_count',
            ],
            numeric_columns=['percentage_value', 'progress_percentage', 'supplementary_count'],
        )
        stale_rows = _stale_keys_from_scope(existing_rows, rows, key_columns=['student_id'])

        if changed_rows:
            _bulk_upsert(
                table='student_academic_summary',
                columns=ACADEMIC_SUMMARY_INSERT_COLUMNS,
                rows=changed_rows,
                conflict_columns=['student_id'],
                chunk_size=25,
            )
        if stale_rows:
            _delete_scope_rows_not_in_keys(
                table='student_academic_summary',
                scope_sql='batch_year = ?',
                scope_params=[batch_year],
                key_expression='student_id',
                desired_keys=[key[0] for key in _row_keys(rows, ['student_id'])],
            )
        clear_runtime_cache()
        return len(changed_rows)
    except RuntimeError as exc:
        if not _schema_retry and _is_missing_academic_summary_table_error(exc):
            apply_schema()
            return refresh_academic_summaries_for_batch(batch_year, _schema_retry=True, cgpa_rows=cgpa_rows)
        raise


def refresh_all_academic_summaries(years=None):
    if years is None:
        rows = d1_storage.query(
            'SELECT DISTINCT batch_year FROM student_cgpa ORDER BY batch_year',
            timeout=60
        )
        years = [row.get('batch_year') for row in rows if row.get('batch_year')]

    total = 0
    for batch_year in years:
        total += refresh_academic_summaries_for_batch(batch_year)
    return total


def replace_semester_from_dataframe(batch_year, semester_number, dataframe, is_honors_minor=False):
    batch_year = str(batch_year)
    semester_number = int(semester_number)
    sync_token = _sync_token('semester', batch_year, semester_number)
    rows = _semester_rows_from_dataframe(
        batch_year,
        semester_number,
        dataframe,
        is_honors_minor=is_honors_minor,
        sync_token=sync_token,
    )
    existing_rows = d1_storage.query(
        """
        SELECT * FROM semester_results
        WHERE batch_year = ? AND semester_number = ?
        ORDER BY student_id, row_order, id
        """,
        [batch_year, semester_number],
        timeout=60
    )

    if not rows:
        if existing_rows:
            d1_storage.execute(
                """
                DELETE FROM semester_results
                WHERE batch_year = ? AND semester_number = ?
                """,
                [batch_year, semester_number],
                timeout=60
            )
            clear_runtime_cache()
        return 0

    changed_rows = _changed_rows_from_scope(
        existing_rows,
        rows,
        key_columns=['batch_year', 'semester_number', 'student_id', 'subject_code'],
        compare_columns=[
            'student_id', 'batch_year', 'semester_number', 'subject_code',
            'subject_name', 'grade', 'credits', 'row_order',
            'is_honors_minor',
        ],
        numeric_columns=['semester_number', 'credits', 'row_order', 'is_honors_minor'],
    )
    stale_rows = _stale_keys_from_scope(
        existing_rows,
        rows,
        key_columns=['batch_year', 'semester_number', 'student_id', 'subject_code'],
    )

    if changed_rows:
        _bulk_upsert(
            table='semester_results',
            columns=[
                'student_id', 'batch_year', 'semester_number', 'subject_code',
                'subject_name', 'grade', 'credits', 'row_order',
                'is_honors_minor', 'sync_token',
            ],
            rows=changed_rows,
            conflict_columns=['batch_year', 'semester_number', 'student_id', 'subject_code'],
            chunk_size=75,
        )
    if stale_rows:
        _delete_scope_rows_not_in_keys(
            table='semester_results',
            scope_sql='batch_year = ? AND semester_number = ?',
            scope_params=[batch_year, semester_number],
            key_expression="COALESCE(student_id, '') || char(31) || COALESCE(subject_code, '')",
            desired_keys=[
                f"{key[2]}\x1f{key[3]}"
                for key in _row_keys(rows, ['batch_year', 'semester_number', 'student_id', 'subject_code'])
            ],
        )
    clear_runtime_cache()
    return len(changed_rows)


def replace_semester_from_csv(batch_year, semester_number, csv_text, is_honors_minor=False):
    dataframe = pd.read_csv(io.StringIO(csv_text), encoding='utf-8-sig')
    return replace_semester_from_dataframe(batch_year, semester_number, dataframe, is_honors_minor=is_honors_minor)


def preview_missing_semester_from_csv(batch_year, semester_number, csv_text, is_honors_minor=False):
    dataframe = pd.read_csv(io.StringIO(csv_text), encoding='utf-8-sig')
    rows = _semester_rows_from_dataframe(
        str(batch_year),
        int(semester_number),
        dataframe,
        is_honors_minor=is_honors_minor,
        sync_token='',
    )
    existing_rows = count_semester_rows(batch_year, semester_number)
    return _migration_preview(len(rows), existing_rows)


def insert_missing_semester_from_csv(batch_year, semester_number, csv_text, is_honors_minor=False):
    dataframe = pd.read_csv(io.StringIO(csv_text), encoding='utf-8-sig')
    return insert_missing_semester_from_dataframe(
        batch_year,
        semester_number,
        dataframe,
        is_honors_minor=is_honors_minor,
    )


def insert_missing_semester_from_dataframe(batch_year, semester_number, dataframe, is_honors_minor=False):
    batch_year = str(batch_year)
    semester_number = int(semester_number)
    sync_token = _sync_token('semester-migration', batch_year, semester_number)
    rows = _semester_rows_from_dataframe(
        batch_year,
        semester_number,
        dataframe,
        is_honors_minor=is_honors_minor,
        sync_token=sync_token,
    )
    before_count = count_semester_rows(batch_year, semester_number)

    if not rows or before_count >= len(rows):
        return _migration_result(len(rows), before_count, before_count)

    _bulk_insert_ignore(
        table='semester_results',
        columns=[
            'student_id', 'batch_year', 'semester_number', 'subject_code',
            'subject_name', 'grade', 'credits', 'row_order',
            'is_honors_minor', 'sync_token',
        ],
        rows=rows,
        chunk_size=75,
    )
    after_count = count_semester_rows(batch_year, semester_number)
    if after_count > before_count:
        clear_runtime_cache()
    return _migration_result(len(rows), before_count, after_count)


def replace_toppers_from_dataframe(batch_year, dataframe):
    batch_year = str(batch_year)
    sync_token = _sync_token('toppers', batch_year)
    rows = _toppers_rows_from_dataframe(batch_year, dataframe, sync_token)
    existing_rows = d1_storage.query(
        'SELECT * FROM toppers WHERE batch_year = ? ORDER BY category, rank_order, id',
        [batch_year],
        timeout=60
    )

    if not rows:
        if existing_rows:
            d1_storage.execute(
                'DELETE FROM toppers WHERE batch_year = ?',
                [batch_year],
                timeout=60
            )
            clear_runtime_cache()
        return 0

    changed_rows = _changed_rows_from_scope(
        existing_rows,
        rows,
        key_columns=['batch_year', 'category', 'rank_order'],
        compare_columns=['batch_year', 'category', 'roll_number', 'cgpa', 'rank_order'],
        numeric_columns=['cgpa', 'rank_order'],
    )
    stale_rows = _stale_keys_from_scope(existing_rows, rows, key_columns=['batch_year', 'category', 'rank_order'])

    if changed_rows:
        _bulk_upsert(
            table='toppers',
            columns=['batch_year', 'category', 'roll_number', 'cgpa', 'rank_order', 'sync_token'],
            rows=changed_rows,
            conflict_columns=['batch_year', 'category', 'rank_order'],
            chunk_size=100,
        )
    if stale_rows:
        _delete_scope_rows_not_in_keys(
            table='toppers',
            scope_sql='batch_year = ?',
            scope_params=[batch_year],
            key_expression="COALESCE(category, '') || char(31) || CAST(rank_order AS TEXT)",
            desired_keys=[f"{key[1]}\x1f{int(_number_or_zero(key[2]))}" for key in _row_keys(rows, ['batch_year', 'category', 'rank_order'], numeric_key_columns=['rank_order'])],
        )
    clear_runtime_cache()
    return len(changed_rows)


def replace_toppers_from_csv(batch_year, csv_text):
    dataframe = pd.read_csv(io.StringIO(csv_text), encoding='utf-8-sig')
    return replace_toppers_from_dataframe(batch_year, dataframe)


def preview_missing_toppers_from_csv(batch_year, csv_text):
    dataframe = pd.read_csv(io.StringIO(csv_text), encoding='utf-8-sig')
    rows = _toppers_rows_from_dataframe(str(batch_year), dataframe, sync_token='')
    existing_rows = count_toppers_rows(batch_year)
    return _migration_preview(len(rows), existing_rows)


def insert_missing_toppers_from_csv(batch_year, csv_text):
    dataframe = pd.read_csv(io.StringIO(csv_text), encoding='utf-8-sig')
    return insert_missing_toppers_from_dataframe(batch_year, dataframe)


def insert_missing_toppers_from_dataframe(batch_year, dataframe):
    batch_year = str(batch_year)
    sync_token = _sync_token('toppers-migration', batch_year)
    rows = _toppers_rows_from_dataframe(batch_year, dataframe, sync_token)
    before_count = count_toppers_rows(batch_year)

    if not rows or before_count >= len(rows):
        return _migration_result(len(rows), before_count, before_count)

    _bulk_insert_ignore(
        table='toppers',
        columns=['batch_year', 'category', 'roll_number', 'cgpa', 'rank_order', 'sync_token'],
        rows=rows,
        chunk_size=100,
    )
    after_count = count_toppers_rows(batch_year)
    if after_count > before_count:
        clear_runtime_cache()
    return _migration_result(len(rows), before_count, after_count)


def replace_notifications(notifications):
    sync_token = _sync_token('notifications')
    rows = []
    for index, item in enumerate(notifications or []):
        if not isinstance(item, dict):
            continue
        text = _clean_text(item.get('text'))
        if not text:
            continue
        rows.append({
            'text': text,
            'date_text': _clean_text(item.get('date')),
            'is_new': 1 if item.get('is_new') else 0,
            'sort_order': index,
            'sync_token': sync_token,
        })

    d1_storage.execute('DELETE FROM notifications')
    if not rows:
        clear_runtime_cache()
        return 0

    for row in rows:
        d1_storage.execute(
            """
            INSERT INTO notifications (text, date_text, is_new, sort_order)
            VALUES (?, ?, ?, ?)
            """,
            [row['text'], row['date_text'], row['is_new'], row['sort_order']]
        )
    clear_runtime_cache()
    return len(rows)


def dataframe_to_csv_response(rows):
    if not rows:
        return ''
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()), lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def _student_semester_rows(student_id):
    student_id = student_id.strip().upper()
    cache_key = ('student_semester_rows', student_id)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    rows = d1_storage.query(
        """
        SELECT * FROM semester_results
        WHERE student_id = ?
        ORDER BY semester_number, row_order, id
        """,
        [student_id]
    )
    grouped = defaultdict(list)
    for row in rows:
        grouped[int(row.get('semester_number'))].append(row)
    result = dict(grouped)
    _cache_set(cache_key, result)
    return result


def _query_student_cgpa_with_summary(student_id):
    try:
        return d1_storage.query(
            """
            SELECT c.*,
                   s.percentage AS summary_percentage,
                   s.percentage_value AS summary_percentage_value,
                   s.division AS summary_division,
                   s.division_class AS summary_division_class,
                   s.progress_percentage AS summary_progress_percentage,
                   s.progress_class AS summary_progress_class,
                   s.supplementary_count AS summary_supplementary_count
            FROM student_cgpa c
            LEFT JOIN student_academic_summary s ON s.student_id = c.student_id
            WHERE c.student_id = ?
            LIMIT 1
            """,
            [student_id],
        )
    except RuntimeError as exc:
        if not _is_missing_academic_summary_table_error(exc):
            raise
        return d1_storage.query(
            'SELECT * FROM student_cgpa WHERE student_id = ? LIMIT 1',
            [student_id],
        )


def _honors_credits_from_semester_rows(semester_rows):
    honors_rows = semester_rows.get(9) or semester_rows.get('9') or []
    if not honors_rows:
        return None

    total = 0.0
    found_credit = False
    for row in honors_rows:
        credits = _number_or_none(row.get('credits'))
        if credits is None:
            continue
        total += credits
        found_credit = True
    return total if found_credit else None


def _cgpa_rows_from_dataframe(batch_year, dataframe, sync_token):
    batch_year = str(batch_year)
    metadata = batch_metadata(batch_year)
    rows = []

    for _, source in dataframe.iterrows():
        student_id = _clean_text(source.get('ID')).upper()
        if not student_id:
            continue
        values = {
            'student_id': student_id,
            'batch_year': batch_year,
            'batch_label': metadata['batch_label'],
            'regulation': metadata['regulation'],
            'total_credits': _number_or_none(source.get('Total Credits')),
            'cgpa': _number_or_none(source.get('CGPA')),
            'supplementary_appearances': _clean_text(source.get('Supplementary Appearances')),
            'sync_token': sync_token,
        }
        for api_column, db_column in CGPA_API_TO_DB.items():
            values[db_column] = _number_or_none(source.get(api_column))
        rows.append(values)
    return rows


def _semester_rows_from_dataframe(batch_year, semester_number, dataframe, is_honors_minor=False, sync_token=''):
    batch_year = str(batch_year)
    semester_number = int(semester_number)
    rows = []

    for index, source in dataframe.iterrows():
        student_id = _clean_text(source.get('ID')).upper()
        subject_code = _clean_text(source.get('Subject Code')).upper()
        if not student_id or not subject_code:
            continue
        rows.append({
            'student_id': student_id,
            'batch_year': batch_year,
            'semester_number': semester_number,
            'subject_code': subject_code,
            'subject_name': _clean_text(source.get('Subject Name')),
            'grade': _clean_text(source.get('Grade')).upper(),
            'credits': _clean_text(source.get('Credits')),
            'row_order': int(index),
            'is_honors_minor': 1 if is_honors_minor else 0,
            'sync_token': sync_token,
        })
    return rows


def _toppers_rows_from_dataframe(batch_year, dataframe, sync_token):
    batch_year = str(batch_year)
    category_counts = defaultdict(int)
    rows = []

    for _, source in dataframe.iterrows():
        category = _clean_text(source.get('category')).lower()
        roll_number = _clean_text(source.get('roll_number')).upper()
        if not category or not roll_number:
            continue
        category_counts[category] += 1
        rows.append({
            'batch_year': batch_year,
            'category': category,
            'roll_number': roll_number,
            'cgpa': _number_or_zero(source.get('cgpa')),
            'rank_order': category_counts[category],
            'sync_token': sync_token,
        })
    return rows


def _cgpa_db_row_to_api(row, academic_summary=None):
    result = {'ID': row.get('student_id') or ''}
    for db_column, api_column in SEMESTER_DB_TO_API.items():
        result[api_column] = _number_to_text(row.get(db_column))
    result.update({
        'Total Credits': _number_to_text(row.get('total_credits')),
        'CGPA': _number_to_text(row.get('cgpa')),
        'Supplementary Appearances': row.get('supplementary_appearances') or '',
        'Batch': row.get('batch_label') or '',
        'Regulation': row.get('regulation') or '',
    })
    result['academicSummary'] = academic_summary or _calculated_academic_summary_from_cgpa_row(row)
    return result


def _academic_summary_from_joined_row(row):
    if row.get('summary_percentage') is None and row.get('summary_division') is None:
        return None
    return {
        'percentage': row.get('summary_percentage') or '0%',
        'percentageValue': _number_or_zero(row.get('summary_percentage_value')),
        'division': row.get('summary_division') or 'Not Applicable',
        'divisionClass': row.get('summary_division_class') or 'not-applicable',
        'progressPercentage': _number_or_zero(row.get('summary_progress_percentage')),
        'progressClass': row.get('summary_progress_class') or 'pass-class',
        'supplementaryCount': int(_number_or_zero(row.get('summary_supplementary_count'))),
    }


def _academic_summary_row_from_cgpa_row(row, sync_token):
    summary = _calculated_academic_summary_from_cgpa_row(row)
    return {
        'student_id': row.get('student_id') or '',
        'batch_year': row.get('batch_year') or '',
        'regulation': row.get('regulation') or '',
        'percentage': summary['percentage'],
        'percentage_value': summary['percentageValue'],
        'division': summary['division'],
        'division_class': summary['divisionClass'],
        'progress_percentage': summary['progressPercentage'],
        'progress_class': summary['progressClass'],
        'supplementary_count': summary['supplementaryCount'],
        'sync_token': sync_token,
    }


def _calculated_academic_summary_from_cgpa_row(row):
    return calculate_academic_summary(
        row.get('cgpa'),
        row.get('regulation'),
        row.get('supplementary_appearances'),
    )


def _academic_summary_db_row_to_api(row):
    return {
        'percentage': row.get('percentage') or '0%',
        'percentageValue': _number_or_zero(row.get('percentage_value')),
        'division': row.get('division') or 'Not Applicable',
        'divisionClass': row.get('division_class') or 'not-applicable',
        'progressPercentage': _number_or_zero(row.get('progress_percentage')),
        'progressClass': row.get('progress_class') or 'pass-class',
        'supplementaryCount': int(_number_or_zero(row.get('supplementary_count'))),
    }


def _is_missing_academic_summary_table_error(exc):
    return 'student_academic_summary' in str(exc) and 'no such table' in str(exc).lower()


def _semester_summaries_from_cgpa_record(cgpa_record, honors_credits=None):
    summaries = {}
    if cgpa_record:
        semester_columns = {
            1: ('1-1', 'Credits_1-1'),
            2: ('1-2', 'Credits_1-2'),
            3: ('2-1', 'Credits_2-1'),
            4: ('2-2', 'Credits_2-2'),
            5: ('3-1', 'Credits_3-1'),
            6: ('3-2', 'Credits_3-2'),
            7: ('4-1', 'Credits_4-1'),
            8: ('4-2', 'Credits_4-2'),
        }
        for semester, (sgpa_key, credits_key) in semester_columns.items():
            sgpa = cgpa_record.get(sgpa_key, '')
            credits = cgpa_record.get(credits_key, '')
            if sgpa != '' or credits != '':
                summaries[str(semester)] = {
                    'sgpa': sgpa if sgpa != '' else 'N/A',
                    'credits': credits if credits != '' else 'N/A',
                }

    if honors_credits is not None:
        summaries['9'] = {
            'sgpa': 'N/A',
            'credits': _number_to_text(honors_credits),
        }
    return summaries


def _semester_db_row_to_api(row):
    return {
        'ID': row.get('student_id') or '',
        'Subject Code': row.get('subject_code') or '',
        'Subject Name': row.get('subject_name') or '',
        'Grade': row.get('grade') or '',
        'Credits': _blank_if_none(row.get('credits')),
    }


def _ordered_notification_rows():
    return d1_storage.query(
        'SELECT id, is_new FROM notifications ORDER BY sort_order ASC, id DESC'
    )


def _reindex_notifications():
    ordered = _ordered_notification_rows()
    for index, row in enumerate(ordered):
        d1_storage.execute('UPDATE notifications SET sort_order = ? WHERE id = ?', [index, row['id']])


def _bulk_upsert(table, columns, rows, conflict_columns, chunk_size=50):
    if not rows:
        return

    max_sql_variables = 90
    safe_chunk_size = max(1, min(chunk_size, max_sql_variables // len(columns)))
    update_columns = [column for column in columns if column not in conflict_columns]
    assignments = ', '.join([f'{column} = excluded.{column}' for column in update_columns])
    assignments = f'{assignments}, updated_at = CURRENT_TIMESTAMP'

    for start in range(0, len(rows), safe_chunk_size):
        chunk = rows[start:start + safe_chunk_size]
        placeholders = []
        params = []
        for row in chunk:
            placeholders.append(f"({', '.join(['?'] * len(columns))})")
            params.extend(row.get(column) for column in columns)

        sql = f"""
        INSERT INTO {table} ({', '.join(columns)})
        VALUES {', '.join(placeholders)}
        ON CONFLICT({', '.join(conflict_columns)})
        DO UPDATE SET {assignments}
        """
        d1_storage.execute(sql, params=params, timeout=60)


def _bulk_insert_ignore(table, columns, rows, chunk_size=50):
    if not rows:
        return

    max_sql_variables = 90
    safe_chunk_size = max(1, min(chunk_size, max_sql_variables // len(columns)))

    for start in range(0, len(rows), safe_chunk_size):
        chunk = rows[start:start + safe_chunk_size]
        placeholders = []
        params = []
        for row in chunk:
            placeholders.append(f"({', '.join(['?'] * len(columns))})")
            params.extend(row.get(column) for column in columns)

        sql = f"""
        INSERT OR IGNORE INTO {table} ({', '.join(columns)})
        VALUES {', '.join(placeholders)}
        """
        d1_storage.execute(sql, params=params, timeout=60)


def _sync_value(value, numeric=False):
    if numeric:
        number = _number_or_none(value)
        return '' if number is None else number
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ''
    return str(value).strip()


def _row_keys(rows, key_columns, numeric_key_columns=()):
    numeric_key_columns = set(numeric_key_columns or [])
    keys = []
    for row in rows or []:
        keys.append(
            tuple(_sync_value(row.get(column), column in numeric_key_columns) for column in key_columns)
        )
    return keys


def _row_signature(row, columns, numeric_columns=()):
    numeric_columns = set(numeric_columns or [])
    return tuple(_sync_value(row.get(column), column in numeric_columns) for column in columns)


def _changed_rows_from_scope(existing_rows, desired_rows, key_columns, compare_columns, numeric_columns=(), numeric_key_columns=()):
    existing_by_key = {
        key: row
        for key, row in zip(_row_keys(existing_rows, key_columns, numeric_key_columns), existing_rows or [])
    }
    changed_rows = []
    for row in desired_rows or []:
        key = tuple(_sync_value(row.get(column), column in set(numeric_key_columns or [])) for column in key_columns)
        existing_row = existing_by_key.get(key)
        if existing_row is None:
            changed_rows.append(row)
            continue
        if _row_signature(existing_row, compare_columns, numeric_columns) != _row_signature(row, compare_columns, numeric_columns):
            changed_rows.append(row)
    return changed_rows


def _stale_keys_from_scope(existing_rows, desired_rows, key_columns, numeric_key_columns=()):
    desired_keys = set(_row_keys(desired_rows, key_columns, numeric_key_columns))
    return [
        key
        for key in _row_keys(existing_rows, key_columns, numeric_key_columns)
        if key not in desired_keys
    ]


def _delete_scope_rows_not_in_keys(table, scope_sql, scope_params, key_expression, desired_keys):
    if not scope_sql:
        raise ValueError('scope_sql is required')

    scope_params = list(scope_params or [])
    if not desired_keys:
        d1_storage.execute(
            f'DELETE FROM {table} WHERE {scope_sql}',
            scope_params,
            timeout=60
        )
        return

    placeholders = ', '.join(['?'] * len(desired_keys))
    d1_storage.execute(
        f'DELETE FROM {table} WHERE {scope_sql} AND {key_expression} NOT IN ({placeholders})',
        scope_params + list(desired_keys),
        timeout=60
    )


def _cache_get(key):
    cached = _CACHE.get(key)
    if not cached:
        return None

    expires_at, value = cached
    if expires_at <= time.time():
        _CACHE.pop(key, None)
        return None
    return copy.deepcopy(value)


def _cache_set(key, value):
    ttl = _cache_ttl_seconds()
    if ttl <= 0:
        return
    _CACHE[key] = (time.time() + ttl, copy.deepcopy(value))


def _cache_ttl_seconds():
    try:
        return int(os.getenv('PORTAL_DB_CACHE_TTL_SECONDS', '300'))
    except ValueError:
        return 300


def _migration_preview(source_rows, existing_rows):
    estimated_new_rows = max(0, int(source_rows) - int(existing_rows))
    return {
        'source_rows': int(source_rows),
        'existing_rows': int(existing_rows),
        'estimated_new_rows': estimated_new_rows,
        'complete': int(existing_rows) >= int(source_rows) and int(source_rows) > 0,
    }


def _migration_result(source_rows, before_count, after_count):
    inserted_rows = max(0, int(after_count) - int(before_count))
    return {
        'source_rows': int(source_rows),
        'existing_rows_before': int(before_count),
        'existing_rows_after': int(after_count),
        'inserted_rows': inserted_rows,
        'complete': int(after_count) >= int(source_rows) and int(source_rows) > 0,
    }


def _count_rows(sql, params=None):
    rows = d1_storage.query(sql, params or [], timeout=60)
    if not rows:
        return 0
    return int(_number_or_zero(rows[0].get('row_count')))


def _sync_token(*parts):
    joined = '-'.join(str(part) for part in parts if part is not None)
    return f"{joined}-{uuid.uuid4().hex}"


def _clean_text(value):
    if value is None:
        return ''
    if isinstance(value, float) and math.isnan(value):
        return ''
    return str(value).strip()


def _number_or_none(value):
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _number_or_zero(value):
    number = _number_or_none(value)
    return 0.0 if number is None else number


def _number_to_text(value):
    if value is None:
        return ''
    if isinstance(value, (int, float)):
        number = float(value)
        if math.isnan(number):
            return ''
        if number.is_integer():
            return f'{number:.1f}'
    return str(value)


def _blank_if_none(value):
    return '' if value is None else str(value)
