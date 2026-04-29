import { useState } from 'react';
import { iapService } from '../services/iapService';
import { type IAPServiceType } from '../config/iap-products';
import { supabase } from '../lib/supabase';
import { useToast } from './use-toast';

export function usePurchaseIAP() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const purchase = async (type: IAPServiceType, metadata: any) => {
    setLoading(true);
    try {
      // 1. Native Purchase via Bridge
      const { getIAPProduct } = await import('../config/iap-products');
      const product = getIAPProduct(type);
      if (!product) throw new Error('Invalid product type');
      
      const transaction = await iapService.purchase(product.productId);
      
      if (!transaction) {
        throw new Error('Purchase cancelled or failed');
      }

      // 2. Backend Verification & Fulfillment
      const { data, error } = await supabase.functions.invoke('verify-iap-receipt', {
        body: { 
          receipt: transaction.receipt, 
          transactionId: transaction.transactionId,
          type,
          metadata
        }
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Verification failed');
      }

      toast({
        title: "Purchase Successful",
        description: "Your payment has been verified and service activated.",
      });

      return true;
    } catch (error: any) {
      console.error('IAP Error:', error);
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to complete purchase.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { purchase, loading };
}
