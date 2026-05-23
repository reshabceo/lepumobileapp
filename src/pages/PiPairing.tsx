/**
 * Provision the Raspberry Pi WAN bridge hotspot: pairing token exchange + `/setup`.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Router } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { MobileAppContainer } from "@/components/MobileAppContainer";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { getCameraSFUOrigin } from "@/config/cameraStream";
import { getICEServers } from "@/config/webrtc";

const provisionDefaultOrigin = (): string =>
  ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PI_PROVISION_ORIGIN || "http://192.168.42.1:8888").replace(
    /\/$/,
    "",
  );

async function pairingIceJson(): Promise<string> {
  const ice = await getICEServers();
  return JSON.stringify(
    ice.map((s) => {
      const urlsVal = typeof s.urls === "string" ? s.urls : s.urls;
      const legacy = s as RTCIceServer & { username?: string; credential?: string };
      const row: Record<string, unknown> = { urls: urlsVal };
      if (legacy.username) row.username = legacy.username;
      if (legacy.credential) row.credential = legacy.credential;
      return row;
    }),
  );
}

export default function PiPairingPage() {
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [hwSerial, setHwSerial] = useState("");
  const [pairToken, setPairToken] = useState("");
  const [wifiSSID, setWifiSSID] = useState("");
  const [wifiPSK, setWifiPSK] = useState("");
  const provisionBase = provisionDefaultOrigin();
  const isNativeNote = Capacitor.isNativePlatform();

  const sfuConfigured = Boolean(getCameraSFUOrigin());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) {
          navigate("/dashboard");
          return;
        }
        const { data: p, error: pe } = await supabase.from("patients").select("id").eq("auth_user_id", uid).single();
        if (pe || !p?.id) {
          toast.error("Patient profile not found");
          navigate("/dashboard");
          return;
        }
        if (!cancelled) setPatientId(p.id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const canGenerateToken = useMemo(() => hwSerial.trim().length >= 4 && !!patientId, [hwSerial, patientId]);

  const generatePairToken = async () => {
    if (!patientId) return;
    const hw = hwSerial.trim();
    await supabase.from("camera_bridges").delete().eq("patient_id", patientId).eq("hardware_serial", hw);
    const token = crypto.randomUUID();
    const { error } = await supabase.from("camera_bridges").insert({
      patient_id: patientId,
      hardware_serial: hw,
      pairing_token: token,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPairToken(token);
    toast.success("Pairing token created. Tap “Send credentials to Pi” while on the hotspot.");
  };

  const sendToPi = async () => {
    if (!patientId || !sfuConfigured) {
      toast.error("SFU URL missing (set VITE_CAMERA_SFU_URL).");
      return;
    }
    const hw = hwSerial.trim();
    const tok = pairToken.trim();
    if (!hw || !tok || !wifiSSID.trim() || !wifiPSK.trim()) {
      toast.error("Hardware serial, token, pairing Wi-Fi SSID, and password are required.");
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const jwt = sess?.session?.access_token;
    if (!jwt) {
      toast.error("Not signed in.");
      return;
    }
    const sfu = getCameraSFUOrigin()!.replace(/\/$/, "");

    try {
      const reg = await fetch(`${sfu}/bridges/register`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patientId, hardware_serial: hw, pairing_token: tok }),
      });
      if (!reg.ok) {
        toast.error(await reg.text());
        return;
      }
      const { bridge_jwt: bridgeJwt } = (await reg.json()) as { bridge_jwt?: string };
      if (!bridgeJwt) {
        toast.error("Register response missing bridge_jwt.");
        return;
      }

      const { data: cam } = await supabase
        .from("patient_cameras")
        .select("rtsp_url_sub, rtsp_url")
        .eq("patient_id", patientId)
        .maybeSingle();
      const rtsp = (cam?.rtsp_url_sub || cam?.rtsp_url || "").trim();
      if (!rtsp.startsWith("rtsp://")) {
        toast.error("Save your RTSP URLs in Connect Camera first.");
        return;
      }

      const ice_json = await pairingIceJson();
      const res = await fetch(`${provisionBase}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wifi_ssid: wifiSSID.trim(),
          wifi_psk: wifiPSK.trim(),
          patient_id: patientId,
          bridge_jwt: bridgeJwt,
          sfu_origin: sfu,
          rtsp_url: rtsp,
          ice_json,
        }),
      });
      const bodyText = await res.text().catch(() => "");
      if (!res.ok) {
        toast.error(bodyText || `Pi setup failed (${res.status})`);
        return;
      }
      await supabase
        .from("patient_cameras")
        .update({
          bridge_type: "pi_box",
          bridge_id: hw,
          updated_at: new Date().toISOString(),
        })
        .eq("patient_id", patientId);

      toast.success("Pi captured credentials. Power-cycle the Pi to join Wi-Fi and push video.");
      navigate("/live-monitoring");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Network error talking to Pi.");
    }
  };

  if (loading || !patientId) {
    return (
      <MobileAppContainer>
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading…</div>
      </MobileAppContainer>
    );
  }

  return (
    <MobileAppContainer>
      <div className="min-h-screen bg-slate-950 text-white pt-safe-top px-4 pb-8">
        <div className="flex items-center gap-3 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/live-monitoring")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Router className="w-5 h-5 text-amber-300" /> Pair Raspberry Pi Kit
            </h1>
            <p className="text-xs text-slate-400">Join the hotspot, then mint a bridge JWT and push Wi-Fi credentials.</p>
          </div>
        </div>

        {!sfuConfigured && (
          <p className="text-xs text-amber-200 mb-3">Configure VITE_CAMERA_SFU_URL so register + pairing work.</p>
        )}

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 space-y-3 text-xs">
          <p className="text-slate-300">
            1. Power the Pi hotspot (SSID usually <code className="text-white">MONITRAQ-SETUP</code>) and join it from{" "}
            {isNativeNote ? "this phone." : "a device on that network."}
          </p>
          <label className="block space-y-1">
            <span className="text-slate-400">Sticker hardware serial</span>
            <input
              value={hwSerial}
              onChange={(e) => setHwSerial(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
              placeholder="e.g. mq-pi-xxxx"
              autoCapitalize="off"
              autoCorrect="off"
            />
          </label>
          <Button type="button" className="w-full" variant="secondary" disabled={!canGenerateToken} onClick={() => void generatePairToken()}>
            Mint pairing token in Supabase
          </Button>
          {pairToken && (
            <p className="text-[11px] text-emerald-200 break-all font-mono">Token ready (keep private): {pairToken}</p>
          )}

          <label className="block space-y-1">
            <span className="text-slate-400">Wi-Fi SSID Pi should join (<em>usually your home net</em>)</span>
            <input
              value={wifiSSID}
              onChange={(e) => setWifiSSID(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
              placeholder="MyHomeWiFi"
              autoCapitalize="off"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-slate-400">Wi-Fi password</span>
            <input
              type="password"
              value={wifiPSK}
              onChange={(e) => setWifiPSK(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
              placeholder="••••••••"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-slate-400">Provisioning origin</span>
            <input
              value={provisionBase}
              readOnly
              className="w-full rounded-lg bg-black/20 border border-dashed border-white/10 px-3 py-2 text-[11px] text-slate-400"
            />
          </label>

          <Button type="button" className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50" disabled={!pairToken} onClick={() => void sendToPi()}>
            Send credentials to Pi
          </Button>
          <p className="text-slate-500 text-[11px]">
            Calls <code>http://192.168.42.1:8888/setup</code> unless you override with VITE_PI_PROVISION_ORIGIN. Android cleartext to that LAN IP is permitted.
          </p>
        </div>
      </div>
    </MobileAppContainer>
  );
}
