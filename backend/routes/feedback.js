const express = require('express');
const { body, validationResult } = require('express-validator');
const Feedback = require('../models/Feedback');
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (_) {
  nodemailer = null; // allow server to run without dependency; fall back to console transport
}

const router = express.Router();

// SMTP transport if configured
function getSmtpTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!nodemailer || !SMTP_HOST) return null;
  const port = Number(SMTP_PORT) || 587;
  const secure = port === 465; // common default
  const opts = {
    host: SMTP_HOST,
    port,
    secure,
    auth: SMTP_USER || SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  };
  if (process.env.SMTP_DEBUG === '1') {
    opts.logger = true;
    opts.debug = true;
  }
  if (process.env.SMTP_TLS_INSECURE === '1') {
    opts.tls = { rejectUnauthorized: false };
  }
  return nodemailer.createTransport(opts);
}

// Dev/logging transport that never throws due to SMTP
function getDevTransport() {
  if (nodemailer) return nodemailer.createTransport({ jsonTransport: true });
  // Final fallback when nodemailer is not installed: naive console sender
  return {
    sendMail: async (opts) => {
      try {
        console.log('[feedback email fallback]', JSON.stringify({
          to: opts && opts.to,
          from: opts && opts.from,
          subject: opts && opts.subject,
          text: opts && opts.text,
        }, null, 2));
      } catch (_) {
        // ignore
      }
      return { messageId: 'console-' + Date.now() };
    },
  };
}

router.post(
  '/',
  [
    body('message')
      .isString()
      .trim()
      .isLength({ min: 5, max: 2000 })
      .withMessage('Message must be 5-2000 characters'),
    body('email')
      .optional({ values: 'falsy' })
      .isEmail()
      .withMessage('Email must be valid'),
    body('players')
      .optional({ values: 'falsy' })
      .isArray({ max: 5 })
      .withMessage('Players must be an array up to 5 names'),
    body('players.*')
      .optional({ values: 'falsy' })
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Each player name must be 1-50 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() } });
    }

    const { email, message, players = [] } = req.body || {};
    const sanitizedEmail = email && typeof email === 'string' ? email.trim() : undefined;
    const sanitizedMessage = typeof message === 'string' ? message.trim() : '';
    const sanitizedPlayers = Array.isArray(players)
      ? players
          .map((p) => (typeof p === 'string' ? p.trim() : String(p).trim()))
          .filter((p) => p.length > 0)
      : [];

    let saved;
    try {
      saved = await Feedback.create({
        email: sanitizedEmail,
        message: sanitizedMessage,
        players: sanitizedPlayers,
        meta: {
          ip: req.ip,
          userAgent: req.get('user-agent') || '',
        },
      });
    } catch (err) {
      console.error('Feedback save failed', err);
      return res.status(500).json({
        ok: false,
        error: { code: 'PERSISTENCE_FAILED', message: 'Could not save feedback' },
      });
    }

    const to = process.env.MAIL_TO || process.env.FEEDBACK_TO_EMAIL || '';
    const from = process.env.MAIL_FROM || 'no-reply@system-overload.local';
    const replyTo = sanitizedEmail;

    const subject = `[SystemOverload] New Feedback${process.env.NODE_ENV ? ' (' + process.env.NODE_ENV + ')' : ''}`;
    const plain = [
      `New feedback received at ${new Date().toISOString()}`,
      '',
      sanitizedEmail ? `From: ${sanitizedEmail}` : 'From: (not provided)',
      sanitizedPlayers && sanitizedPlayers.length
        ? `Players: ${sanitizedPlayers.join(', ')}`
        : 'Players: (none provided)',
      '',
      'Message:',
      sanitizedMessage,
      '',
      `IP: ${req.ip}`,
      `UA: ${req.get('user-agent') || ''}`,
    ].join('\n');

    const html = `
      <div>
        <p><strong>New feedback received:</strong> ${new Date().toISOString()}</p>
        <p><strong>From:</strong> ${sanitizedEmail ? sanitizedEmail : '(not provided)'}<br/>
           <strong>Players:</strong> ${sanitizedPlayers && sanitizedPlayers.length ? sanitizedPlayers.map(p => String(p)).join(', ') : '(none provided)'}
        </p>
        <p><strong>Message:</strong><br/>${String(sanitizedMessage).replace(/\n/g, '<br/>')}</p>
        <hr/>
        <p style="color:#666;"><strong>IP:</strong> ${req.ip} &nbsp; <strong>UA:</strong> ${req.get('user-agent') || ''}</p>
      </div>`;

    let info;
    let usedFallback = false;
    try {
      if (to && getSmtpTransport()) {
        const smtp = getSmtpTransport();
        info = await smtp.sendMail({ to, from, replyTo, subject, text: plain, html });
      } else {
        usedFallback = true; // no recipient or no SMTP — log instead
        const dev = getDevTransport();
        info = await dev.sendMail({ from, replyTo, subject, text: plain, html });
      }
    } catch (err) {
      // If SMTP failed, fall back to console transport instead of 500
      try {
        const dev = getDevTransport();
        info = await dev.sendMail({ from, replyTo, subject, text: plain, html });
        usedFallback = true;
      } catch (err2) {
        console.error('Feedback mail failed', err);
        return res.status(500).json({ ok: false, error: { code: 'MAIL_FAILED', message: 'Could not send feedback email' } });
      }
    }

    const hint = usedFallback
      ? (!to
          ? 'No MAIL_TO configured; message logged.'
          : (!process.env.SMTP_HOST
              ? 'No SMTP configured; message logged.'
              : 'SMTP failed; message logged instead.'))
      : undefined;

    return res.json({
      ok: true,
      id: info && info.messageId ? info.messageId : undefined,
      hint,
      feedback: saved
        ? {
            id: saved.id,
            createdAt: saved.createdAt,
          }
        : undefined,
    });
  }
);

module.exports = router;
