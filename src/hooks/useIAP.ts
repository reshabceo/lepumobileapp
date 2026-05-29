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
      const isMock = transaction.receipt && transaction.receipt.startsWith("MOCK_RECEIPT_BASE64_");
      if (isMock) {
        console.log("⚠️ [IAP] Mock receipt detected on hook, bypassing backend verification and fulfilling directly.");
        if (type === 'emergency') {
          const { appointment, alert } = metadata;
          await supabase.from('appointments').insert(appointment);
          await supabase.from('emergency_alerts').insert(alert);
        } else if (type === 'ai_doctor_text' || type === 'ai_doctor_voice') {
          const { session_id, consult_mode } = metadata;
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await supabase.from('ai_doctor_sessions')
            .update({ 
              payment_status: 'paid', 
              expires_at: expiresAt,
              consult_mode: consult_mode || (type === 'ai_doctor_voice' ? 'voice' : 'text'),
              paid_amount_paise: metadata.amount_paise
            })
            .eq('id', session_id);
        } else if (type.startsWith('appointment_')) {
          await supabase.from('appointments').insert(metadata.appointment);
        } else if (type === 'radiologist_review') {
          await supabase.from('radiologist_requests').insert(metadata.request);
        }
      } else {
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
