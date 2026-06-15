/**
 * Apple In-App Purchase product catalog (v2).
 * iOS IAP: Monitraq+ subscription + AI Doctor text/voice only.
 * Appointments, emergency, and radiologist use Razorpay on all platforms including iOS.
 */

export const IAP_PRODUCT_ID_PREFIX = 'com.monitraq';
export const IAP_VERSION_SUFFIX = 'v2';

/** Default admin net prices (paise) for AI Doctor when DB has no row. */
export const DEFAULT_AI_TEXT_NET_PAISE = 10000;
export const DEFAULT_AI_VOICE_NET_PAISE = 15000;

export const IAP_PRICE_129 = 129;
export const IAP_PRICE_175 = 175;

type IAPConsumableProduct = {
  productId: string;
  priceRupees: number;
  referenceName: string;
  displayName: string;
  description: string;
};

/** AI Doctor — 4 consumable tiers (₹129 / ₹175 × text & voice). */
export const IAP_AI_DOCTOR_PRODUCTS = {
  ai_doctor_text_129: {
    productId: `${IAP_PRODUCT_ID_PREFIX}.iap.ai.text.129_${IAP_VERSION_SUFFIX}`,
    priceRupees: IAP_PRICE_129,
    referenceName: 'Monitraq AI Doctor Text 129 v2',
    displayName: 'AI Doctor Text Consultation',
    description:
      'Unlock a 24-hour AI Doctor text consultation on Monitraq. One-time consumable purchase.',
  },
  ai_doctor_voice_129: {
    productId: `${IAP_PRODUCT_ID_PREFIX}.iap.ai.voice.129_${IAP_VERSION_SUFFIX}`,
    priceRupees: IAP_PRICE_129,
    referenceName: 'Monitraq AI Doctor Voice 129 v2',
    displayName: 'AI Doctor Voice Consultation',
    description:
      'Unlock a 24-hour AI Doctor voice consultation on Monitraq. One-time consumable purchase.',
  },
  ai_doctor_text_175: {
    productId: `${IAP_PRODUCT_ID_PREFIX}.iap.ai.text.175_${IAP_VERSION_SUFFIX}`,
    priceRupees: IAP_PRICE_175,
    referenceName: 'Monitraq AI Doctor Text 175 v2',
    displayName: 'AI Doctor Text Consultation (Premium)',
    description:
      'Unlock a 24-hour AI Doctor text consultation at the premium tier. One-time consumable purchase.',
  },
  ai_doctor_voice_175: {
    productId: `${IAP_PRODUCT_ID_PREFIX}.iap.ai.voice.175_${IAP_VERSION_SUFFIX}`,
    priceRupees: IAP_PRICE_175,
    referenceName: 'Monitraq AI Doctor Voice 175 v2',
    displayName: 'AI Doctor Voice Consultation (Premium)',
    description:
      'Unlock a 24-hour AI Doctor voice consultation at the premium tier. One-time consumable purchase.',
  },
} as const satisfies Record<string, IAPConsumableProduct>;

export const IAP_CONSUMABLE_PRODUCTS = {
  ...IAP_AI_DOCTOR_PRODUCTS,
} as const;

export type AIConsultPaymentType = 'ai_doctor_text' | 'ai_doctor_voice';

/** Payment types that use Apple IAP on iOS (AI Doctor only). */
export type IAPConsumablePaymentType = AIConsultPaymentType;

export function isAIConsultIAPType(type: string): type is AIConsultPaymentType {
  return type === 'ai_doctor_text' || type === 'ai_doctor_voice';
}

/** @deprecated Use isAIConsultIAPType — only AI Doctor uses IAP on iOS. */
export function isIOSIAPConsumableType(type: string): type is IAPConsumablePaymentType {
  return isAIConsultIAPType(type);
}

export function shouldUseIAPOnIOS(type: string): boolean {
  return isAIConsultIAPType(type);
}

export function normalizeNetPaise(netPaise: number): number {
  const n = Math.round(Number(netPaise));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function netRupeesFromPaise(netPaise: number): number {
  return Math.round(normalizeNetPaise(netPaise) / 100);
}

/** GST-inclusive rupees for AI Doctor admin net price (Razorpay / tier matching). */
export function getAIConsultChargeRupees(netPaise: number): number {
  return Math.round(normalizeNetPaise(netPaise) * 1.18) / 100;
}

function pickSmallestTierAtOrAbove(
  tiers: IAPConsumableProduct[],
  targetRupees: number,
): IAPConsumableProduct {
  const sorted = [...tiers].sort((a, b) => a.priceRupees - b.priceRupees);
  return sorted.find((t) => t.priceRupees >= targetRupees) ?? sorted[sorted.length - 1];
}

export function resolveAIConsultIAP(
  type: AIConsultPaymentType,
  netPaise: number,
): IAPConsumableProduct {
  const chargeRupees = getAIConsultChargeRupees(netPaise);
  const p = IAP_AI_DOCTOR_PRODUCTS;
  if (type === 'ai_doctor_text') {
    return pickSmallestTierAtOrAbove([p.ai_doctor_text_129, p.ai_doctor_text_175], chargeRupees);
  }
  return pickSmallestTierAtOrAbove([p.ai_doctor_voice_129, p.ai_doctor_voice_175], chargeRupees);
}

export function resolveIAPProduct(
  type: IAPConsumablePaymentType,
  amountPaise: number,
): IAPConsumableProduct {
  return resolveAIConsultIAP(type, amountPaise);
}

export function getIAPProductIdForPayment(type: IAPConsumablePaymentType, amountPaise: number): string {
  return resolveIAPProduct(type, amountPaise).productId;
}

export function getIAPDisplayRupees(type: IAPConsumablePaymentType, amountPaise: number): number {
  return resolveIAPProduct(type, amountPaise).priceRupees;
}

export function getAIConsultIAPProductId(type: AIConsultPaymentType, netPaise: number): string {
  return resolveAIConsultIAP(type, netPaise).productId;
}

export function getAIConsultIAPDisplayRupees(type: AIConsultPaymentType, netPaise: number): number {
  return resolveAIConsultIAP(type, netPaise).priceRupees;
}

export const IAP_SUBSCRIPTION_PRODUCTS = {
  monitraq_plus_monthly: {
    productId: `${IAP_PRODUCT_ID_PREFIX}.subscription.monitraq_plus_monthly_${IAP_VERSION_SUFFIX}`,
    name: 'Monitraq+ Monthly',
    planCode: 'monitraq_plus_monthly',
  },
  monitraq_plus_quarterly: {
    productId: `${IAP_PRODUCT_ID_PREFIX}.subscription.monitraq_plus_quarterly_${IAP_VERSION_SUFFIX}`,
    name: 'Monitraq+ Quarterly',
    planCode: 'monitraq_plus_quarterly',
  },
} as const;

/** Always use v2 subscription product IDs from code (ignore stale v1 values in DB). */
export function getAppleSubscriptionProductId(planCode: string): string | null {
  if (planCode === IAP_SUBSCRIPTION_PRODUCTS.monitraq_plus_monthly.planCode) {
    return IAP_SUBSCRIPTION_PRODUCTS.monitraq_plus_monthly.productId;
  }
  if (planCode === IAP_SUBSCRIPTION_PRODUCTS.monitraq_plus_quarterly.planCode) {
    return IAP_SUBSCRIPTION_PRODUCTS.monitraq_plus_quarterly.productId;
  }
  return null;
}

const LEGACY_SUBSCRIPTION_PRODUCT_IDS: Record<string, string> = {
  'com.monitraq.subscription.monitraq_plus_monthly_v1':
    IAP_SUBSCRIPTION_PRODUCTS.monitraq_plus_monthly.productId,
  'com.monitraq.subscription.monitraq_plus_quarterly_v1':
    IAP_SUBSCRIPTION_PRODUCTS.monitraq_plus_quarterly.productId,
};

export function normalizeAppleSubscriptionProductId(productId: string | null | undefined): string | null {
  if (!productId) return null;
  return LEGACY_SUBSCRIPTION_PRODUCT_IDS[productId] ?? productId;
}

export const IAP_PRODUCTS = {
  ai_doctor_text: {
    productId: IAP_AI_DOCTOR_PRODUCTS.ai_doctor_text_129.productId,
    name: IAP_AI_DOCTOR_PRODUCTS.ai_doctor_text_129.displayName,
    type: 'ai_doctor_text',
  },
  ai_doctor_voice: {
    productId: IAP_AI_DOCTOR_PRODUCTS.ai_doctor_voice_129.productId,
    name: IAP_AI_DOCTOR_PRODUCTS.ai_doctor_voice_129.displayName,
    type: 'ai_doctor_voice',
  },
  monitraq_plus_monthly: {
    productId: IAP_SUBSCRIPTION_PRODUCTS.monitraq_plus_monthly.productId,
    name: IAP_SUBSCRIPTION_PRODUCTS.monitraq_plus_monthly.name,
    type: 'monitraq_plus_monthly',
  },
  monitraq_plus_quarterly: {
    productId: IAP_SUBSCRIPTION_PRODUCTS.monitraq_plus_quarterly.productId,
    name: IAP_SUBSCRIPTION_PRODUCTS.monitraq_plus_quarterly.name,
    type: 'monitraq_plus_quarterly',
  },
};

export type IAPServiceType = keyof typeof IAP_PRODUCTS;

export const getAllIAPProductIds = (): string[] => {
  const aiDoctorIds = Object.values(IAP_AI_DOCTOR_PRODUCTS).map((p) => p.productId);
  const subscriptionIds = Object.values(IAP_SUBSCRIPTION_PRODUCTS).map((p) => p.productId);
  return [...new Set([...aiDoctorIds, ...subscriptionIds])];
};

export const getIAPProduct = (type: IAPServiceType) => IAP_PRODUCTS[type];

export const findProductByProductId = (productId: string) => {
  const consumable = Object.values(IAP_CONSUMABLE_PRODUCTS).find((p) => p.productId === productId);
  if (consumable) {
    return { productId: consumable.productId, name: consumable.displayName };
  }
  const sub = Object.values(IAP_SUBSCRIPTION_PRODUCTS).find((p) => p.productId === productId);
  if (sub) {
    return { productId: sub.productId, name: sub.name };
  }
  return Object.values(IAP_PRODUCTS).find((p) => p.productId === productId);
};

/** Full product list for App Store Connect setup reference. */
export const IAP_APP_STORE_CONNECT_CATALOG = [
  ...Object.values(IAP_AI_DOCTOR_PRODUCTS),
  ...Object.values(IAP_SUBSCRIPTION_PRODUCTS).map((s) => ({
    productId: s.productId,
    priceRupees: null as number | null,
    referenceName: s.name,
    displayName: s.name,
    description: `Monitraq+ auto-renewable subscription (${s.planCode}).`,
  })),
];
