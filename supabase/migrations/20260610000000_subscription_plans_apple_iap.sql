-- Monitraq+ subscription plans with Apple IAP product IDs (iOS).
-- price_paise is GST-inclusive (monthly ₹5,900, quarterly ₹11,800) — matches App Store IAP pricing.

INSERT INTO subscription_plans (code, display_name, price_paise, period_days, razorpay_plan_id, apple_product_id, is_active)
VALUES
  (
    'monitraq_plus_monthly',
    'Monitraq+ Monthly',
    590000,
    30,
    NULL,
    'com.monitraq.subscription.monitraq_plus_monthly_v2',
    true
  ),
  (
    'monitraq_plus_quarterly',
    'Monitraq+ Quarterly',
    1180000,
    90,
    NULL,
    'com.monitraq.subscription.monitraq_plus_quarterly_v2',
    true
  )
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_paise = EXCLUDED.price_paise,
  period_days = EXCLUDED.period_days,
  apple_product_id = EXCLUDED.apple_product_id,
  is_active = EXCLUDED.is_active;
