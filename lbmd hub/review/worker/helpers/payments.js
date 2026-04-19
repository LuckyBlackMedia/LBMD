/**
 * LBM Admin — Payment gateway helpers
 * Phase 3
 *
 * Secrets required:
 *   SQUARE_ACCESS_TOKEN   — server-side access token from Square Developer dashboard
 *   PAYPAL_CLIENT_ID      — PayPal app client ID (same value as frontend)
 *   PAYPAL_CLIENT_SECRET  — PayPal app client secret
 *
 * Vars (wrangler.toml):
 *   SQUARE_ENVIRONMENT    — "sandbox" | "production"  (default: sandbox)
 *   PAYPAL_MODE           — "sandbox" | "live"        (default: sandbox)
 *
 * Exports:
 *   squareCharge(sourceId, amountCents, idempotencyKey, env)
 *   paypalGetToken(env)
 *   paypalCreateOrder(amountCents, customId, env)
 *   paypalCaptureOrder(orderId, env)
 */

// ── Square ────────────────────────────────────────────────────────────────────

function squareBase(env) {
  return (env.SQUARE_ENVIRONMENT === 'production')
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

/**
 * Charge a card via Square Payments API.
 *
 * @param {string} sourceId        - Payment token from Square Web Payments SDK
 * @param {number} amountCents     - Amount in cents (e.g. 35000 = $350.00)
 * @param {string} idempotencyKey  - UUID to prevent duplicate charges (use hold_id)
 * @param {object} env             - CF Worker env bindings
 * @returns {{ success: boolean, paymentId?: string, error?: string }}
 */
export async function squareCharge(sourceId, amountCents, idempotencyKey, env) {
  if (!env.SQUARE_ACCESS_TOKEN) {
    console.error('payments squareCharge: SQUARE_ACCESS_TOKEN not set');
    return { success: false, error: 'Payment provider not configured' };
  }
  if (!env.SQUARE_LOCATION_ID) {
    console.error('payments squareCharge: SQUARE_LOCATION_ID not set');
    return { success: false, error: 'Payment provider not configured' };
  }

  try {
    const res = await fetch(`${squareBase(env)}/v2/payments`, {
      method: 'POST',
      headers: {
        Authorization:   `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
        'Content-Type':  'application/json',
        'Square-Version': '2024-01-17',
      },
      body: JSON.stringify({
        source_id:       sourceId,
        idempotency_key: idempotencyKey,
        amount_money:    { amount: amountCents, currency: 'USD' },
        location_id:     env.SQUARE_LOCATION_ID,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.errors?.[0]?.detail
        || data.errors?.[0]?.code
        || `Square ${res.status}`;
      console.error('payments squareCharge error:', JSON.stringify(data.errors));
      return { success: false, error: errMsg };
    }

    if (data.payment?.status === 'COMPLETED') {
      return { success: true, paymentId: data.payment.id };
    }

    // APPROVED status means card was tokenised but not captured — rare
    if (data.payment?.status === 'APPROVED') {
      return { success: true, paymentId: data.payment.id };
    }

    return { success: false, error: `Unexpected payment status: ${data.payment?.status}` };
  } catch (err) {
    console.error('payments squareCharge fetch error:', err);
    return { success: false, error: 'Could not reach payment provider' };
  }
}

// ── PayPal ────────────────────────────────────────────────────────────────────

function paypalBase(env) {
  return (env.PAYPAL_MODE === 'live')
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

/**
 * Get a short-lived PayPal OAuth access token.
 * Tokens last ~9 hours; in a Worker we fetch fresh per-request (stateless).
 *
 * @returns {string} access_token
 */
export async function paypalGetToken(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new Error('PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not set');
  }

  const credentials = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);

  const res = await fetch(`${paypalBase(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`PayPal auth failed: ${data.error_description || res.status}`);
  }
  return data.access_token;
}

/**
 * Create a PayPal order (intent: CAPTURE).
 * Stores hold context in `custom_id` so the capture endpoint can recover it.
 *
 * @param {number} amountCents - Amount in cents
 * @param {string} customId    - Opaque reference (hold_id stored here for recovery)
 * @param {object} env
 * @returns {string} PayPal order ID
 */
export async function paypalCreateOrder(amountCents, customId, env) {
  const token = await paypalGetToken(env);
  const value = (amountCents / 100).toFixed(2);

  const res = await fetch(`${paypalBase(env)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization:     `Bearer ${token}`,
      'Content-Type':    'application/json',
      'PayPal-Request-Id': customId, // idempotency key
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount:    { currency_code: 'USD', value },
        custom_id: customId,
      }],
      application_context: {
        brand_name:          'Lucky Black Media',
        landing_page:        'NO_PREFERENCE',
        user_action:         'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    throw new Error(`PayPal create order failed: ${data.message || res.status}`);
  }
  return data.id;
}

/**
 * Capture an approved PayPal order.
 *
 * @param {string} orderId - PayPal order ID from the frontend onApprove callback
 * @param {object} env
 * @returns {{ success: boolean, paymentId?: string, customId?: string, error?: string }}
 */
export async function paypalCaptureOrder(orderId, env) {
  try {
    const token = await paypalGetToken(env);

    const res = await fetch(`${paypalBase(env)}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(`PayPal capture failed: ${data.message || res.status}`);
    }

    // Verify capture completed
    const capture  = data.purchase_units?.[0]?.payments?.captures?.[0];
    const customId = data.purchase_units?.[0]?.custom_id;

    if (capture?.status !== 'COMPLETED') {
      throw new Error(`PayPal capture status: ${capture?.status}`);
    }

    return { success: true, paymentId: capture.id, customId };
  } catch (err) {
    console.error('payments paypalCaptureOrder error:', err);
    return { success: false, error: err.message };
  }
}
