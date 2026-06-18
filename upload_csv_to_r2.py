from dotenv import load_dotenv

from utils.r2_storage import is_r2_configured, upload_folder_to_prefix


def main():
    load_dotenv()
    if not is_r2_configured():
        raise SystemExit(
            'Missing R2 configuration. Set R2_ACCOUNT_ID, R2_BUCKET_NAME, '
            'R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY first.'
        )

    uploaded = []
    uploaded.extend(upload_folder_to_prefix('csv', 'csv', allowed_extensions={'.csv'}))
    uploaded.extend(upload_folder_to_prefix('data', 'data', allowed_extensions={'.csv', '.json'}))

    print(f'Uploaded {len(uploaded)} files to Cloudflare R2.')
    for key in uploaded:
        print(key)


if __name__ == '__main__':
    main()
