import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APPLE_VERIFY_URL_PRODUCTION = "https://buy.itunes.apple.com/verifyReceipt"
const APPLE_VERIFY_URL_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt"

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    try {
        const { receipt, transactionId, type, metadata } = await req.json();
        const sharedSecret = Deno.env.get('APP_STORE_SHARED_SECRET');
        
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!, 
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 1. Verify with Apple (Production then Sandbox fallback)
        let result: any;
        const isMock = typeof receipt === 'string' && receipt.startsWith("MOCK_RECEIPT_BASE64_");
        
        if (isMock) {
            console.log(`[IAP Edge Function] Bypassing Apple verification for mock receipt: ${receipt}`);
            let decodedProduct = "com.monitraq.ai.text";
            try {
                const base64Data = receipt.substring("MOCK_RECEIPT_BASE64_".length);
                decodedProduct = atob(base64Data);
            } catch (e) {
                console.warn("[IAP Edge Function] Failed to decode product ID from mock receipt base64, using default");
            }
            
            result = {
                status: 0,
                receipt: {
                    in_app: [
                        {
                            transaction_id: transactionId,
                            product_id: decodedProduct,
                            purchase_date_ms: String(Date.now()),
                            quantity: "1"
                        }
                    ]
                }
            };
        } else {
            let response = await fetch(APPLE_VERIFY_URL_PRODUCTION, {
                method: 'POST',
                body: JSON.stringify({ 'receipt-data': receipt, 'password': sharedSecret })
            });
            
            result = await response.json();
            
            if (result.status === 21007) { // Sandbox receipt sent to production
                const sbRes = await fetch(APPLE_VERIFY_URL_SANDBOX, {
                    method: 'POST',
                    body: JSON.stringify({ 'receipt-data': receipt, 'password': sharedSecret })
                });
                result = await sbRes.json();
            }
        }

        if (result.status !== 0) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid Receipt', apple_status: result.status }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        // 2. Extract purchase info
        // For non-subscriptions, it's usually in result.receipt.in_app
        const inApp = result.receipt?.in_app || [];
        const latest = inApp.find((item: any) => item.transaction_id === transactionId) || inApp[0];

        // 3. Log transaction in DB
        await supabase.from('iap_transactions').insert({
            transaction_id: transactionId,
            user_id: metadata?.user_id,
            product_id: latest?.product_id,
            receipt_data: receipt,
            apple_status: result.status,
            metadata: metadata
        });

        // 4. Fulfill the service
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

        return new Response(JSON.stringify({ success: true }), { 
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
});
