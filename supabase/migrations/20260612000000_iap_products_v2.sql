-- Apple IAP product IDs v2 (consumables + subscriptions)

UPDATE subscription_plans
SET apple_product_id = 'com.monitraq.subscription.monitraq_plus_monthly_v2'
WHERE code = 'monitraq_plus_monthly';

UPDATE subscription_plans
SET apple_product_id = 'com.monitraq.subscription.monitraq_plus_quarterly_v2'
WHERE code = 'monitraq_plus_quarterly';
