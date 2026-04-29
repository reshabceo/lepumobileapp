import { Capacitor, registerPlugin } from '@capacitor/core';
import { IAP_PRODUCTS, type IAPServiceType } from '../config/iap-products';

export interface IAPTransaction {
  transactionId: string;
  receipt: string;
}

const IAP = registerPlugin<any>('IAP');

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
    
    try {
      const result = await this.plugin.purchase({ productId });
      if (result.success && result.transaction) {
        return result.transaction;
      }
      return null;
    } catch (e: any) {
      console.error('Purchase failed:', e);
      throw e;
    }
  }
}

export const iapService = new IAPService();
