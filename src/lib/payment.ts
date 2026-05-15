/**
 * Razorpay payment flow for patient app: appointment (video/audio), radiologist review, emergency.
 * Uses Supabase Edge Functions: create-order → open Checkout → verify → fulfil (appointment/request/emergency).
 */

import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

const FUNCTIONS_BASE = `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;

import { Capacitor } from '@capacitor/core';
import { iapService } from '../services/iapService';
import { getIAPProduct } from '../config/iap-products';

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

export async function fulfilIAP(params: { 
  type: PaymentType; 
  metadata: Record<string, any>; 
  transactionId: string;
  receipt: string;
}): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${FUNCTIONS_BASE}/verify-iap-receipt`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'IAP Verification failed');
  }
  return data;
}

export interface CheckoutOptions {
  type: PaymentType;
  /** Required for all types – from doctor (video/audio/emergency) or radiologist (report_fee). */
  amount_paise: number;
  metadata: Record<string, any>;
  onSuccess: () => void;
  onDismiss?: () => void;
  onError?: (err: Error) => void;
}

export interface AIDoctorPricing {
  price_text_paise: number;
  price_voice_paise: number;
  currency: string;
}

/**
 * Fetch AI Doctor pricing from Supabase (admin-configured).
 */
export async function fetchAIDoctorPricing(): Promise<AIDoctorPricing> {
  const { supabase } = await import('@/lib/supabase');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('ai_doctor_pricing')
    .select('price_text_paise, price_voice_paise, currency')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return { price_text_paise: 10000, price_voice_paise: 15000, currency: 'INR' };
  }
  return data as AIDoctorPricing;
}

/**
 * Create order, open Razorpay Checkout, on success verify and call onSuccess.
 */
export async function payAndFulfil(options: CheckoutOptions): Promise<void> {
  const { type, amount_paise, metadata, onSuccess, onDismiss, onError } = options;

  // iOS Compliance: Use In-App Purchase for digital services
  if (Capacitor.getPlatform() === 'ios') {
    console.log("🍎 [DEBUG] iOS Platform detected, switching to IAP flow for type:", type);
    let productId: string | undefined;

    if (type === 'radiologist_review') {
      const { getRadiologistTier } = await import('../config/iap-products');
      productId = getRadiologistTier(amount_paise).productId;
    } else {
      const product = getIAPProduct(type as any);
      productId = product?.productId;
    }

    console.log("🍎 [DEBUG] Resolved IAP Product ID:", productId);

    if (productId) {
      try {
        const transaction = await iapService.purchase(productId as any);
        if (transaction) {
          // Verify and fulfil on the backend
          await fulfilIAP({
            type,
            metadata,
            transactionId: transaction.transactionId,
            receipt: transaction.receipt
          });
          onSuccess();
          return;
        } else {
          console.log("🍎 [DEBUG] IAP Purchase returned null (cancelled)");
          onDismiss?.();
          return;
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error("🍎 [DEBUG] IAP Purchase Error:", e);
        onError?.(e);
        return;
      }
    }
  }

  await loadRazorpayScript();

  if (!Number.isFinite(amount_paise) || amount_paise < 100) {
    throw new Error('Invalid amount. Fetch price from doctor or radiologist.');
  }

  const order = await createOrder({
    type,
    amount_paise,
    metadata,
  });

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      order_id: order.order_id,
      name: 'Monitraq',
      description: type === 'appointment_video' ? 'Video consultation'
        : type === 'appointment_audio' ? 'Audio consultation'
        : type === 'radiologist_review' ? 'Radiologist report review'
        : type === 'ai_doctor_text' ? 'AI Doctor – Text consultation (24h)'
        : type === 'ai_doctor_voice' ? 'AI Doctor – Voice consultation (24h)'
        : 'Emergency consultation',
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          await verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            type,
            metadata,
          });
          onSuccess();
          resolve();
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          onError?.(e);
          reject(e);
        }
      },
      modal: { ondismiss: () => { onDismiss?.(); resolve(); } },
    });
    rzp.on('payment.failed', (data: any) => {
      const err = new Error(data.error?.description || 'Payment failed');
      onError?.(err);
      reject(err);
    });
    rzp.open();
  });
}
