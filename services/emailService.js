const { Resend } = require('resend');
const { welcomeTemplate, passwordResetTemplate, otpTemplate, plainTextWelcome, plainTextPasswordReset, plainTextOtp } = require('../templates/emailTemplates');
const logger = require('../utils/logger');
let resendClient = null;
function getClient() {
    if (!resendClient) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            logger.warn('RESEND_API_KEY not set — emails will not be sent');
            return null;
        }
        resendClient = new Resend(apiKey);
    }
    return resendClient;
}
function getEmailFrom() {
    return process.env.EMAIL_FROM || 'noreply@sportsos.com';
}
function getFrontendUrl() {
    return process.env.FRONTEND_URL || 'https://sportsos.vercel.app';
}
async function sendEmail(to, subject, html, text) {
    logger.info('email.send_attempt', {
        to,
        subject,
    });
    const client = getClient();
    if (!client) {
        logger.warn('Email suppressed (no API key)', { subject, to });
        return { sent: false, reason: 'NO_API_KEY' };
    }
    try {
        const result = await client.emails.send({
            from: getEmailFrom(),
            to,
            subject,
            html,
            text,
        });
        logger.info('email.sent_success', {
            to,
            subject,
        });
        if (result.error) {
            logger.error('Resend API error', { subject, to, error: result.error.message });
            return { sent: false, reason: result.error.message || 'SEND_FAILED' };
        }
        logger.info('Email sent', { subject, to, id: result.data?.id });
        return { sent: true, id: result.data?.id };
    } catch (err) {
        logger.error('email.send_failed', {
            to,
            subject,
            error: err.message,
        });
        return {
            sent: false,
            reason: err.message,
        };
    }
}
async function sendWelcomeEmail(user) {
    const subject = 'Welcome to SportsOS!';
    const html = welcomeTemplate(user.name);
    const text = plainTextWelcome(user.name);
    return sendEmail(user.email, subject, html, text);
}
async function sendPasswordResetEmail(user, resetToken) {
    const frontendUrl = getFrontendUrl();
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
    const subject = 'Reset Your SportsOS Password';
    const html = passwordResetTemplate(user.name, resetLink);
    const text = plainTextPasswordReset(user.name, resetLink);
    return sendEmail(user.email, subject, html, text);
}
async function sendOtpEmail(user, otp, type) {
    const purpose = type === 'password_reset' ? 'password_reset'
        : type === 'phone_verification' ? 'phone_verification'
        : 'email_verification';
    const subjectMap = {
        email_verification: 'Verify Your SportsOS Email',
        password_reset: 'Your SportsOS Password Reset Code',
        phone_verification: 'Verify Your Phone Number',
    };
    const subject = subjectMap[type] || 'Your SportsOS Verification Code';
    const html = otpTemplate(user.name, otp, purpose);
    const text = plainTextOtp(user.name, otp, purpose);
    return sendEmail(user.email, subject, html, text);
}
module.exports = {
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendOtpEmail,
};
