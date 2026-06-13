const { Resend } = require('resend');
const { welcomeTemplate, passwordResetTemplate, plainTextWelcome, plainTextPasswordReset } = require('../templates/emailTemplates');

let resendClient = null;

function getClient() {
    if (!resendClient) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.warn('RESEND_API_KEY not set — emails will not be sent');
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
    const client = getClient();
    if (!client) {
        console.warn(`Email suppressed (no API key): ${subject} → ${to}`);
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

        if (result.error) {
            console.error('Resend error:', result.error);
            return { sent: false, reason: result.error.message || 'SEND_FAILED' };
        }

        return { sent: true, id: result.data?.id };
    } catch (err) {
        console.error('Email send failed:', err.message);
        return { sent: false, reason: err.message || 'SEND_FAILED' };
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

module.exports = {
    sendWelcomeEmail,
    sendPasswordResetEmail,
};
