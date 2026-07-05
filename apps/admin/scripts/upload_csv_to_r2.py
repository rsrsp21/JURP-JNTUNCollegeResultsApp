import argparse

from dotenv import load_dotenv

from apps.admin.common import ADMIN_ENV_PATH, ROOT_DIR
from apps.admin.utils.r2_storage import is_r2_configured, upload_folder_to_prefix


def main():
    parser = argparse.ArgumentParser(description='Upload the local csv/ admin workspace to Cloudflare R2.')
    parser.parse_args()

    load_dotenv(ADMIN_ENV_PATH)
    if not is_r2_configured():
        raise SystemExit(
            'Missing R2 configuration. Set R2_ACCOUNT_ID, R2_BUCKET_NAME, '
            'R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY first.'
        )

    uploaded = []
    uploaded.extend(upload_folder_to_prefix('csv', 'csv', allowed_extensions={'.csv'}))

    print(f'Uploaded {len(uploaded)} CSV files to Cloudflare R2 under csv/.')
    for key in uploaded:
        print(key)


if __name__ == '__main__':
    main()
