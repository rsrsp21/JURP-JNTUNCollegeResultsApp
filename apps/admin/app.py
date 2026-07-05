from flask import redirect, send_from_directory, url_for

import routes
from common import ADMIN_STATIC_DIR, ADMIN_TEMPLATE_DIR, create_base_app, external_url


def create_app():
    app = create_base_app(__name__, static_folder=ADMIN_STATIC_DIR, template_folder=ADMIN_TEMPLATE_DIR)

    app.add_url_rule('/', endpoint='admin_root', view_func=lambda: redirect(url_for('admin_panel')))
    app.add_url_rule('/login', methods=['GET', 'POST'], view_func=routes.login)
    app.add_url_rule('/logout', view_func=routes.logout)
    app.add_url_rule('/admin', view_func=routes.admin_panel)

    app.add_url_rule('/api/notifications', view_func=routes.serve_notifications)
    app.add_url_rule('/api/batch-data/<batch_year>', view_func=routes.get_batch_data)
    app.add_url_rule('/api/cgpa/<student_id>', view_func=routes.serve_cgpa_data_api)
    app.add_url_rule('/api/student-results/<student_id>', view_func=routes.serve_student_results_api)
    app.add_url_rule('/api/toppers', view_func=routes.get_toppers)

    app.add_url_rule('/api/admin/ingest', methods=['POST'], view_func=routes.admin_ingest_results)
    app.add_url_rule('/api/admin/generate-reports', methods=['POST'], view_func=routes.admin_generate_reports)
    app.add_url_rule('/api/admin/convert-pdf', methods=['POST'], view_func=routes.admin_convert_pdf)
    app.add_url_rule('/api/admin/csv-files', methods=['GET'], view_func=routes.admin_list_csv_files)
    app.add_url_rule('/api/admin/csv-file', methods=['GET'], view_func=routes.admin_get_csv_file)
    app.add_url_rule('/api/admin/csv-file', methods=['PUT'], view_func=routes.admin_save_csv_file)
    app.add_url_rule('/api/admin/add-notification', methods=['POST'], view_func=routes.admin_add_notification)
    app.add_url_rule('/api/admin/delete-notification/<int:index>', methods=['DELETE'], view_func=routes.admin_delete_notification)
    app.add_url_rule('/api/admin/toggle-blinking/<int:index>', methods=['POST'], view_func=routes.admin_toggle_blinking)

    app.add_url_rule('/images/<path:filename>', endpoint='public_images', view_func=_serve_public_image)
    app.add_url_rule('/cgpa', endpoint='public_cgpa_redirect', view_func=lambda: redirect(_public_url('/cgpa')))
    app.add_url_rule('/toppers', endpoint='public_toppers_redirect', view_func=lambda: redirect(_public_url('/toppers')))
    app.add_url_rule('/semester_results', endpoint='public_semester_redirect', view_func=lambda: redirect(_public_url('/semester_results')))
    app.add_url_rule('/ask-ai', endpoint='public_ask_ai_redirect', view_func=lambda: redirect(_public_url('/ask-ai')))

    return app


def _serve_public_image(filename):
    return send_from_directory(ADMIN_STATIC_DIR / 'images', filename)


def _public_url(path):
    return external_url('PUBLIC_APP_URL', 'https://jurp.vercel.app', path)


app = create_app()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
