import { Capacitor } from '@capacitor/core';

/** Ignore spurious payment.failed events during Razorpay checkout init on iOS WKWebView. */

const EARLY_FAILURE_IGNORE_MS = 5000;

let layoutTimers: number[] = [];

function readSafeAreaInsets(): { top: number; bottom: number } {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;';
  document.body.appendChild(probe);
  const styles = getComputedStyle(probe);
  let top = parseFloat(styles.paddingTop) || 0;
  let bottom = parseFloat(styles.paddingBottom) || 0;
  probe.remove();

  if (Capacitor.getPlatform() === 'ios' && top === 0) {
    const minDim = Math.min(window.screen.width, window.screen.height);
    top = minDim >= 430 ? 59 : minDim >= 375 ? 47 : 20;
  }

  return { top, bottom };
}

function applyRazorpaySafeAreaStyles(insets: { top: number; bottom: number }): void {
  const topPx = `${insets.top}px`;
  const bottomPx = `${insets.bottom}px`;
  const height = `calc(100% - ${topPx} - ${bottomPx})`;

  document.documentElement.style.setProperty('--razorpay-safe-top', topPx);
  document.documentElement.style.setProperty('--razorpay-safe-bottom', bottomPx);

  document.querySelectorAll('.razorpay-container').forEach((node) => {
    const el = node as HTMLElement;
    el.style.setProperty('top', topPx, 'important');
    el.style.setProperty('height', height, 'important');
    el.style.setProperty('max-height', height, 'important');
    el.style.setProperty('box-sizing', 'border-box', 'important');
  });

  document.querySelectorAll('.razorpay-container iframe').forEach((node) => {
    const el = node as HTMLElement;
    el.style.setProperty('height', '100%', 'important');
    el.style.setProperty('max-height', '100%', 'important');
  });
}

/**
 * Apply safe-area layout a few times after Razorpay injects its modal (no MutationObserver).
 * Returns cleanup to run when checkout closes.
 */
export function startRazorpaySafeAreaLayout(): () => void {
  stopRazorpaySafeAreaLayout();

  const insets = readSafeAreaInsets();
  document.body.classList.add('razorpay-checkout-open');

  const apply = () => applyRazorpaySafeAreaStyles(insets);
  apply();
  requestAnimationFrame(apply);
  layoutTimers.push(window.setTimeout(apply, 80));
  layoutTimers.push(window.setTimeout(apply, 300));

  return stopRazorpaySafeAreaLayout;
}

export function stopRazorpaySafeAreaLayout(): void {
  layoutTimers.forEach((id) => window.clearTimeout(id));
  layoutTimers = [];
  document.body.classList.remove('razorpay-checkout-open');
  document.documentElement.style.removeProperty('--razorpay-safe-top');
  document.documentElement.style.removeProperty('--razorpay-safe-bottom');
}

export function shouldIgnoreRazorpayPaymentFailed(
  openedAt: number,
  data?: { error?: { description?: string; reason?: string } },
): boolean {
  if (!openedAt) return true;

  const elapsed = Date.now() - openedAt;
  const description = (data?.error?.description || data?.error?.reason || '').toLowerCase();

  if (elapsed < EARLY_FAILURE_IGNORE_MS) {
    return true;
  }

  if (
    description.includes('too many requests') ||
    description.includes('something went wrong') ||
    description.includes('oops')
  ) {
    return elapsed < 10000;
  }

  if (elapsed < 6000 && (description.includes('payment failed') || description === '')) {
    return true;
  }

  return false;
}
