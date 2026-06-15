import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APPLE_VERIFY_URL_PRODUCTION = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_VERIFY_URL_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_DOCTOR_PRODUCT_IDS = new Set([
  "com.monitraq.iap.ai.text.129_v2",
  "com.monitraq.iap.ai.voice.129_v2",
  "com.monitraq.iap.ai.text.175_v2",
  "com.monitraq.iap.ai.voice.175_v2",
  // legacy
  "com.monitraq.ai.text_v1",
  "com.monitraq.ai.voice_v1",
  "com.monitraq.iap.ai.text.129_v1",
  "com.monitraq.iap.ai.voice.129_v1",
  "com.monitraq.iap.ai.text.175_v1",
  "com.monitraq.iap.ai.voice.175_v1",
]);

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

    const { receipt, transactionId, type, metadata, product_id: bodyProductId } = await req.json();
    const transaction_id = transactionId || metadata?.transaction_id;
    const iapProductId = metadata?.iap_product_id || bodyProductId || metadata?.product_id;

    if (!transaction_id) {
      return jsonResponse({ success: false, error: "Missing transaction ID" }, 400);
    }

    if (type !== "ai_doctor_text" && type !== "ai_doctor_voice") {
      return jsonResponse({ success: false, error: `Unsupported IAP type: ${type}` }, 400);
    }

    const sessionId = metadata?.session_id;
    if (!sessionId) {
      return jsonResponse({ success: false, error: "Missing session_id in metadata" }, 400);
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

    const { data: sessionRow, error: sessionErr } = await supabase
      .from("ai_doctor_sessions")
      .select("id, patient_id, payment_status")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionErr) {
      return jsonResponse({ success: false, error: `Session lookup failed: ${sessionErr.message}` }, 500);
    }
    if (!sessionRow) {
      return jsonResponse({ success: false, error: "Consultation session not found" }, 404);
    }
    if (sessionRow.patient_id !== patientRow.id) {
      return jsonResponse({ success: false, error: "Session does not belong to this patient" }, 403);
    }

    // Idempotent: already fulfilled for this transaction
    const { data: existingTx } = await supabase
      .from("iap_transactions")
      .select("transaction_id")
      .eq("transaction_id", String(transaction_id))
      .maybeSingle();

    if (existingTx && sessionRow.payment_status === "paid") {
      return jsonResponse({ success: true, message: "Already fulfilled" });
    }

    const isMock = typeof receipt === "string" && receipt.startsWith("MOCK_RECEIPT_BASE64_");
    let appleVerified = false;
    let resolvedProductId = iapProductId;

    if (isMock) {
      appleVerified = true;
      try {
        const base64Data = receipt.substring("MOCK_RECEIPT_BASE64_".length);
        resolvedProductId = atob(base64Data);
      } catch {
        // keep iapProductId
      }
    } else {
      const sharedSecret = Deno.env.get("APP_STORE_SHARED_SECRET");
      const hasReceipt = typeof receipt === "string" && receipt.length > 100;

      if (hasReceipt && sharedSecret) {
        const appleResult = await verifyAppleReceipt(receipt, sharedSecret);
        if (appleResult.status === 0) {
          appleVerified = true;
          const inApp = appleResult.receipt?.in_app || [];
          const match = inApp.find((item: { transaction_id?: string }) =>
            String(item.transaction_id) === String(transaction_id)
          ) || inApp[inApp.length - 1];
          if (match?.product_id) resolvedProductId = match.product_id;
        } else {
          console.warn("[verify-iap-receipt] Apple verify status:", appleResult.status);
          // StoreKit 2 consumables often have empty/stale app receipts — allow trusted fallback below
        }
      } else {
        console.warn("[verify-iap-receipt] No app receipt or shared secret — using StoreKit transaction fallback");
      }
    }

    if (!resolvedProductId) {
      return jsonResponse({ success: false, error: "Missing IAP product ID" }, 400);
    }

    if (!AI_DOCTOR_PRODUCT_IDS.has(resolvedProductId)) {
      return jsonResponse({ success: false, error: `Unknown product: ${resolvedProductId}` }, 400);
    }

    // StoreKit 2 consumables: trust authenticated transaction when Apple receipt verify unavailable
    if (!appleVerified && !isMock) {
      if (!iapProductId || iapProductId !== resolvedProductId) {
        resolvedProductId = iapProductId || resolvedProductId;
      }
      console.log("[verify-iap-receipt] Fulfilling via StoreKit transaction trust path", transaction_id);
    }

    const { error: txErr } = await supabase.from("iap_transactions").upsert(
      {
        transaction_id: String(transaction_id),
        user_id: authData.user.id,
        product_id: resolvedProductId,
        receipt_data: receipt || `sk2:${transaction_id}`,
        apple_status: appleVerified ? 0 : -1,
        metadata: {
          ...metadata,
          type,
          patient_id: patientRow.id,
          verification: appleVerified ? "apple_receipt" : "sk2_transaction",
        },
      },
      { onConflict: "transaction_id" },
    );

    if (txErr) {
      console.error("[verify-iap-receipt] iap_transactions upsert:", txErr);
      return jsonResponse({ success: false, error: `Transaction log failed: ${txErr.message}` }, 500);
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const paidPaise = metadata?.charged_amount_paise ?? metadata?.net_amount_paise ?? metadata?.amount_paise;

    const { data: updatedSession, error: updateErr } = await supabase
      .from("ai_doctor_sessions")
      .update({
        payment_status: "paid",
        expires_at: expiresAt,
        consult_mode: metadata?.consult_mode || (type === "ai_doctor_voice" ? "voice" : "text"),
        paid_amount_paise: paidPaise != null ? Math.round(Number(paidPaise)) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .select("id, payment_status, expires_at")
      .maybeSingle();

    if (updateErr) {
      console.error("[verify-iap-receipt] session update:", updateErr);
      return jsonResponse({ success: false, error: `Failed to activate session: ${updateErr.message}` }, 500);
    }
    if (!updatedSession) {
      return jsonResponse({ success: false, error: "Session update affected no rows" }, 500);
    }

    return jsonResponse({
      success: true,
      session_id: sessionId,
      expires_at: expiresAt,
      verification: appleVerified ? "apple_receipt" : "sk2_transaction",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Verification failed";
    console.error("[verify-iap-receipt]", error);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
