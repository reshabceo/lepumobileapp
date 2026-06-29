import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  connectFreestyleLibreEmail,
  getDefaultLibreRegion,
  getOrCreateJunctionUser,
} from "./junction.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      return jsonResponse({ success: false, error: "Unauthorized — please log in again." });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: authData, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !authData?.user) {
      return jsonResponse({ success: false, error: "Invalid session — please log in again." });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let libreviewEmail: string | undefined;
    let region = getDefaultLibreRegion();

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.libreview_email === "string" && body.libreview_email.trim()) {
          libreviewEmail = body.libreview_email.trim().toLowerCase();
        }
        if (typeof body?.region === "string" && body.region.trim()) {
          region = body.region.trim().toLowerCase();
        }
      } catch {
        // Empty or invalid JSON body.
      }
    }

    if (!libreviewEmail) {
      return jsonResponse({
        success: false,
        error: "LibreView email is required. Enter the email you use on libreview.com (e.g. sahil@gmail.com).",
      });
    }

    const clientUserId = authData.user.id;
    const junctionUserId = await getOrCreateJunctionUser(clientUserId);

    await supabase.from("profiles").upsert({
      id: authData.user.id,
      email: authData.user.email ?? null,
      junction_user_id: junctionUserId,
      junction_connected: false,
    }, { onConflict: "id" });

    const connectResult = await connectFreestyleLibreEmail(
      junctionUserId,
      libreviewEmail,
      region,
    );

    await supabase.from("profiles").upsert({
      id: authData.user.id,
      junction_user_id: junctionUserId,
      junction_connected: true,
    }, { onConflict: "id" });

    return jsonResponse({
      success: true,
      connected: true,
      junction_user_id: junctionUserId,
      region: connectResult.region,
    });
  } catch (error) {
    console.error("create-junction-link error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ success: false, error: message });
  }
});
