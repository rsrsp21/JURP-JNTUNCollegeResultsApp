import os
import time

import requests

from . import d1_storage


RESEND_BATCH_URL = 'https://api.resend.com/emails/batch'
BATCH_SIZE = 100  # Resend's batch endpoint accepts at most 100 emails per call


def is_resend_configured():
    return bool(os.getenv('RESEND_API_KEY')) and bool(os.getenv('RESEND_FROM_EMAIL'))


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
    stored email address, via Resend's batch API. Returns a summary dict;
    never raises - callers should treat this as best-effort and not let a
    failure block the notification itself from being saved."""
    if not is_resend_configured():
        return {'sent': 0, 'failed': 0, 'total': 0, 'skipped_reason': 'Resend is not configured'}

    try:
        emails = _subscriber_emails()
    except Exception as e:
        return {'sent': 0, 'failed': 0, 'total': 0, 'skipped_reason': f'Could not load subscriber emails: {e}'}

    if not emails:
        return {'sent': 0, 'failed': 0, 'total': 0, 'skipped_reason': 'No subscribed emails found'}

    api_key = os.getenv('RESEND_API_KEY')
    from_addr = os.getenv('RESEND_FROM_EMAIL')
    subject = os.getenv('RESEND_NOTIFICATION_SUBJECT', 'JNTUK UCEN Results Portal - New Update')
    html_body = _notification_html(text, date_str)

    sent, failed, errors = 0, 0, []

    for i in range(0, len(emails), BATCH_SIZE):
        chunk = emails[i:i + BATCH_SIZE]
        payload = [
            {'from': from_addr, 'to': [email], 'subject': subject, 'html': html_body}
            for email in chunk
        ]
        try:
            response = requests.post(
                RESEND_BATCH_URL,
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                },
                json=payload,
                timeout=30,
            )
            if response.ok:
                sent += len(chunk)
            else:
                failed += len(chunk)
                error_text = response.text[:200]
                errors.append(error_text)
                print(f"Resend batch send failed ({response.status_code}): {error_text}")
        except Exception as e:
            failed += len(chunk)
            errors.append(str(e))
            print(f"Resend batch send raised an exception: {e}")

        if i + BATCH_SIZE < len(emails):
            time.sleep(1)  # basic pacing between batches

    return {'sent': sent, 'failed': failed, 'total': len(emails), 'errors': errors[:5]}
