import os
import time

import requests

from . import d1_storage


BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email'
SEND_INTERVAL_SECONDS = 0.4  # basic pacing between sends

DEFAULT_SUBJECTS = {
    'notification': 'JNTUK UCEN Results Portal - New Update',
    'feature': 'JNTUK UCEN Results Portal - New Feature',
    'custom': 'JNTUK UCEN Results Portal - Announcement',
}
HEADINGS = {
    'notification': 'New Update Posted',
    'feature': 'New Feature Added',
    'custom': 'Announcement',
}


def is_brevo_configured():
    return bool(os.getenv('BREVO_API_KEY')) and bool(os.getenv('BREVO_FROM_EMAIL'))


def get_all_subscriber_emails():
    rows = d1_storage.query(
        "SELECT DISTINCT email FROM student_cgpa WHERE email IS NOT NULL AND email != ''"
    )
    return [row['email'] for row in rows if row.get('email')]


def default_subject(category):
    return DEFAULT_SUBJECTS.get(category, DEFAULT_SUBJECTS['custom'])


def _email_html(heading, message, date_str):
    portal_url = os.getenv('PUBLIC_APP_URL', 'https://jurp.vercel.app')
    date_html = (
        f'<p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">{date_str}</p>'
        if date_str else ''
    )
    # Table-based layout with inline styles throughout - div/flexbox layouts
    # and <style> blocks are unreliable across Gmail/Outlook/etc, tables are
    # the one thing every email client renders consistently.
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#4338ca;padding:28px 32px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#c7d2fe;font-weight:600;">JNTUK UCEN Results Portal</p>
            <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;">{heading}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px;">
            {date_html}
            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#1e293b;white-space:pre-line;">{message}</p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background:#4338ca;">
                  <a href="{portal_url}" target="_blank" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                    Open Results Portal &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 28px;border-top:1px solid #f1f5f9;margin-top:24px;">
            <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">
              You're receiving this because you added your email on the JNTUK UCEN results portal.
              <a href="{portal_url}" style="color:#94a3b8;">Visit the portal</a> anytime to check results, CGPA, and toppers.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
    """


def send_bulk_email(recipient_emails, subject, message, category='custom', date_str=None):
    """Best-effort send of `message` to every address in recipient_emails,
    via Brevo's transactional email API (HTTPS, not SMTP - some hosts block
    outbound SMTP ports entirely). Returns a summary dict; never raises -
    callers should treat this as best-effort.

    Sends are one-at-a-time so a single bad address only fails that one
    recipient instead of the whole run.
    """
    if not is_brevo_configured():
        return {'sent': 0, 'failed': 0, 'total': 0, 'skipped_reason': 'Brevo is not configured'}

    recipient_emails = [e for e in dict.fromkeys(recipient_emails) if e]  # de-dupe, keep order
    if not recipient_emails:
        return {'sent': 0, 'failed': 0, 'total': 0, 'skipped_reason': 'No recipients to send to'}

    api_key = os.getenv('BREVO_API_KEY')
    from_email = os.getenv('BREVO_FROM_EMAIL')
    from_name = os.getenv('BREVO_FROM_NAME', 'JNTUK UCEN Results Portal')
    heading = HEADINGS.get(category, HEADINGS['custom'])
    html_body = _email_html(heading, message, date_str)

    sent, failed, errors = 0, 0, []

    for i, email in enumerate(recipient_emails):
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

        if i + 1 < len(recipient_emails):
            time.sleep(SEND_INTERVAL_SECONDS)

    return {'sent': sent, 'failed': failed, 'total': len(recipient_emails), 'errors': errors[:5]}
