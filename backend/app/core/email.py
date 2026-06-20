import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.app.config import settings

def send_otp_email(to_email: str, otp_code: str) -> bool:
    """
    Sends a verification OTP email to the registered email address.
    If SMTP configurations are missing or fail, logs OTP code to stdout.
    """
    subject = "ChatSphere AI - Email Verification OTP"
    body = f"""Hello,

Welcome to ChatSphere AI!

Please use the following 6-digit One-Time Password (OTP) to verify your email address and complete registration:

{otp_code}

This OTP is valid for 5 minutes. If you did not request this code, please ignore this email.

Best regards,
ChatSphere AI Team"""

    # Check if SMTP configuration exists
    if not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD):
        # Print fallback to console
        print(f"\n========================================================")
        print(f"[OTP BYPASS] Sent email to {to_email}")
        print(f"[OTP BYPASS] OTP Code: {otp_code}")
        print(f"========================================================\n")
        return True

    try:
        msg = MIMEMultipart()
        msg['From'] = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        # Standard port 587 uses TLS, port 465 uses SSL/StartTLS
        # We try standard TLS first
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(msg['From'], to_email, msg.as_string())
        server.quit()
        print(f"Successfully sent OTP email to {to_email}")
        return True
    except Exception as e:
        print(f"Error: Failed to send email via SMTP: {e}")
        # Print fallback to console anyway to not break dev workflow
        print(f"\n========================================================")
        print(f"[OTP BYPASS] (SMTP Failed) Sent email to {to_email}")
        print(f"[OTP BYPASS] (SMTP Failed) OTP Code: {otp_code}")
        print(f"========================================================\n")
        return True
