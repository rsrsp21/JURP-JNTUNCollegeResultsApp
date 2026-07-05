import os
import re

import requests


_SESSION = requests.Session()


def is_d1_configured():
    return all([
        _account_id(),
        os.getenv('D1_DATABASE_ID'),
        _api_token(),
    ])


def _account_id():
    return (
        os.getenv('D1_ACCOUNT_ID')
        or os.getenv('CLOUDFLARE_ACCOUNT_ID')
        or os.getenv('R2_ACCOUNT_ID')
    )


def _api_token():
    return os.getenv('D1_API_TOKEN') or os.getenv('CLOUDFLARE_API_TOKEN')


def _database_id():
    return os.getenv('D1_DATABASE_ID')


def _api_base_url():
    return os.getenv('D1_API_BASE_URL', 'https://api.cloudflare.com/client/v4').rstrip('/')


def _query_url():
    return f"{_api_base_url()}/accounts/{_account_id()}/d1/database/{_database_id()}/query"


def query(sql, params=None, timeout=30):
    if not is_d1_configured():
        raise RuntimeError('Cloudflare D1 is not configured')

    payload = {
        'sql': sql,
        'params': list(params or []),
    }
    response = _SESSION.post(
        _query_url(),
        headers={
            'Authorization': f"Bearer {_api_token()}",
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=timeout,
    )
    try:
        data = response.json()
    except ValueError as exc:
        raise RuntimeError(f'D1 returned a non-JSON response: HTTP {response.status_code}') from exc

    if not response.ok or not data.get('success', False):
        errors = data.get('errors') or []
        message = '; '.join(
            str(error.get('message') or error) for error in errors
        ) or response.text[:500]
        raise RuntimeError(f'D1 query failed: {message}')

    result = data.get('result') or []
    if isinstance(result, list):
        if not result:
            return []
        first = result[0] or {}
        if first.get('success') is False:
            raise RuntimeError(f"D1 statement failed: {first.get('error') or first}")
        return first.get('results') or []

    if isinstance(result, dict):
        if result.get('success') is False:
            raise RuntimeError(f"D1 statement failed: {result.get('error') or result}")
        return result.get('results') or []

    return []


def execute(sql, params=None, timeout=30):
    query(sql, params=params, timeout=timeout)


def apply_schema_file(schema_path):
    with open(schema_path, 'r', encoding='utf-8') as schema_file:
        sql_text = schema_file.read()

    for statement in split_sql_statements(sql_text):
        execute(statement, timeout=60)


def split_sql_statements(sql_text):
    without_line_comments = re.sub(r'--.*$', '', sql_text, flags=re.MULTILINE)
    statements = []
    current = []
    in_single_quote = False

    for char in without_line_comments:
        if char == "'":
            in_single_quote = not in_single_quote
        if char == ';' and not in_single_quote:
            statement = ''.join(current).strip()
            if statement:
                statements.append(statement)
            current = []
        else:
            current.append(char)

    statement = ''.join(current).strip()
    if statement:
        statements.append(statement)

    return statements
