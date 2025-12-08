// backend/routes/billing.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { toCamelCase } = require('../utils/helpers');
// Import đúng các hàm đã export từ storage.js
const { DATA_ROOT, ensureDir } = require('../utils/storage');

const router = express.Router();

// Sử dụng DATA_ROOT đã được đảm bảo không undefined
const INVOICE_DIR = path.join(DATA_ROOT, 'invoices');
// Gọi hàm ensureDir an toàn
try {
    ensureDir(INVOICE_DIR);
} catch (e) {
    console.error("Error creating invoice dir:", e);
}

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

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('ML JUDGE', { align: 'left' });
  doc.fontSize(10).font('Helvetica').text('Premium Service Invoice', { align: 'left' });
  doc.moveDown();

  // Meta info
  doc.text(`Invoice Number: ${invoice.invoice_number}`);
  doc.text(`Date Issued: ${new Date(invoice.issued_at).toLocaleDateString()}`);
  doc.text(`Status: ${invoice.status.toUpperCase()}`);
  doc.moveDown();

  // Customer info
  doc.text('Bill To:', { underline: true });
  doc.text(`User: ${user.username}`);
  doc.text(`Email: ${user.email}`);
  doc.moveDown();

  // Line Items
  doc.rect(50, doc.y, 500, 25).fill('#f3f4f6');
  doc.fillColor('#000').text('Description', 60, doc.y - 18);
  doc.text('Amount', 450, doc.y - 18);
  doc.moveDown();

  const amountText = `${(invoice.amount_cents / 100).toFixed(2)} ${invoice.currency.toUpperCase()}`;
  doc.text(`Premium Subscription (${subscription.plan})`, 60, doc.y + 10);
  doc.text(amountText, 450, doc.y);

  doc.moveDown(4);
  doc.text('Total:', 380, doc.y, { width: 60, align: 'right' });
  doc.font('Helvetica-Bold').text(amountText, 450, doc.y - 10);

  // Footer
  doc.fontSize(10).font('Helvetica').fillColor('#6b7280');
  doc.text('Thank you for using ML Judge.', 50, 700, { align: 'center' });

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
};

// --- Mock Key Verification ---
const isValidKey = (key) => {
  // Logic giả lập: Key phải bắt đầu bằng MLJ-PREM- và có độ dài nhất định
  return key && key.startsWith('MLJ-PREM-') && key.length > 15;
};

// Helper to process premium activation
const activatePremium = async (userId, plan, amountCents, currency, provider, providerRef, res) => {
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
    const pricing = PLAN_PRICING[plan] || PLAN_PRICING['premium-monthly'];
    const renewInterval = pricing.interval;

    // 1. Upsert Subscription
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

    // 2. Record Payment
    const paymentInserted = await client.query(
      `INSERT INTO payments (user_id, subscription_id, provider, provider_ref, status, amount_cents, currency)
       VALUES ($1, $2, $3, $4, 'succeeded', $5, $6)
       RETURNING *`,
      [userId, subscriptionId, provider, providerRef, amountCents, currency]
    );
    const paymentRow = paymentInserted.rows[0];

    // 3. Create Invoice
    const invoiceInserted = await client.query(
      `INSERT INTO invoices (user_id, subscription_id, payment_id, amount_cents, currency, status, issued_at, invoice_number)
       VALUES ($1, $2, $3, $4, $5, 'paid', NOW(), $6)
       RETURNING *`,
      [userId, subscriptionId, paymentRow.id, amountCents, currency, buildInvoiceNumber(paymentRow.id)]
    );
    const invoiceRow = invoiceInserted.rows[0];

    // 4. Generate PDF
    const pdfFilename = `${invoiceRow.invoice_number || uuidv4()}.pdf`;
    const pdfAbsolute = path.join(INVOICE_DIR, pdfFilename);
    await writeInvoicePdf(invoiceRow, user, subscriptionRow, pdfAbsolute);
    const pdfRelative = path.relative(DATA_ROOT, pdfAbsolute);

    await client.query('UPDATE invoices SET pdf_path = $1 WHERE id = $2', [pdfRelative, invoiceRow.id]);
    await client.query('UPDATE users SET is_premium = TRUE WHERE id = $1', [userId]);

    await client.query('COMMIT');

    const downloadUrl = `/api/billing/invoices/${invoiceRow.id}/pdf`;
    return res.status(201).json({
      success: true,
      message: 'Premium activated successfully',
      subscription: toCamelCase(subscriptionRow),
      payment: toCamelCase(paymentRow),
      invoice: toCamelCase({ ...invoiceRow, pdf_path: pdfRelative }),
      downloadUrl,
    });

  } catch (error) {
    if (client) { try { await client.query('ROLLBACK'); } catch (rbErr) {} }
    console.error('Premium activation error:', error);
    return res.status(500).json({ message: 'Unable to process request.' });
  } finally {
    if (client) client.release();
  }
};

// Checkout endpoint
router.post('/checkout', authMiddleware, async (req, res) => {
  const plan = req.body?.plan || 'premium-monthly';
  const currency = (req.body?.currency || 'usd').toLowerCase();
  const pricing = PLAN_PRICING[plan] || PLAN_PRICING['premium-monthly'];
  
  // Mock payment provider
  return activatePremium(req.userId, plan, pricing.amountCents, currency, 'internal', 'mock-checkout-ref', res);
});

// Redeem Key endpoint
router.post('/redeem', authMiddleware, async (req, res) => {
  const { key } = req.body;
  
  if (!isValidKey(key)) {
    return res.status(400).json({ message: 'Mã kích hoạt không hợp lệ hoặc đã hết hạn.' });
  }

  // Key xịn thì free tiền (0 cents) hoặc set giá trị tùy logic
  return activatePremium(req.userId, 'premium-monthly', 0, 'vnd', 'license_key', key, res);
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