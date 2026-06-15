/**
 * Payment flow:
 * - iOS: Apple IAP for Monitraq+ subscription + AI Doctor text/voice only
 * - All platforms (including iOS): Razorpay for appointments, emergency, radiologist
 */

import { Capacitor } from '@capacitor/core';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { shouldIgnoreRazorpayPaymentFailed, startRazorpaySafeAreaLayout, stopRazorpaySafeAreaLayout } from './razorpayCheckoutUi';
import { iapService } from '@/services/iapService';
import {
  DEFAULT_AI_TEXT_NET_PAISE,
  DEFAULT_AI_VOICE_NET_PAISE,
  getAIConsultIAPDisplayRupees,
  getIAPProductIdForPayment,
  isAIConsultIAPType,
  normalizeNetPaise,
  resolveIAPProduct,
  shouldUseIAPOnIOS,
} from '../config/iap-products';

const FUNCTIONS_BASE = `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;

async function getEdgeFunctionErrorMessage(error: unknown, data?: Record<string, unknown>): Promise<string> {
  if (typeof data?.error === 'string' && data.error.trim()) return data.error.trim();
  if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim();

  const ctx = (error as { context?: Response })?.context;
  if (ctx) {
    try {
      const cloned = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
      if (typeof cloned.json === 'function') {
        const payload = await cloned.json();
        if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
        if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
      }
    } catch {
      // ignore parse failures
    }
    try {
      if (typeof ctx.text === 'function') {
        const text = await ctx.text();
        if (text?.trim()) return text.trim();
      }
    } catch {
      // ignore parse failures
    }
  }

  return error instanceof Error ? error.message : 'Request failed';
}

export function isIOSPaymentPlatform(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

export type PaymentType = 'appointment_video' | 'appointment_audio' | 'radiologist_review' | 'emergency' | 'ai_doctor_text' | 'ai_doctor_voice';

export interface PricesResponse {
  success: boolean;
  currency: string;
  dynamic?: boolean;
  source?: Record<string, string>;
}

export interface CreateOrderResponse {
  success: boolean;
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
  checkout_url?: string;
  short_url?: string;
  error?: string;
}

export interface VerifyPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  type: PaymentType;
  metadata: Record<string, any>;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptLoaded: Promise<void> | null = null;
/** Synchronous guard — must be set before any await to block duplicate taps. */
let checkoutLocked = false;
let activeRazorpayInstance: { close: () => void } | null = null;

/** Dedupe create-order calls when the same checkout is triggered more than once. */
let pendingOrderKey: string | null = null;
let pendingOrderPromise: Promise<CreateOrderResponse> | null = null;

function closeActiveRazorpayCheckout(): void {
  try {
    activeRazorpayInstance?.close();
  } catch {
    // Razorpay may already be closed
  } finally {
    activeRazorpayInstance = null;
  }
}

function orderDedupeKey(params: {
  type: PaymentType;
  amount_paise?: number;
  metadata?: Record<string, any>;
}): string {
  const m = params.metadata ?? {};
  const sessionId = m.session_id ?? m.appointment?.patient_id ?? '';
  const doctorId = m.appointment?.doctor_id ?? '';
  return `${params.type}:${params.amount_paise}:${sessionId}:${doctorId}`;
}

async function createOrderDeduped(params: {
  type: PaymentType;
  amount_paise?: number;
  currency?: string;
  metadata?: Record<string, any>;
}): Promise<CreateOrderResponse> {
  const key = orderDedupeKey(params);
  if (pendingOrderPromise && pendingOrderKey === key) {
    return pendingOrderPromise;
  }

  pendingOrderKey = key;
  pendingOrderPromise = createOrder(params);

  try {
    return await pendingOrderPromise;
  } catch (err) {
    if (pendingOrderKey === key) {
      pendingOrderKey = null;
      pendingOrderPromise = null;
    }
    throw err;
  }
}

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.Razorpay) return Promise.resolve();
  if (scriptLoaded) return scriptLoaded;

  scriptLoaded = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.head.appendChild(script);
  });
  return scriptLoaded;
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${supabaseAnonKey}`,
  };
}

export async function fetchPrices(): Promise<PricesResponse> {
  const res = await fetch(`${FUNCTIONS_BASE}/razorpay-prices`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch prices');
  return res.json();
}

export async function createOrder(params: {
  type: PaymentType;
  amount_paise?: number;
  currency?: string;
  metadata?: Record<string, any>;
}): Promise<CreateOrderResponse> {
  const res = await fetch(`${FUNCTIONS_BASE}/razorpay-create-order`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      type: params.type,
      amount_paise: params.amount_paise,
      currency: params.currency || 'INR',
      metadata: params.metadata,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create order');
  }
  return data;
}

export async function verifyPayment(payload: VerifyPayload): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await fetch(`${FUNCTIONS_BASE}/razorpay-verify`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Verification failed');
  }
  return data;
}

export interface CheckoutOptions {
  type: PaymentType;
  amount_paise: number;
  metadata: Record<string, any>;
  onSuccess: () => void;
  onDismiss?: () => void;
  onError?: (err: Error) => void;
}

export const GST_RATE = 0.18;
export const applyGst = (netPaise: number) => Math.round(normalizeNetPaise(netPaise) * (1 + GST_RATE));
export const gstAmount = (netPaise: number) => Math.round(normalizeNetPaise(netPaise) * GST_RATE);

export interface CheckoutPriceDisplay {
  netRupees: number;
  gstRupees: number;
  exactTotalRupees: number;
}

export function getCheckoutPriceDisplay(netPaise: number, includeGst = true): CheckoutPriceDisplay {
  const normalizedNet = normalizeNetPaise(netPaise);
  const netRupees = normalizedNet / 100;
  const gstRupees = includeGst ? Math.round(normalizedNet * GST_RATE) / 100 : 0;
  const exactTotalRupees = includeGst
    ? Math.round(normalizedNet * (1 + GST_RATE)) / 100
    : netRupees;
  return { netRupees, gstRupees, exactTotalRupees };
}

/** Platform-aware price display for checkout UI. */
export function getPlatformCheckoutPriceDisplay(
  type: PaymentType,
  amountPaise: number,
  includeGst = true,
): CheckoutPriceDisplay {
  if (isIOSPaymentPlatform() && isAIConsultIAPType(type)) {
    const total = getAIConsultIAPDisplayRupees(type, amountPaise);
    return { netRupees: total, gstRupees: 0, exactTotalRupees: total };
  }
  return getCheckoutPriceDisplay(amountPaise, includeGst);
}

export function getChargePaiseForPlatform(type: PaymentType, netPaise: number, includeGst = true): number {
  if (isIOSPaymentPlatform() && isAIConsultIAPType(type)) {
    return resolveIAPProduct(type, netPaise).priceRupees * 100;
  }
  return includeGst ? applyGst(netPaise) : normalizeNetPaise(netPaise);
}

export interface AIDoctorPricing {
  price_text_paise: number;
  price_voice_paise: number;
  currency: string;
}

export async function fetchAIDoctorPricing(): Promise<AIDoctorPricing> {
  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await (supabase as any)
      .from('ai_doctor_pricing')
      .select('price_text_paise, price_voice_paise, currency')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      return { price_text_paise: DEFAULT_AI_TEXT_NET_PAISE, price_voice_paise: DEFAULT_AI_VOICE_NET_PAISE, currency: 'INR' };
    }
    return {
      price_text_paise: Math.round(Number(data.price_text_paise) || DEFAULT_AI_TEXT_NET_PAISE),
      price_voice_paise: Math.round(Number(data.price_voice_paise) || DEFAULT_AI_VOICE_NET_PAISE),
      currency: data.currency || 'INR',
    };
  } catch {
    return { price_text_paise: DEFAULT_AI_TEXT_NET_PAISE, price_voice_paise: DEFAULT_AI_VOICE_NET_PAISE, currency: 'INR' };
  }
}

function paymentDescription(type: PaymentType): string {
  switch (type) {
    case 'appointment_video': return 'Video consultation';
    case 'appointment_audio': return 'Audio consultation';
    case 'radiologist_review': return 'Radiologist report review';
    case 'ai_doctor_text': return 'AI Doctor – Text consultation (24h)';
    case 'ai_doctor_voice': return 'AI Doctor – Voice consultation (24h)';
    default: return 'Emergency consultation';
  }
}

function openEmbeddedRazorpayCheckout(params: {
  order: CreateOrderResponse;
  type: PaymentType;
  paymentMetadata: Record<string, any>;
  onSuccess: () => void;
  onDismiss?: () => void;
  onError?: (err: Error) => void;
}): Promise<void> {
  const { order, type, paymentMetadata, onSuccess, onDismiss, onError } = params;

  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('Razorpay SDK not loaded'));
      return;
    }

    closeActiveRazorpayCheckout();

    let settled = false;
    let openedAt = 0;
    let stopSafeAreaLayout = () => {};

    const finish = (fn?: () => void) => {
      if (settled) return;
      settled = true;
      stopSafeAreaLayout();
      stopRazorpaySafeAreaLayout();
      if (activeRazorpayInstance === rzp) {
        activeRazorpayInstance = null;
      }
      fn?.();
    };

    const rzp = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      order_id: order.order_id,
      name: 'Monitraq',
      description: paymentDescription(type),
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          await verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            type,
            metadata: paymentMetadata,
          });
          finish(() => {
            onSuccess();
            resolve();
          });
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          finish(() => {
            onError?.(e);
            reject(e);
          });
        }
      },
      modal: {
        ondismiss: () => {
          finish(() => {
            onDismiss?.();
            resolve();
          });
        },
        confirm_close: true,
        escape: true,
        backdropclose: false,
      },
    });

    activeRazorpayInstance = rzp;

    rzp.on('payment.failed', (data: any) => {
      if (shouldIgnoreRazorpayPaymentFailed(openedAt, data)) {
        console.warn('[Razorpay] Ignoring spurious payment.failed during checkout open', data);
        return;
      }
      const err = new Error(data?.error?.description || 'Payment failed');
      finish(() => {
        onError?.(err);
        reject(err);
      });
    });

    stopSafeAreaLayout = startRazorpaySafeAreaLayout();
    openedAt = Date.now();
    rzp.open();
  });
}

async function verifyIAPPurchase(params: {
  type: PaymentType;
  metadata: Record<string, any>;
  transaction: { transactionId: string; receipt: string; productId?: string };
}): Promise<void> {
  const { type, metadata, transaction } = params;
  const isMock = transaction.receipt.startsWith('MOCK_RECEIPT_BASE64_');

  if (isMock) {
    const { supabase } = await import('./supabase');
    if (type === 'emergency') {
      const { appointment, alert } = metadata;
      await supabase.from('appointments').insert(appointment);
      await supabase.from('emergency_alerts').insert(alert);
    } else if (type === 'ai_doctor_text' || type === 'ai_doctor_voice') {
      const { session_id, consult_mode } = metadata;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('ai_doctor_sessions')
        .update({
          payment_status: 'paid',
          expires_at: expiresAt,
          consult_mode: consult_mode || (type === 'ai_doctor_voice' ? 'voice' : 'text'),
          paid_amount_paise: metadata.charged_amount_paise ?? metadata.amount_paise,
        })
        .eq('id', session_id);
    } else if (type.startsWith('appointment_')) {
      await supabase.from('appointments').insert(metadata.appointment);
    } else if (type === 'radiologist_review') {
      await supabase.from('radiologist_requests').insert(metadata.request);
    }
    return;
  }

  const { supabase } = await import('./supabase');
  const { data, error } = await supabase.functions.invoke('verify-iap-receipt', {
    body: {
      receipt: transaction.receipt,
      transactionId: transaction.transactionId,
      product_id: transaction.productId ?? metadata.iap_product_id,
      type,
      metadata,
    },
  });

  if (error) {
    throw new Error(await getEdgeFunctionErrorMessage(error, data as Record<string, unknown> | undefined));
  }
  if (!data?.success) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'IAP verification failed');
  }
}

async function payAndFulfilIOS(options: CheckoutOptions): Promise<void> {
  const { type, amount_paise, metadata, onSuccess, onDismiss, onError } = options;

  try {
    if (!isAIConsultIAPType(type)) {
      throw new Error('This payment type uses Razorpay, not In-App Purchase.');
    }

    const productId = getIAPProductIdForPayment(type, amount_paise);
    const iapProduct = resolveIAPProduct(type, amount_paise);
    const chargedPaise = iapProduct.priceRupees * 100;

    await iapService.preloadProducts();

    const available = await iapService.isProductAvailable(productId);
    if (!available) {
      throw new Error(
        `Product not found: ${productId}. Create this consumable in App Store Connect, attach it to the app, and test with a Sandbox Apple ID.`,
      );
    }

    const transaction = await iapService.purchase(productId);
    if (!transaction) {
      onDismiss?.();
      return;
    }

    const { supabase } = await import('./supabase');
    const { data: authData } = await supabase.auth.getUser();

    const paymentMetadata = {
      ...metadata,
      net_amount_paise: amount_paise,
      charged_amount_paise: chargedPaise,
      iap_product_id: productId,
      user_id: authData?.user?.id ?? metadata.user_id,
    };

    await verifyIAPPurchase({ type, metadata: paymentMetadata, transaction });
    onSuccess();
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    onError?.(e);
    throw e;
  }
}

/**
 * Create order, open checkout (IAP on iOS, Razorpay elsewhere), verify and fulfil.
 */
export async function payAndFulfil(options: CheckoutOptions): Promise<void> {
  if (checkoutLocked) {
    console.warn('[Payment] Checkout already in progress — ignoring duplicate request');
    return;
  }
  checkoutLocked = true;

  try {
    const { amount_paise } = options;
    if (!Number.isFinite(amount_paise) || amount_paise < 100) {
      throw new Error('Invalid amount. Fetch price from doctor or radiologist.');
    }

    if (isIOSPaymentPlatform() && shouldUseIAPOnIOS(options.type)) {
      await payAndFulfilIOS(options);
      return;
    }

    await payAndFulfilRazorpay(options);
  } finally {
    checkoutLocked = false;
    pendingOrderKey = null;
    pendingOrderPromise = null;
  }
}

async function payAndFulfilRazorpay(options: CheckoutOptions): Promise<void> {
  const { type, amount_paise, metadata, onSuccess, onDismiss, onError } = options;

  await loadRazorpayScript();

  const chargePaise =
    type === 'ai_doctor_text' || type === 'ai_doctor_voice'
      ? applyGst(amount_paise)
      : normalizeNetPaise(amount_paise);

  const paymentMetadata = {
    ...metadata,
    net_amount_paise: amount_paise,
    charged_amount_paise: chargePaise,
  };

  const order = await createOrderDeduped({
    type,
    amount_paise: chargePaise,
    metadata: paymentMetadata,
  });

  await openEmbeddedRazorpayCheckout({
    order,
    type,
    paymentMetadata,
    onSuccess,
    onDismiss,
    onError,
  });
}
