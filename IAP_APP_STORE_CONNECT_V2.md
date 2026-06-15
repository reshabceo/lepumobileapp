# Apple IAP Products v2 — App Store Connect Setup

**iOS payment split:**

| Feature | Payment on iOS |
|---------|----------------|
| Monitraq+ Subscription | **Apple IAP** |
| AI Doctor Text | **Apple IAP** |
| AI Doctor Voice | **Apple IAP** |
| Doctor Appointment (video/audio) | **Razorpay** |
| Radiologist Review | **Razorpay** |
| Emergency Assistance | **Razorpay** |

Android and web use **Razorpay** for all paid features.

---

## AI Doctor (Consumable) — 4 products

| Product ID | Price (INR) |
|------------|-------------|
| `com.monitraq.iap.ai.text.129_v2` | ₹129 |
| `com.monitraq.iap.ai.voice.129_v2` | ₹129 |
| `com.monitraq.iap.ai.text.175_v2` | ₹175 |
| `com.monitraq.iap.ai.voice.175_v2` | ₹175 |

---

## Monitraq+ (Auto-renewable subscription) — 2 products

| Product ID | Plan |
|------------|------|
| `com.monitraq.subscription.monitraq_plus_monthly_v2` | Monthly |
| `com.monitraq.subscription.monitraq_plus_quarterly_v2` | Quarterly |

---

## Do NOT create IAP for

- Appointments (use Razorpay on iOS)
- Emergency (use Razorpay on iOS)
- Radiologist review (use Razorpay on iOS)

---

## Testing

1. Sandbox Apple ID on a physical iPhone.
2. **Health AI → Pay & Start** → Apple payment sheet (IAP).
3. **Services → Book Appointment** → Razorpay modal (not IAP).
4. **Profile → Upgrade plan** → Apple subscription (IAP).

Code: `src/config/iap-products.ts`, `src/lib/payment.ts`
