/**
 * Razorpay payment flow: create order, verify signature, then fulfil (appointment / radiologist request / emergency).
 * Requires: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const crypto = require('crypto');
const axios = require('axios');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Prices in paise (INR). 50000 = ₹500, 30000 = ₹300, etc.
const PRICES = {
  appointment_video: parseInt(process.env.APPOINTMENT_VIDEO_PAISE, 10) || 50000,   // ₹500
  appointment_audio: parseInt(process.env.APPOINTMENT_AUDIO_PAISE, 10) || 30000,   // ₹300
  radiologist_review: null, // from radiologist's report_fee (passed as amount_paise)
  emergency: parseInt(process.env.EMERGENCY_PAISE, 10) || 100000,                    // ₹1000
};

const VALID_TYPES = ['appointment_video', 'appointment_audio', 'radiologist_review', 'emergency'];

function supabaseInsert(table, payload) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return Promise.reject(new Error('Supabase not configured'));
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}`;
  return axios.post(url, payload, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
  });
}

/**
 * GET /api/payments/prices - Return prices for each payment type (for UI).
 */
function getPrices(req, res) {
  res.json({
    success: true,
    currency: 'INR',
    prices: {
      appointment_video: PRICES.appointment_video,
      appointment_audio: PRICES.appointment_audio,
      radiologist_review: 'from_radiologist', // frontend uses radiologist's report_fee
      emergency: PRICES.emergency,
    },
    // Human-readable for display (rupees)
    display: {
      appointment_video: `₹${(PRICES.appointment_video / 100).toFixed(0)}`,
      appointment_audio: `₹${(PRICES.appointment_audio / 100).toFixed(0)}`,
      emergency: `₹${(PRICES.emergency / 100).toFixed(0)}`,
    },
  });
}

/**
 * POST /api/payments/create-order
 * Body: { type, amount_paise? (required for radiologist_review), currency?, metadata? }
 * Returns: { order_id, key_id, amount, currency } for Razorpay Checkout.
 */
async function createOrder(req, res) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ success: false, error: 'Payments not configured' });
  }

  const { type, amount_paise, currency = 'INR', metadata = {} } = req.body || {};
  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ success: false, error: 'Invalid type' });
  }

  let amountPaise;
  if (type === 'radiologist_review') {
    const paise = parseInt(amount_paise, 10);
    if (!Number.isFinite(paise) || paise < 100) {
      return res.status(400).json({ success: false, error: 'amount_paise required for radiologist_review (min 100)' });
    }
    amountPaise = paise;
  } else {
    amountPaise = PRICES[type];
    if (!amountPaise) {
      return res.status(400).json({ success: false, error: 'Price not configured for ' + type });
    }
  }

  const receipt = `rcpt_${type}_${Date.now()}`;
  try {
    const response = await axios.post(
      'https://api.razorpay.com/v1/orders',
      {
        amount: amountPaise,
        currency,
        receipt,
        notes: { type, ...(metadata && typeof metadata === 'object' ? metadata : {}) },
      },
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
        headers: { 'Content-Type': 'application/json' },
      }
    );

    res.json({
      success: true,
      order_id: response.data.id,
      key_id: RAZORPAY_KEY_ID,
      amount: response.data.amount,
      currency: response.data.currency,
    });
  } catch (err) {
    const msg = err.response?.data?.error?.description || err.message || 'Create order failed';
    res.status(err.response?.status || 500).json({ success: false, error: msg });
  }
}

/**
 * Verify Razorpay signature: body = order_id + "|" + payment_id, HMAC SHA256 with key_secret.
 */
function verifySignature(orderId, paymentId, signature) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(body).digest('hex');
  return expected === signature;
}

/**
 * POST /api/payments/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, type, metadata }
 * metadata must contain the payload to insert (appointment, radiologist_request, or emergency appointment+alert).
 */
async function verifyPayment(req, res) {
  if (!RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ success: false, error: 'Payments not configured' });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    type,
    metadata = {},
  } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !type) {
    return res.status(400).json({ success: false, error: 'Missing payment or type' });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ success: false, error: 'Invalid type' });
  }

  if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return res.status(400).json({ success: false, error: 'Invalid signature' });
  }

  try {
    if (type === 'appointment_video' || type === 'appointment_audio') {
      const appointment = metadata.appointment;
      if (!appointment) {
        return res.status(400).json({ success: false, error: 'metadata.appointment required' });
      }
      await supabaseInsert('appointments', {
        ...appointment,
        call_mode: type === 'appointment_video' ? 'video' : 'audio',
      });
      return res.json({ success: true, message: 'Appointment confirmed' });
    }

    if (type === 'radiologist_review') {
      const request = metadata.request;
      if (!request) {
        return res.status(400).json({ success: false, error: 'metadata.request required' });
      }
      await supabaseInsert('radiologist_requests', request);
      return res.json({ success: true, message: 'Radiologist request confirmed' });
    }

    if (type === 'emergency') {
      const appointment = metadata.appointment;
      const alert = metadata.alert;
      if (!appointment) {
        return res.status(400).json({ success: false, error: 'metadata.appointment required' });
      }
      await supabaseInsert('appointments', appointment);
      if (alert) {
        await supabaseInsert('emergency_alerts', alert);
      }
      return res.json({ success: true, message: 'Emergency appointment confirmed' });
    }

    return res.status(400).json({ success: false, error: 'Unknown type' });
  } catch (err) {
    console.error('Payment verify fulfilment error:', err);
    const msg = err.response?.data?.message || err.message || 'Failed to confirm after payment';
    return res.status(500).json({
      success: false,
      error: msg,
    });
  }
}

module.exports = {
  getPrices,
  createOrder,
  verifyPayment,
  PRICES,
  VALID_TYPES,
};
