function welcomeTemplate(name) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to SportsOS</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">SportsOS</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your Sports Platform</p>
</td></tr>
<tr><td style="padding:40px;">
<h2 style="margin:0 0 16px;color:#18181b;font-size:20px;font-weight:600;">Welcome${name ? ', ' + escapeHtml(name) : ''}!</h2>
<p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
Thank you for joining SportsOS. You're now part of a community connecting athletes, coaches, parents, and academies.
</p>
<p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
Here's what you can do next:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td style="padding:12px 16px;background-color:#f8fafc;border-radius:8px;margin-bottom:8px;">
<span style="color:#2563eb;font-weight:600;">Complete your profile</span>
<span style="color:#71717a;font-size:14px;display:block;margin-top:4px;">Tell us about your sports interests</span>
</td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td style="padding:12px 16px;background-color:#f8fafc;border-radius:8px;">
<span style="color:#2563eb;font-weight:600;">Discover academies</span>
<span style="color:#71717a;font-size:14px;display:block;margin-top:4px;">Find the best training near you</span>
</td></tr>
</table>
<p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">
If you have any questions, reply to this email — we're here to help.
</p>
</td></tr>
<tr><td style="padding:24px 40px;background-color:#f8fafc;border-top:1px solid #e4e4e7;">
<p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
SportsOS — Connecting Sports Communities
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function passwordResetTemplate(name, resetLink) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">SportsOS</h1>
</td></tr>
<tr><td style="padding:40px;">
<h2 style="margin:0 0 16px;color:#18181b;font-size:20px;font-weight:600;">Reset Your Password</h2>
<p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
Hi${name ? ' ' + escapeHtml(name) : ''},
</p>
<p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
We received a request to reset your password. Click the button below to set a new password. This link expires in <strong>15 minutes</strong>.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td align="center" style="padding:8px 0;">
<a href="${resetLink}" style="display:inline-block;padding:14px 32px;background-color:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
Reset Password
</a>
</td></tr>
</table>
<p style="margin:0 0 16px;color:#52525b;font-size:15px;line-height:1.6;">
If the button doesn't work, copy and paste this link into your browser:
</p>
<p style="margin:0 0 24px;color:#2563eb;font-size:13px;word-break:break-all;">
${resetLink}
</p>
<p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">
If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
</p>
</td></tr>
<tr><td style="padding:24px 40px;background-color:#f8fafc;border-top:1px solid #e4e4e7;">
<p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
SportsOS — Connecting Sports Communities
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function otpTemplate(name, otp, purpose) {
    const purposeLabel = purpose === 'password_reset' ? 'Password Reset'
        : purpose === 'phone_verification' ? 'Phone Verification'
        : 'Email Verification';
    const expiresIn = '10 minutes';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">SportsOS</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${purposeLabel}</p>
</td></tr>
<tr><td style="padding:40px;">
<h2 style="margin:0 0 16px;color:#18181b;font-size:20px;font-weight:600;">Your verification code</h2>
<p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
Hi${name ? ' ' + escapeHtml(name) : ''},
</p>
<p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
Use the following code to verify your account. This code expires in <strong>${expiresIn}</strong>.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td align="center" style="padding:16px 0;">
<span style="display:inline-block;padding:16px 40px;background-color:#f8fafc;border:2px dashed #2563eb;border-radius:8px;font-size:32px;font-weight:700;letter-spacing:8px;color:#18181b;font-family:monospace;">
${otp}
</span>
</td></tr>
</table>
<p style="margin:0 0 16px;color:#52525b;font-size:15px;line-height:1.6;">
If you didn't request this, you can safely ignore this email.
</p>
</td></tr>
<tr><td style="padding:24px 40px;background-color:#f8fafc;border-top:1px solid #e4e4e7;">
<p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
SportsOS — Connecting Sports Communities
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function plainTextOtp(name, otp, purpose) {
    const purposeLabel = purpose === 'password_reset' ? 'Password Reset'
        : purpose === 'phone_verification' ? 'Phone Verification'
        : 'Email Verification';
    return `${purposeLabel} — SportsOS\n\nHi${name ? ' ' + name : ''},\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.\n\n— SportsOS Team`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function plainTextWelcome(name) {
    return `Welcome to SportsOS!\n\nHi${name ? ' ' + name : ''},\n\nThank you for joining SportsOS. You're now part of a community connecting athletes, coaches, parents, and academies.\n\nHere's what you can do next:\n- Complete your profile\n- Discover academies near you\n\nIf you have any questions, reply to this email — we're here to help.\n\n— SportsOS Team`;
}

function plainTextPasswordReset(name, resetLink) {
    return `Reset Your SportsOS Password\n\nHi${name ? ' ' + name : ''},\n\nWe received a request to reset your password. Visit the link below to set a new password. This link expires in 15 minutes.\n\n${resetLink}\n\nIf you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.\n\n— SportsOS Team`;
}

module.exports = {
    welcomeTemplate,
    passwordResetTemplate,
    otpTemplate,
    plainTextWelcome,
    plainTextPasswordReset,
    plainTextOtp,
};
