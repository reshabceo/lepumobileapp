import { Capacitor, registerPlugin } from '@capacitor/core';
import { getAllIAPProductIds } from '../config/iap-products';

export interface IAPTransaction {
  transactionId: string;
  receipt: string;
  productId?: string;
  /** StoreKit 2 — subscription renewal end (ms since epoch). */
  expirationDateMs?: number;
  originalTransactionId?: string;
}

export interface IAPProductInfo {
  productId: string;
  localizedPrice?: string;
  title?: string;
  description?: string;
}

const IAP = registerPlugin<any>('IAPPlugin');

class IAPService {
  private purchaseInFlight = false;
  private cachedProductIds = new Set<string>();
  private preloadPromise: Promise<void> | null = null;

  private get plugin() {
    return IAP;
  }

  /** Preload all IAP product IDs from StoreKit (call when AI Doctor screen opens). */
  async preloadProducts(): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;
    this.preloadPromise = (async () => {
      const products = await this.loadProducts(getAllIAPProductIds());
      products.forEach((p) => {
        if (p.productId) this.cachedProductIds.add(p.productId);
      });
    })();
    return this.preloadPromise;
  }

  async loadProducts(productIds?: string[]) {
    const pIds = productIds?.length ? productIds : getAllIAPProductIds();
    if (!this.plugin) return [];
    try {
      const { products } = await this.plugin.loadProducts({ productIds: pIds });
      const list = (products || []) as IAPProductInfo[];
      list.forEach((p) => {
        if (p.productId) this.cachedProductIds.add(p.productId);
      });
      return list;
    } catch (e) {
      console.error('Failed to load products:', e);
      return [];
    }
  }

  /** Returns true when StoreKit knows this product (App Store Connect / StoreKit config). */
  async isProductAvailable(productId: string): Promise<boolean> {
    if (this.cachedProductIds.has(productId)) return true;
    const products = await this.loadProducts([productId]);
    return products.some((p) => p.productId === productId);
  }

  async purchase(productId: string): Promise<IAPTransaction | null> {
    if (!productId) throw new Error('ProductId is required');
    if (this.purchaseInFlight) {
      throw new Error('A purchase is already in progress. Please wait.');
    }

    this.purchaseInFlight = true;
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
      if (e?.code === 'USER_CANCELLED' || e?.message === 'User cancelled') {
        return null;
      }
      const message = e?.message || e?.errorMessage || 'Purchase failed';
      if (typeof message === 'string' && message.includes('Product not found')) {
        throw new Error(
          `This item is not set up in App Store Connect yet (${productId}). ` +
            'Create the consumable IAP with this exact Product ID, attach it to the app, and test with a Sandbox Apple ID.'
        );
      }
      throw e instanceof Error ? e : new Error(message);
    } finally {
      this.purchaseInFlight = false;
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
