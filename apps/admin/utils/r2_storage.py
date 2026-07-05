import os
import hashlib
from datetime import datetime
from pathlib import PurePosixPath


def is_r2_configured():
    required = (
        'R2_ACCOUNT_ID',
        'R2_BUCKET_NAME',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
    )
    return all(os.getenv(key) for key in required)


def _csv_prefix():
    return os.getenv('R2_CSV_PREFIX', 'csv').strip('/').replace('\\', '/')


def _editable_roots():
    roots = os.getenv('R2_EDITABLE_ROOTS', 'csv').split(',')
    normalized = [root.strip('/').replace('\\', '/') for root in roots if root.strip('/')]
    editable = [root for root in normalized if root != 'data' and not root.startswith('data/')]
    return editable or ['csv']


def _endpoint_url():
    endpoint = os.getenv('R2_ENDPOINT_URL')
    if endpoint:
        return endpoint.rstrip('/')
    return f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com"


def _client():
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError('boto3 is required for Cloudflare R2 storage. Add boto3 to requirements.txt.') from exc

    return boto3.client(
        's3',
        endpoint_url=_endpoint_url(),
        aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
        region_name='auto',
    )


def _bucket():
    return os.getenv('R2_BUCKET_NAME')


def normalize_csv_key(path):
    if not path:
        return None

    key = str(PurePosixPath(path.replace('\\', '/')))
    if key.startswith('../') or key == '..' or key.startswith('/'):
        return None
    if not key.lower().endswith('.csv'):
        return None

    roots = _editable_roots()
    if roots and not any(key == root or key.startswith(root + '/') for root in roots):
        key = f"{roots[0]}/{key}"

    return key


def normalize_key(path):
    if not path:
        return None

    key = str(PurePosixPath(path.replace('\\', '/')))
    if key.startswith('../') or key == '..' or key.startswith('/'):
        return None
    return key


def list_csv_files():
    client = _client()
    paginator = client.get_paginator('list_objects_v2')
    files = []

    for prefix in _editable_roots():
        list_prefix = f"{prefix}/" if prefix else ''
        for page in paginator.paginate(Bucket=_bucket(), Prefix=list_prefix):
            for item in page.get('Contents', []):
                key = item.get('Key', '')
                if not key.lower().endswith('.csv'):
                    continue

                path = PurePosixPath(key)
                modified = item.get('LastModified')
                if isinstance(modified, datetime):
                    modified = modified.timestamp()

                files.append({
                    'path': key,
                    'name': path.name,
                    'folder': str(path.parent) if str(path.parent) != '.' else '',
                    'size': item.get('Size', 0),
                    'modified': modified
                })

    files.sort(key=lambda item: item['path'].lower())
    return files


def read_csv_text(path):
    key = normalize_csv_key(path)
    if not key:
        raise FileNotFoundError('CSV file not found or not editable')

    response = _client().get_object(Bucket=_bucket(), Key=key)
    return key, response['Body'].read().decode('utf-8-sig')


def read_text_key(path):
    key = normalize_key(path)
    if not key:
        raise FileNotFoundError('File key not found or not editable')

    response = _client().get_object(Bucket=_bucket(), Key=key)
    return key, response['Body'].read().decode('utf-8-sig')


def write_csv_text(path, content):
    key = normalize_csv_key(path)
    if not key:
        raise FileNotFoundError('CSV file not found or not editable')

    body = content.encode('utf-8')
    _client().put_object(
        Bucket=_bucket(),
        Key=key,
        Body=body,
        ContentType='text/csv; charset=utf-8',
    )
    return key, len(body)


def write_text_key(path, content, content_type='text/csv; charset=utf-8'):
    key = normalize_key(path)
    if not key:
        raise FileNotFoundError('File key not found or not editable')

    body = content.encode('utf-8')
    _client().put_object(
        Bucket=_bucket(),
        Key=key,
        Body=body,
        ContentType=content_type,
    )
    return key, len(body)


def download_prefix_to_folder(prefix, local_folder):
    client = _client()
    prefix = normalize_key(prefix.strip('/')) or ''
    list_prefix = f"{prefix}/" if prefix else ''
    os.makedirs(local_folder, exist_ok=True)
    downloaded = []

    paginator = client.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=_bucket(), Prefix=list_prefix):
        for item in page.get('Contents', []):
            key = item.get('Key', '')
            if not key or key.endswith('/'):
                continue

            relative = key[len(list_prefix):] if list_prefix and key.startswith(list_prefix) else key
            local_path = os.path.abspath(os.path.join(local_folder, relative.replace('/', os.sep)))
            base = os.path.abspath(local_folder)
            if not (local_path == base or local_path.startswith(base + os.sep)):
                continue

            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            response = client.get_object(Bucket=_bucket(), Key=key)
            with open(local_path, 'wb') as f:
                f.write(response['Body'].read())
            downloaded.append(key)

    return downloaded


def upload_folder_to_prefix(local_folder, prefix, allowed_extensions=None):
    client = _client()
    local_folder = os.path.abspath(local_folder)
    prefix = normalize_key(prefix.strip('/')) or ''
    uploaded = []
    allowed = {ext.lower() for ext in allowed_extensions} if allowed_extensions else None

    for root, _, filenames in os.walk(local_folder):
        for filename in filenames:
            if allowed and not any(filename.lower().endswith(ext) for ext in allowed):
                continue

            local_path = os.path.join(root, filename)
            relative_path = os.path.relpath(local_path, local_folder).replace(os.sep, '/')
            key = f"{prefix}/{relative_path}" if prefix else relative_path
            with open(local_path, 'rb') as f:
                data = f.read()

            client.put_object(
                Bucket=_bucket(),
                Key=key,
                Body=data,
                ContentType='text/csv; charset=utf-8' if key.lower().endswith('.csv') else 'application/octet-stream',
            )
            uploaded.append(key)

    return uploaded


def hash_folder_files(local_folder, allowed_extensions=None):
    local_folder = os.path.abspath(local_folder)
    allowed = {ext.lower() for ext in allowed_extensions} if allowed_extensions else None
    hashes = {}

    if not os.path.exists(local_folder):
        return hashes

    for root, _, filenames in os.walk(local_folder):
        for filename in filenames:
            if allowed and not any(filename.lower().endswith(ext) for ext in allowed):
                continue

            local_path = os.path.join(root, filename)
            relative_path = os.path.relpath(local_path, local_folder).replace(os.sep, '/')
            digest = hashlib.md5()
            with open(local_path, 'rb') as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b''):
                    digest.update(chunk)
            hashes[relative_path] = digest.hexdigest()

    return hashes


def upload_changed_files_to_prefix(local_folder, prefix, previous_hashes=None, allowed_extensions=None):
    client = _client()
    local_folder = os.path.abspath(local_folder)
    prefix = normalize_key(prefix.strip('/')) or ''
    previous_hashes = previous_hashes or {}
    uploaded = []
    allowed = {ext.lower() for ext in allowed_extensions} if allowed_extensions else None

    for root, _, filenames in os.walk(local_folder):
        for filename in filenames:
            if allowed and not any(filename.lower().endswith(ext) for ext in allowed):
                continue

            local_path = os.path.join(root, filename)
            relative_path = os.path.relpath(local_path, local_folder).replace(os.sep, '/')
            digest = hashlib.md5()
            with open(local_path, 'rb') as f:
                data = f.read()
            digest.update(data)

            if previous_hashes.get(relative_path) == digest.hexdigest():
                continue

            key = f"{prefix}/{relative_path}" if prefix else relative_path
            client.put_object(
                Bucket=_bucket(),
                Key=key,
                Body=data,
                ContentType='text/csv; charset=utf-8' if key.lower().endswith('.csv') else 'application/octet-stream',
            )
            uploaded.append(key)

    return uploaded


def delete_key(path):
    key = normalize_key(path)
    if not key:
        raise FileNotFoundError('File key not found')

    _client().delete_object(Bucket=_bucket(), Key=key)
    return key


def upload_local_csv_folder(local_folder):
    local_folder = os.path.abspath(local_folder)
    uploaded = []

    for root, _, filenames in os.walk(local_folder):
        for filename in filenames:
            if not filename.lower().endswith('.csv'):
                continue

            local_path = os.path.join(root, filename)
            relative_path = os.path.relpath(local_path, local_folder).replace(os.sep, '/')
            key = normalize_csv_key(relative_path)
            with open(local_path, 'rb') as f:
                data = f.read()

            _client().put_object(
                Bucket=_bucket(),
                Key=key,
                Body=data,
                ContentType='text/csv; charset=utf-8',
            )
            uploaded.append(key)

    return uploaded
