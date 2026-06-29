/** Junction API helpers (colocated for Supabase deploy bundling). */

export function getJunctionBaseUrl(): string {
  return (
    Deno.env.get("JUNCTION_API_BASE_URL") ||
    "https://api.sandbox.us.junction.com"
  ).replace(/\/$/, "");
}

export function getJunctionApiKey(): string {
  const key = Deno.env.get("JUNCTION_API_KEY");
  if (!key) throw new Error("JUNCTION_API_KEY not configured");
  return key;
}

export function getLibreProvider(): string {
  return Deno.env.get("JUNCTION_LIBRE_PROVIDER") || "freestyle_libre";
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

/** Read response body once — never call res.json() and res.text() on the same response. */
async function readResponseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export function formatJunctionError(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (!payload || typeof payload !== "object") return fallback;

  const record = payload as Record<string, unknown>;
  const detail = record.detail;

  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg?: unknown }).msg ?? "");
        }
        return "";
      })
      .filter(Boolean);
    if (messages.length > 0) return messages.join(". ");
  }
  if (detail && typeof detail === "object") {
    const detailObj = detail as Record<string, unknown>;
    if (typeof detailObj.message === "string" && detailObj.message.trim()) {
      return detailObj.message;
    }
    if (typeof detailObj.error_type === "string") {
      const msg = typeof detailObj.message === "string" ? detailObj.message : fallback;
      return `${detailObj.error_type}: ${msg}`;
    }
  }
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  if (typeof record.error_message === "string" && record.error_message.trim()) {
    return record.error_message;
  }
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  const serialized = JSON.stringify(record);
  if (serialized && serialized !== "{}") {
    return `${fallback}: ${serialized}`;
  }
  return fallback;
}

export async function getOrCreateJunctionUser(clientUserId: string): Promise<string> {
  const res = await junctionFetch("/v2/user", {
    method: "POST",
    body: JSON.stringify({ client_user_id: clientUserId }),
  });

  const data = await readResponseBody(res) as Record<string, unknown>;

  if (res.ok) {
    return data.user_id as string;
  }

  if (res.status === 400) {
    const detail = data.detail as { user_id?: string } | undefined;
    if (detail?.user_id) return detail.user_id;
  }

  throw new Error(formatJunctionError(data, `Junction create user failed (${res.status})`));
}

export async function generateJunctionLinkToken(
  junctionUserId: string,
): Promise<{ link_token: string; link_web_url: string }> {
  // Junction docs: create a generic link token for the user, then connect provider via Link API.
  const res = await junctionFetch("/v2/link/token", {
    method: "POST",
    body: JSON.stringify({ user_id: junctionUserId }),
  });

  const data = await readResponseBody(res) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(formatJunctionError(data, "Failed to generate Junction link token"));
  }

  if (!data.link_web_url || !data.link_token) {
    throw new Error("Junction did not return link_web_url or link_token");
  }

  return {
    link_token: data.link_token as string,
    link_web_url: data.link_web_url as string,
  };
}

function isUnsupportedRegionError(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  if (record.error_type === "unsupported_region") return true;
  const detail = record.detail as Record<string, unknown> | undefined;
  const errorText = String(record.error ?? record.error_message ?? "");
  return errorText.includes("Unsupported region") ||
    detail?.error_type === "unsupported_region";
}

async function attemptFreestyleLibreEmailConnect(
  linkToken: string,
  email: string,
  region?: string,
): Promise<{ ok: true } | { ok: false; unsupportedRegion: boolean; message: string }> {
  const payload: Record<string, string> = { email: email.trim().toLowerCase() };
  if (region) payload.region = region;
  console.log("Junction email connect request:", {
    region: region ?? "(default)",
    emailDomain: email.split("@")[1] ?? "unknown",
  });

  const res = await junctionFetch("/v2/link/provider/email/freestyle_libre", {
    method: "POST",
    headers: { "x-vital-link-token": linkToken },
    body: JSON.stringify(payload),
  });

  const data = await readResponseBody(res);

  if (res.ok && !(data && typeof data === "object" && (data as Record<string, unknown>).state === "error")) {
    return { ok: true };
  }

  console.error("Junction email connect failed:", res.status, JSON.stringify(data));
  return {
    ok: false,
    unsupportedRegion: isUnsupportedRegionError(data),
    message: formatJunctionError(data, `LibreView email connect failed (HTTP ${res.status})`),
  };
}

/** EU sandbox: India first. US sandbox: us/ca only. */
function getRegionFallbackChain(preferredRegion: string): string[] {
  const base = getJunctionBaseUrl().toLowerCase();
  const isEu = base.includes("sandbox.eu") || base.includes("api.eu.junction");
  const defaults = isEu
    ? ["in", "gb", "de", "nl", "ie", "fr"]
    : ["us", "ca"];
  // On EU, ignore a stale client "us" preference — start with server defaults only.
  const preferred = isEu && (preferredRegion === "us" || preferredRegion === "ca")
    ? ""
    : preferredRegion;
  return [...new Set([preferred, ...defaults].filter(Boolean))];
}

export async function connectFreestyleLibreEmail(
  junctionUserId: string,
  email: string,
  preferredRegion: string,
): Promise<{ region: string }> {
  const regions = getRegionFallbackChain(preferredRegion);
  let lastError = "LibreView email connect failed";

  for (const region of regions) {
    const { link_token } = await generateJunctionLinkToken(junctionUserId);
    const result = await attemptFreestyleLibreEmailConnect(link_token, email, region);
    if (result.ok) {
      console.log(`Junction email connect succeeded with region "${region}"`);
      return { region };
    }
    lastError = result.message;
    // Try every allowed region — email mismatch is often region-specific (e.g. India patient on US team).
  }

  const { link_token } = await generateJunctionLinkToken(junctionUserId);
  const defaultResult = await attemptFreestyleLibreEmailConnect(link_token, email);
  if (defaultResult.ok) {
    console.log("Junction email connect succeeded with default region");
    return { region: preferredRegion || "us" };
  }

  throw new Error(lastError || defaultResult.message);
}

export function getDefaultLibreRegion(): string {
  const base = getJunctionBaseUrl().toLowerCase();
  if (base.includes("sandbox.eu") || base.includes("api.eu.junction")) {
    return Deno.env.get("JUNCTION_LIBRE_REGION") || "in";
  }
  return Deno.env.get("JUNCTION_LIBRE_REGION") || "us";
}
