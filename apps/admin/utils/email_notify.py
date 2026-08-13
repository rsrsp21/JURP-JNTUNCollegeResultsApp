import os
import time

import requests

from . import d1_storage


BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email'
SEND_INTERVAL_SECONDS = 0.4  # basic pacing between sends


def is_brevo_configured():
    return bool(os.getenv('BREVO_API_KEY')) and bool(os.getenv('BREVO_FROM_EMAIL'))


def _subscriber_emails():
    rows = d1_storage.query(
        "SELECT DISTINCT email FROM student_cgpa WHERE email IS NOT NULL AND email != ''"
    )
    return [row['email'] for row in rows if row.get('email')]


def _notification_html(text, date_str):
    date_html = f'<p style="font-size:13px;color:#64748b;margin:4px 0 16px;">{date_str}</p>' if date_str else ''
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color:#1e293b; margin-bottom: 4px;">New update on JNTUK UCEN Results Portal</h2>
      {date_html}
      <p style="font-size:15px; color:#334155; line-height:1.5;">{text}</p>
      <p style="font-size:12px;color:#94a3b8; margin-top:24px;">
        You're receiving this because you added your email on the results portal.
      </p>
    </div>
    """


def send_notification_email(text, date_str=None):
    """Best-effort broadcast of a notification to every student with a
    stored email address, via Brevo's transactional email API (HTTPS, not
    SMTP - some hosts block outbound SMTP ports entirely). Returns a
    summary dict; never raises - callers should treat this as best-effort
    and not let a failure block the notification itself from being saved.

    Sends are one-at-a-time so a single bad address only fails that one
    recipient instead of the whole run.
    """
    if not is_brevo_configured():
        return {'sent': 0, 'failed': 0, 'total': 0, 'skipped_reason': 'Brevo is not configured'}

    try:
        emails = _subscriber_emails()
    except Exception as e:
        return {'sent': 0, 'failed': 0, 'total': 0, 'skipped_reason': f'Could not load subscriber emails: {e}'}

    if not emails:
        return {'sent': 0, 'failed': 0, 'total': 0, 'skipped_reason': 'No subscribed emails found'}

    api_key = os.getenv('BREVO_API_KEY')
    from_email = os.getenv('BREVO_FROM_EMAIL')
    from_name = os.getenv('BREVO_FROM_NAME', 'JNTUK UCEN Results Portal')
    subject = os.getenv('BREVO_NOTIFICATION_SUBJECT', 'JNTUK UCEN Results Portal - New Update')
    html_body = _notification_html(text, date_str)

    sent, failed, errors = 0, 0, []

    for i, email in enumerate(emails):
        payload = {
            'sender': {'name': from_name, 'email': from_email},
            'to': [{'email': email}],
            'subject': subject,
            'htmlContent': html_body,
        }
        try:
            response = requests.post(
                BREVO_SEND_URL,
                headers={
                    'api-key': api_key,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                json=payload,
                timeout=15,
            )
            if response.ok:
                sent += 1
            else:
                failed += 1
                error_text = f'{email}: {response.text[:200]}'
                errors.append(error_text)
                print(f"Brevo send to {email} failed ({response.status_code}): {response.text[:200]}")
        except Exception as e:
            failed += 1
            errors.append(f'{email}: {e}')
            print(f"Brevo send to {email} raised an exception: {e}")

        if i + 1 < len(emails):
            time.sleep(SEND_INTERVAL_SECONDS)

    return {'sent': sent, 'failed': failed, 'total': len(emails), 'errors': errors[:5]}
