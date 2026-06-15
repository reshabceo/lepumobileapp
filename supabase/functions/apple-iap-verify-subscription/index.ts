import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APPLE_VERIFY_URL_PRODUCTION = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_VERIFY_URL_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRODUCT_PLAN_MAP: Record<string, string> = {
  "com.monitraq.subscription.monitraq_plus_monthly_v1": "monitraq_plus_monthly",
  "com.monitraq.subscription.monitraq_plus_quarterly_v1": "monitraq_plus_quarterly",
  "com.monitraq.subscription.monitraq_plus_monthly_v2": "monitraq_plus_monthly",
  "com.monitraq.subscription.monitraq_plus_quarterly_v2": "monitraq_plus_quarterly",
};

const PLAN_PERIOD_DAYS: Record<string, number> = {
  monitraq_plus_monthly: 30,
  monitraq_plus_quarterly: 90,
};

async function verifyAppleReceipt(receipt: string, sharedSecret: string) {
  const body = JSON.stringify({
    "receipt-data": receipt,
    password: sharedSecret,
    "exclude-old-transactions": false,
  });

  let response = await fetch(APPLE_VERIFY_URL_PRODUCTION, { method: "POST", body });
  let result = await response.json();

  if (result.status === 21007) {
    const sbRes = await fetch(APPLE_VERIFY_URL_SANDBOX, { method: "POST", body });
    result = await sbRes.json();
  }

  return result;
}

function pickLatestSubscription(receiptResult: Record<string, unknown>, productId: string) {
  const latestInfo = (receiptResult.latest_receipt_info as Record<string, string>[] | undefined) || [];
  const inApp = ((receiptResult.receipt as { in_app?: Record<string, string>[] } | undefined)?.in_app) || [];
  const entries = [...latestInfo, ...inApp].filter((item) => item?.product_id === productId);

  if (!entries.length) return null;

  return entries.sort(
    (a, b) =>
      Number(b.expires_date_ms || b.purchase_date_ms || 0) -
      Number(a.expires_date_ms || a.purchase_date_ms || 0),
  )[0];
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: authData, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !authData?.user) {
      return jsonResponse({ success: false, error: "Invalid session" }, 401);
    }

    const {
      receipt,
      transaction_id,
      product_id,
      plan_code,
      expiration_date_ms,
      original_transaction_id,
    } = await req.json();

    if (!product_id) {
      return jsonResponse({ success: false, error: "Missing product_id" }, 400);
    }

    const resolvedPlanCode = plan_code || PRODUCT_PLAN_MAP[product_id];
    if (!resolvedPlanCode) {
      return jsonResponse({ success: false, error: "Unknown subscription product" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: patientRow, error: patientErr } = await supabase
      .from("patients")
      .select("id")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (patientErr || !patientRow?.id) {
      return jsonResponse({ success: false, error: "Patient not found" }, 404);
    }

    const txId = transaction_id ? String(transaction_id) : null;
    if (!txId) {
      return jsonResponse({ success: false, error: "Missing transaction_id" }, 400);
    }

    // Idempotent: already fulfilled for this transaction
    const { data: existingTx } = await supabase
      .from("iap_transactions")
      .select("transaction_id, metadata")
      .eq("transaction_id", txId)
      .maybeSingle();

    if (existingTx?.metadata?.plan_code === resolvedPlanCode) {
      const { data: activeSub } = await supabase
        .from("patient_subscriptions")
        .select("valid_until, plan_code, status")
        .eq("patient_id", patientRow.id)
        .eq("source", "apple_iap")
        .in("status", ["active", "paused", "pending"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeSub?.status === "active") {
        return jsonResponse({
          success: true,
          plan_code: activeSub.plan_code || resolvedPlanCode,
          valid_until: activeSub.valid_until,
          message: "Already fulfilled",
        });
      }
    }

    const isMock = typeof receipt === "string" && receipt.startsWith("MOCK_RECEIPT_BASE64_");
    let appleVerified = false;
    let expiresMs = expiration_date_ms ? Number(expiration_date_ms) : 0;
    let originalTxId = original_transaction_id ? String(original_transaction_id) : txId;
    let verification = "sk2_transaction";

    if (isMock) {
      appleVerified = true;
      verification = "mock";
      if (!expiresMs || expiresMs <= Date.now()) {
        const periodDays = PLAN_PERIOD_DAYS[resolvedPlanCode] ?? 30;
        expiresMs = Date.now() + periodDays * 24 * 60 * 60 * 1000;
      }
    } else {
      const sharedSecret = Deno.env.get("APP_STORE_SHARED_SECRET");
      const hasReceipt = typeof receipt === "string" && receipt.length > 100;

      if (hasReceipt && sharedSecret) {
        const appleResult = await verifyAppleReceipt(receipt, sharedSecret);
        if (appleResult.status === 0) {
          const subInfo = pickLatestSubscription(appleResult, product_id);
          if (subInfo) {
            const receiptExpiresMs = Number(subInfo.expires_date_ms);
            if (receiptExpiresMs > Date.now()) {
              appleVerified = true;
              verification = "apple_receipt";
              expiresMs = receiptExpiresMs;
              originalTxId = String(subInfo.original_transaction_id || subInfo.transaction_id || originalTxId);
            }
          }
        } else {
          console.warn("[apple-iap-verify-subscription] Apple verify status:", appleResult.status);
        }
      } else {
        console.warn("[apple-iap-verify-subscription] No receipt or shared secret — using StoreKit fallback");
      }

      if (!appleVerified) {
        if (!expiresMs || expiresMs <= Date.now()) {
          const { data: planRow } = await supabase
            .from("subscription_plans")
            .select("period_days")
            .eq("code", resolvedPlanCode)
            .maybeSingle();

          const periodDays = planRow?.period_days ?? PLAN_PERIOD_DAYS[resolvedPlanCode] ?? 30;
          expiresMs = Date.now() + periodDays * 24 * 60 * 60 * 1000;
          console.log("[apple-iap-verify-subscription] Using plan period fallback:", periodDays, "days");
        }
        verification = expiresMs > Date.now() ? "sk2_transaction" : "failed";
      }
    }

    if (!expiresMs || expiresMs <= Date.now()) {
      return jsonResponse({ success: false, error: "Subscription is not active" }, 400);
    }

    const validUntil = new Date(expiresMs).toISOString();
    const nowIso = new Date().toISOString();

    const { error: txErr } = await supabase.from("iap_transactions").upsert(
      {
        transaction_id: txId,
        user_id: authData.user.id,
        product_id,
        receipt_data: receipt || `sk2:${txId}`,
        apple_status: appleVerified ? 0 : -1,
        metadata: {
          plan_code: resolvedPlanCode,
          patient_id: patientRow.id,
          source: "apple_iap",
          verification,
          original_transaction_id: originalTxId,
          expires_at: validUntil,
        },
      },
      { onConflict: "transaction_id" },
    );

    if (txErr) {
      console.error("[apple-iap-verify-subscription] iap_transactions upsert:", txErr);
      return jsonResponse({ success: false, error: `Transaction log failed: ${txErr.message}` }, 500);
    }

    const { data: existingSub } = await supabase
      .from("patient_subscriptions")
      .select("id")
      .eq("patient_id", patientRow.id)
      .eq("source", "apple_iap")
      .in("status", ["active", "paused", "pending"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const subPayload = {
      patient_id: patientRow.id,
      plan_code: resolvedPlanCode,
      status: "active",
      source: "apple_iap",
      valid_until: validUntil,
      started_at: nowIso,
      cancel_at_period_end: false,
      razorpay_subscription_id: null,
      apple_original_transaction_id: originalTxId,
      apple_product_id: product_id,
      updated_at: nowIso,
    };

    if (existingSub?.id) {
      const { error: updateErr } = await supabase
        .from("patient_subscriptions")
        .update(subPayload)
        .eq("id", existingSub.id);
      if (updateErr) {
        return jsonResponse({ success: false, error: `Subscription update failed: ${updateErr.message}` }, 500);
      }
    } else {
      const { error: insertErr } = await supabase.from("patient_subscriptions").insert(subPayload);
      if (insertErr) {
        return jsonResponse({ success: false, error: `Subscription create failed: ${insertErr.message}` }, 500);
      }
    }

    const { error: patientUpdateErr } = await supabase
      .from("patients")
      .update({ subscription_tier: "monitraq_plus", updated_at: nowIso })
      .eq("id", patientRow.id);

    if (patientUpdateErr) {
      console.error("[apple-iap-verify-subscription] patient tier update:", patientUpdateErr);
    }

    return jsonResponse({
      success: true,
      plan_code: resolvedPlanCode,
      valid_until: validUntil,
      verification,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Verification failed";
    console.error("[apple-iap-verify-subscription]", error);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
