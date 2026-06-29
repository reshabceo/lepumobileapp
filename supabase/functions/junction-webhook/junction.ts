/** Junction API + webhook helpers (colocated for Supabase deploy bundling). */

export function getJunctionBaseUrl(): string {
  return (
    Deno.env.get("JUNCTION_API_BASE_URL") ||
    "https://api.sandbox.us.junction.com"
  ).replace(/\/$/, "");
}

function getJunctionApiKey(): string {
  const key = Deno.env.get("JUNCTION_API_KEY");
  if (!key) throw new Error("JUNCTION_API_KEY not configured");
  return key;
}

async function junctionFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const baseUrl = getJunctionBaseUrl();
  const apiKey = getJunctionApiKey();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("x-vital-api-key", apiKey);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

export async function verifySvixWebhook(
  rawBody: string,
  headers: Headers,
  secret: string,
): Promise<boolean> {
  const msgId = headers.get("svix-id");
  const msgTimestamp = headers.get("svix-timestamp");
  const msgSignature = headers.get("svix-signature");
  if (!msgId || !msgTimestamp || !msgSignature) return false;

  const ts = Number(msgTimestamp);
  if (!Number.isFinite(ts)) return false;
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (ageSec > 5 * 60) return false;

  const secretPart = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyBytes = Uint8Array.from(atob(secretPart), (c) => c.charCodeAt(0));
  const signedContent = `${msgId}.${msgTimestamp}.${rawBody}`;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(signedContent),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

  for (const part of msgSignature.split(" ")) {
    const [version, signature] = part.split(",");
    if (version === "v1" && signature === expected) return true;
  }
  return false;
}

export interface GlucoseSample {
  value: number;
  timestamp: string;
  trend?: string | null;
}

export function extractGlucoseSamples(payload: Record<string, unknown>): GlucoseSample[] {
  const samples: GlucoseSample[] = [];

  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;

    const value =
      (typeof obj.value === "number" ? obj.value : null) ??
      (typeof obj.glucose === "number" ? obj.glucose : null) ??
      (typeof obj.blood_glucose_mg_per_dL === "number" ? obj.blood_glucose_mg_per_dL : null) ??
      (typeof obj.glucose_mg_per_dL === "number" ? obj.glucose_mg_per_dL : null);

    const timestamp =
      (typeof obj.timestamp === "string" ? obj.timestamp : null) ??
      (typeof obj.start === "string" ? obj.start : null) ??
      (typeof obj.time === "string" ? obj.time : null);

    if (value != null && timestamp) {
      samples.push({
        value,
        timestamp,
        trend: typeof obj.trend === "string" ? obj.trend : null,
      });
      return;
    }

    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object") visit(v);
    }
  };

  visit(payload.data);
  visit(payload);
  return samples;
}

export async function fetchJunctionGlucoseSamples(
  junctionUserId: string,
  days = 1,
): Promise<GlucoseSample[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const res = await junctionFetch(
    `/v2/timeseries/${junctionUserId}/glucose?start_date=${fmt(start)}&end_date=${fmt(end)}`,
  );

  if (!res.ok) {
    console.warn("Junction glucose fetch failed:", res.status, await res.text());
    return [];
  }

  const data = await res.json();
  return extractGlucoseSamples(data as Record<string, unknown>);
}

export function mapGlucoseTrend(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") {
    switch (raw) {
      case 1: return "Falling";
      case 2: return "Stable";
      case 3: return "Rising";
      case 4: return "Rising Rapidly";
      case 5: return "Falling Rapidly";
      default: return null;
    }
  }
  return null;
}
