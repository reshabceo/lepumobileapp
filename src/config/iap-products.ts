export const IAP_PRODUCT_ID_PREFIX = 'com.monitraq';

export const IAP_PRODUCTS = {
  // AI Doctor Services
  ai_doctor_text: {
    productId: `${IAP_PRODUCT_ID_PREFIX}.ai.text`,
    name: 'AI Doctor Text Consultation',
    type: 'ai_doctor_text'
  },
  ai_doctor_voice: {
    productId: `${IAP_PRODUCT_ID_PREFIX}.ai.voice`,
    name: 'AI Doctor Voice Consultation',
    type: 'ai_doctor_voice'
  },
  // Appointment Services
  appointment_video: {
    productId: `${IAP_PRODUCT_ID_PREFIX}.appointment.video`,
    name: 'Video Consultation',
    type: 'appointment_video'
  },
  appointment_audio: {
    productId: `${IAP_PRODUCT_ID_PREFIX}.appointment.audio`,
    name: 'Audio Consultation',
    type: 'appointment_audio'
  },
  // Radiologist Services
  radiologist_review: {
    productId: `${IAP_PRODUCT_ID_PREFIX}.radiologist.review`,
    name: 'Radiologist Report Review',
    type: 'radiologist_review'
  },
  // Emergency Services
  emergency: {
    productId: `${IAP_PRODUCT_ID_PREFIX}.emergency.consult`,
    name: 'Emergency Consultation',
    type: 'emergency'
  },
};

// Radiologist Fee Tiers for dynamic pricing
// Note: These must match the Product IDs created in App Store Connect
export const RADIOLOGIST_FEE_TIERS = [
  { amount: 500, productId: `${IAP_PRODUCT_ID_PREFIX}.radiologist.fee.500` },
  { amount: 1000, productId: `${IAP_PRODUCT_ID_PREFIX}.radiologist.fee.1000` },
  { amount: 1500, productId: `${IAP_PRODUCT_ID_PREFIX}.radiologist.fee.1500` },
  { amount: 2000, productId: `${IAP_PRODUCT_ID_PREFIX}.radiologist.fee.2000` },
  { amount: 3000, productId: `${IAP_PRODUCT_ID_PREFIX}.radiologist.fee.3000` },
  { amount: 5000, productId: `${IAP_PRODUCT_ID_PREFIX}.radiologist.fee.5000` },
];

export const getRadiologistTier = (amountPaise: number) => {
  const amountRupees = amountPaise / 100;
  // Find the exact match or the closest tier (rounding up)
  const tier = RADIOLOGIST_FEE_TIERS.find(t => t.amount >= amountRupees);
  return tier || RADIOLOGIST_FEE_TIERS[RADIOLOGIST_FEE_TIERS.length - 1];
};

export type IAPServiceType = keyof typeof IAP_PRODUCTS;

export const getAllIAPProductIds = () => {
  const baseIds = Object.values(IAP_PRODUCTS).map(p => p.productId);
  const tierIds = RADIOLOGIST_FEE_TIERS.map(t => t.productId);
  return [...baseIds, ...tierIds];
};

export const getIAPProduct = (type: IAPServiceType) => {
  return IAP_PRODUCTS[type];
};

export const findProductByProductId = (productId: string) => {
  return Object.values(IAP_PRODUCTS).find(p => p.productId === productId);
};
