// backend/routes/billing.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');
const { DATA_ROOT, ensureDir } = require('../utils/storage');

const router = express.Router();

const INVOICE_DIR = path.join(DATA_ROOT, 'invoices');
ensureDir(INVOICE_DIR);

const PLAN_PRICING = {
  'premium-monthly': { amountCents: 9900, interval: '1 month' },
  'premium-yearly': { amountCents: 9900 * 10, interval: '1 year' }, // 2 months free
};

const buildInvoiceNumber = (id) => {
  const today = new Date();
  const stamp = today.toISOString().slice(0, 10).replace(/-/g, '');
  return `INV-${stamp}-${String(id).padStart(5, '0')}`;
};

const writeInvoicePdf = (invoice, user, subscription, outputPath) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  doc.fontSize(18).text('ML Judge Premium Invoice', { align: 'left' });
  doc.moveDown();
  doc.fontSize(12).fillColor('#111827');
  doc.text(`Invoice #: ${invoice.invoice_number}`);
  doc.text(`Issued At: ${new Date(invoice.issued_at).toISOString()}`);
  doc.text(`Customer: ${user.username} (${user.email})`);
  doc.text(`Plan: ${subscription.plan}`);
  doc.text(`Status: ${invoice.status}`);
  doc.moveDown();

  doc.text('Charges', { underline: true });
  doc.text(`Amount: ${(invoice.amount_cents / 100).toFixed(2)} ${invoice.currency.toUpperCase()}`);
  doc.moveDown(2);
  doc.fontSize(10).fillColor('#6b7280');
  doc.text('Thank you for supporting the platform. Premium unlocks AI hints and faster queues.');

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
};

router.post('/checkout', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const plan = req.body?.plan || 'premium-monthly';
  const currency = (req.body?.currency || 'usd').toLowerCase();
  const providerRef = req.body?.paymentMethod || 'internal-mock';

  const pricing = PLAN_PRICING[plan] || PLAN_PRICING['premium-monthly'];
  const amountCents = pricing.amountCents;
  const renewInterval = pricing.interval;

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const userRes = await client.query('SELECT id, username, email FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = userRes.rows[0];

    const existingSubRes = await client.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 1',
      [userId]
    );

    let subscriptionId;
    let subscriptionRow;
    if (existingSubRes.rows.length) {
      const sub = existingSubRes.rows[0];
      const updated = await client.query(
        `UPDATE subscriptions
         SET plan = $1, status = 'active', started_at = NOW(), renews_at = NOW() + interval '${renewInterval}', canceled_at = NULL
         WHERE id = $2
         RETURNING *`,
        [plan, sub.id]
      );
      subscriptionRow = updated.rows[0];
      subscriptionId = subscriptionRow.id;
    } else {
      const inserted = await client.query(
        `INSERT INTO subscriptions (user_id, plan, status, started_at, renews_at)
         VALUES ($1, $2, 'active', NOW(), NOW() + interval '${renewInterval}')
         RETURNING *`,
        [userId, plan]
      );
      subscriptionRow = inserted.rows[0];
      subscriptionId = subscriptionRow.id;
    }

    const paymentInserted = await client.query(
      `INSERT INTO payments (user_id, subscription_id, provider, provider_ref, status, amount_cents, currency)
       VALUES ($1, $2, $3, $4, 'succeeded', $5, $6)
       RETURNING *`,
      [userId, subscriptionId, 'internal', providerRef, amountCents, currency]
    );
    const paymentRow = paymentInserted.rows[0];

    const invoiceInserted = await client.query(
      `INSERT INTO invoices (user_id, subscription_id, payment_id, amount_cents, currency, status, issued_at, invoice_number)
       VALUES ($1, $2, $3, $4, $5, 'paid', NOW(), $6)
       RETURNING *`,
      [userId, subscriptionId, paymentRow.id, amountCents, currency, buildInvoiceNumber(paymentRow.id)]
    );
    const invoiceRow = invoiceInserted.rows[0];

    // Generate PDF invoice and store relative path
    const pdfFilename = `${invoiceRow.invoice_number || uuidv4()}.pdf`;
    const pdfAbsolute = path.join(INVOICE_DIR, pdfFilename);
    await writeInvoicePdf(invoiceRow, user, subscriptionRow, pdfAbsolute);
    const pdfRelative = path.relative(DATA_ROOT, pdfAbsolute);

    await client.query('UPDATE invoices SET pdf_path = $1 WHERE id = $2', [pdfRelative, invoiceRow.id]);
    await client.query('UPDATE users SET is_premium = TRUE WHERE id = $1', [userId]);

    await client.query('COMMIT');

    const downloadUrl = `/api/billing/invoices/${invoiceRow.id}/pdf`;
    res.status(201).json({
      subscription: toCamelCase(subscriptionRow),
      payment: toCamelCase(paymentRow),
      invoice: toCamelCase({ ...invoiceRow, pdf_path: pdfRelative }),
      downloadUrl,
    });
  } catch (error) {
    if (client) { try { await client.query('ROLLBACK'); } catch (rbErr) { console.error('Rollback failed', rbErr); } }
    console.error('Billing checkout error:', error);
    res.status(500).json({ message: 'Unable to create premium payment right now.' });
  } finally {
    if (client) client.release();
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  const userId = req.userId;
  try {
    const [subsRes, invoicesRes, paymentsRes] = await Promise.all([
      pool.query('SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 1', [userId]),
      pool.query('SELECT * FROM invoices WHERE user_id = $1 ORDER BY issued_at DESC', [userId]),
      pool.query('SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    ]);
    res.json({
      subscription: subsRes.rows.length ? toCamelCase(subsRes.rows[0]) : null,
      invoices: toCamelCase(invoicesRes.rows),
      payments: toCamelCase(paymentsRes.rows),
    });
  } catch (error) {
    console.error('Billing fetch error:', error);
    res.status(500).json({ message: 'Unable to load billing data.' });
  }
});

router.get('/invoices/:id/pdf', authMiddleware, async (req, res) => {
  const invoiceId = Number(req.params.id);
  if (Number.isNaN(invoiceId)) return res.status(400).json({ message: 'Invalid invoice id' });

  try {
    const invoiceRes = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
    if (!invoiceRes.rows.length) return res.status(404).json({ message: 'Invoice not found' });
    const invoice = invoiceRes.rows[0];

    if (invoice.user_id !== req.userId && req.userRole !== 'owner') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const fullPath = invoice.pdf_path ? path.join(DATA_ROOT, invoice.pdf_path) : null;
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Invoice PDF is unavailable' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=\"${path.basename(fullPath)}\"`);
    fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    console.error('Invoice download error:', error);
    res.status(500).json({ message: 'Failed to download invoice.' });
  }
});

module.exports = router;
