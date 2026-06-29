import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractGlucoseSamples,
  fetchJunctionGlucoseSamples,
  mapGlucoseTrend,
  verifySvixWebhook,
} from "./junction.ts";

const LIBRE_PROVIDERS = new Set(["abbott_libreview", "freestyle_libre"]);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const webhookSecret = Deno.env.get("JUNCTION_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("JUNCTION_WEBHOOK_SECRET not configured");
      return new Response("Server misconfigured", { status: 500 });
    }

    const rawBody = await req.text();
    const isValid = await verifySvixWebhook(rawBody, req.headers, webhookSecret);
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const eventType = payload.event_type as string | undefined;
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const junctionUserId =
      (data.user_id as string | undefined) ||
      (payload.user_id as string | undefined);
    const clientUserId =
      (payload.client_user_id as string | undefined) ||
      (data.client_user_id as string | undefined);
    const providerSlug =
      (data.provider as { slug?: string } | undefined)?.slug ||
      (data.source as { slug?: string } | undefined)?.slug;

    async function resolveProfileId(): Promise<string | null> {
      if (clientUserId) return clientUserId;
      if (!junctionUserId) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("junction_user_id", junctionUserId)
        .maybeSingle();
      return profile?.id ?? null;
    }

    if (eventType === "provider.connection.created") {
      if (junctionUserId && (!providerSlug || LIBRE_PROVIDERS.has(providerSlug))) {
        const userId = await resolveProfileId();
        if (userId) {
          await supabase.from("profiles").upsert({
            id: userId,
            junction_user_id: junctionUserId,
            junction_connected: true,
          }, { onConflict: "id" });
        } else {
          await supabase
            .from("profiles")
            .update({ junction_connected: true, junction_user_id: junctionUserId })
            .eq("junction_user_id", junctionUserId);
        }
      }
    }

    if (eventType === "provider.connection.error") {
      const userId = await resolveProfileId();
      if (userId) {
        await supabase
          .from("profiles")
          .update({ junction_connected: false })
          .eq("id", userId);
      }
    }

    const isGlucoseEvent =
      eventType === "daily.data.glucose.created" ||
      eventType === "daily.data.glucose.updated" ||
      eventType === "historical.data.glucose.created";

    if (isGlucoseEvent && junctionUserId) {
      let samples = extractGlucoseSamples(payload);
      if (samples.length === 0) {
        samples = await fetchJunctionGlucoseSamples(junctionUserId, 1);
      }

      const userId = await resolveProfileId();
      if (!userId) {
        console.warn("No profile for Junction user:", junctionUserId);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const rows = samples
        .map((sample) => {
          if (!Number.isFinite(sample.value) || !sample.timestamp) return null;
          return {
            user_id: userId,
            glucose: Math.round(sample.value),
            trend: mapGlucoseTrend(sample.trend),
            reading_timestamp: sample.timestamp,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (rows.length > 0) {
        await supabase.from("glucose_readings").insert(rows);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("junction-webhook error:", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});
