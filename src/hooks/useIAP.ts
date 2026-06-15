import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { iapService } from '../services/iapService';
import {
  getIAPProductIdForPayment,
  isAIConsultIAPType,
  normalizeNetPaise,
} from '../config/iap-products';
import { payAndFulfil } from '../lib/payment';
import { useToast } from './use-toast';

export function usePurchaseIAP() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const purchase = async (type: 'ai_doctor_text' | 'ai_doctor_voice', metadata: Record<string, unknown>) => {
    if (Capacitor.getPlatform() !== 'ios') {
      throw new Error('In-app purchase is only available on iOS.');
    }
    if (!isAIConsultIAPType(type)) {
      throw new Error('Only AI Doctor consultations use In-App Purchase on iOS.');
    }

    setLoading(true);
    try {
      const netPaise = normalizeNetPaise(
        Number(metadata?.net_amount_paise ?? metadata?.amount_paise) || 0,
      );
      const productId = getIAPProductIdForPayment(type, netPaise);
      await iapService.preloadProducts();
      const available = await iapService.isProductAvailable(productId);
      if (!available) {
        throw new Error(`Product not found: ${productId}`);
      }

      let fulfilled = false;
      await payAndFulfil({
        type,
        amount_paise: netPaise,
        metadata,
        onSuccess: () => {
          fulfilled = true;
        },
        onError: (err) => {
          throw err;
        },
      });

      if (fulfilled) {
        toast({
          title: 'Purchase Successful',
          description: 'Your payment has been verified and service activated.',
        });
      }
      return fulfilled;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to complete purchase.';
      console.error('IAP Error:', error);
      toast({
        title: 'Purchase Failed',
        description: message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { purchase, loading };
}
