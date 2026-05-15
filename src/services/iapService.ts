import { Capacitor, registerPlugin } from '@capacitor/core';
import { IAP_PRODUCTS, type IAPServiceType } from '../config/iap-products';

export interface IAPTransaction {
  transactionId: string;
  receipt: string;
}

const IAP = registerPlugin<any>('IAPPlugin');

class IAPService {
  private get plugin() {
    return IAP;
  }

  async loadProducts() {
    const pIds = Object.values(IAP_PRODUCTS).map(p => p.productId);
    if (!this.plugin) return [];
    try {
      const { products } = await this.plugin.loadProducts({ productIds: pIds });
      return products;
    } catch (e) {
      console.error('Failed to load products:', e);
      return [];
    }
  }

  async purchase(productId: string): Promise<IAPTransaction | null> {
    if (!productId) throw new Error('ProductId is required');
    console.log(`🛒 [IAP] Service: Initiating purchase for ${productId}`);
    
    try {
      const result = await this.plugin.purchase({ productId });
      console.log(`🛒 [IAP] Service: Native result:`, result);
      if (result.success && result.transaction) {
        return result.transaction;
      }
      return null;
    } catch (e: any) {
      console.error('Purchase failed:', e);
      throw e;
    }
  }

  async restorePurchases(): Promise<any[]> {
    try {
      const { transactions } = await this.plugin.restorePurchases();
      return transactions || [];
    } catch (e) {
      console.error('Restore failed:', e);
      return [];
    }
  }
}

export const iapService = new IAPService();
