import contextlib
import os
import smtplib
import socket
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

from . import d1_storage


SEND_INTERVAL_SECONDS = 0.4  # basic pacing between sends

_original_getaddrinfo = socket.getaddrinfo


@contextlib.contextmanager
def _force_ipv4_dns():
    """Some hosts (e.g. Render) have no IPv6 egress, so a hostname that
    resolves to an IPv6 address first (smtp.gmail.com does) fails with
    "Network is unreachable" before smtplib gets a chance to fall back to
    IPv4. Force AF_INET-only resolution for the duration of the initial
    connection so it never picks an unreachable address in the first place.
    """
    def ipv4_only(host, port, family=0, type=0, proto=0, flags=0):
        return _original_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)

    socket.getaddrinfo = ipv4_only
    try:
        yield
    finally:
        socket.getaddrinfo = _original_getaddrinfo


def is_smtp_configured():
    return bool(os.getenv('SMTP_USERNAME')) and bool(os.getenv('SMTP_PASSWORD'))


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
    stored email address, via SMTP (Gmail by default). Returns a summary
    dict; never raises - callers should treat this as best-effort and not
    let a failure block the notification itself from being saved.

    Sends are one-at-a-time over a single authenticated connection, so one
    bad address only fails that one recipient instead of the whole run.
    """
    if not is_smtp_configured():
        return {'sent': 0, 'failed': 0, 'total': 0, 'skipped_reason': 'SMTP is not configured'}

    try:
        emails = _subscriber_emails()
    except Exception as e:
        return {'sent': 0, 'failed': 0, 'total': 0, 'skipped_reason': f'Could not load subscriber emails: {e}'}

    if not emails:
        return {'sent': 0, 'failed': 0, 'total': 0, 'skipped_reason': 'No subscribed emails found'}

    host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
    port = int(os.getenv('SMTP_PORT', '587'))
    username = os.getenv('SMTP_USERNAME')
    password = os.getenv('SMTP_PASSWORD')
    from_email = os.getenv('SMTP_FROM_EMAIL', username)
    from_name = os.getenv('SMTP_FROM_NAME', 'JNTUK UCEN Results Portal')
    subject = os.getenv('SMTP_NOTIFICATION_SUBJECT', 'JNTUK UCEN Results Portal - New Update')
    html_body = _notification_html(text, date_str)

    try:
        with _force_ipv4_dns():
            server = smtplib.SMTP(host, port, timeout=15)
        server.starttls()
        server.login(username, password)
    except Exception as e:
        print(f"SMTP login failed: {e}")
        return {'sent': 0, 'failed': 0, 'total': len(emails), 'skipped_reason': f'SMTP login failed: {e}'}

    sent, failed, errors = 0, 0, []
    try:
        for i, email in enumerate(emails):
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = formataddr((from_name, from_email))
            msg['To'] = email
            msg.attach(MIMEText(html_body, 'html'))

            try:
                server.sendmail(from_email, [email], msg.as_string())
                sent += 1
            except Exception as e:
                failed += 1
                errors.append(f'{email}: {e}')
                print(f"SMTP send to {email} failed: {e}")

            if i + 1 < len(emails):
                time.sleep(SEND_INTERVAL_SECONDS)
    finally:
        try:
            server.quit()
        except Exception:
            pass

    return {'sent': sent, 'failed': failed, 'total': len(emails), 'errors': errors[:5]}
