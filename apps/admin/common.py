import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask


ROOT_DIR = Path(__file__).resolve().parents[2]
PUBLIC_APP_DIR = ROOT_DIR / 'apps' / 'public'
ADMIN_APP_DIR = ROOT_DIR / 'apps' / 'admin'
ADMIN_ENV_PATH = ADMIN_APP_DIR / '.env'
PUBLIC_STATIC_DIR = PUBLIC_APP_DIR / 'public'
ADMIN_STATIC_DIR = ADMIN_APP_DIR / 'static'
ADMIN_TEMPLATE_DIR = ADMIN_APP_DIR / 'templates'


def create_base_app(import_name, static_folder=None, template_folder=None, static_url_path='/public'):
    load_dotenv(ADMIN_ENV_PATH)
    app = Flask(
        import_name,
        static_folder=str(static_folder or PUBLIC_STATIC_DIR),
        static_url_path=static_url_path,
        template_folder=str(template_folder or ADMIN_TEMPLATE_DIR),
    )
    app.secret_key = os.getenv('FLASK_SECRET_KEY', 'jntun_results_secret_key')
    return app


def external_url(env_name, default_base, path='/'):
    base_url = (os.getenv(env_name) or default_base or '').rstrip('/')
    clean_path = '/' + str(path or '').lstrip('/')
    if not base_url:
        return clean_path
    return f'{base_url}{clean_path}'
