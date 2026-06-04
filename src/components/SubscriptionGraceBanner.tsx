import { useLocation, useNavigate } from "react-router-dom";
import { Crown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";

/**
 * Site-wide banner shown when a patient's Monitraq+ subscription has just
 * expired AND they're inside the 24h grace window. After grace ends they're
 * back to free tier and `<RequiresPaid>` takes over with the upgrade card.
 *
 * Hidden on routes where it would conflict with the UI:
 *   /subscription (the banner would duplicate the page's own state)
 *   /call/* + /reset-password + landing (full-screen surfaces)
 *
 * Dismissible per-session (sessionStorage). Won't pester the patient on every
 * navigation if they tap X — but will come back next app open.
 */
const HIDE_PATHS = ["/", "/subscription", "/reset-password"];

function isHiddenPath(pathname: string): boolean {
  if (HIDE_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/call/")) return true;
  if (pathname.startsWith("/radiologist")) return true;
  return false;
}

function fmt(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function SubscriptionGraceBanner() {
  const { isInGrace, graceUntil, planCode } = useSubscriptionTier();
  const location = useLocation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem("monitraq_grace_dismissed") === "1"; }
    catch { return false; }
  });

  // Reset dismissal whenever grace flips back off (e.g. patient renewed)
  useEffect(() => {
    if (!isInGrace && dismissed) {
      try { sessionStorage.removeItem("monitraq_grace_dismissed"); } catch { /* noop */ }
      setDismissed(false);
    }
  }, [isInGrace, dismissed]);

  if (!isInGrace || dismissed) return null;
  if (isHiddenPath(location.pathname)) return null;

  const expiresAt = graceUntil ? new Date(graceUntil) : null;
  const planLabel = planCode === "monitraq_plus_quarterly" ? "Monitraq+ Quarterly" : "Monitraq+";

  return (
    <div className="sticky top-0 z-40 w-full bg-gradient-to-r from-amber-500/95 to-amber-600/95 backdrop-blur shadow-lg">
      <div className="max-w-screen-md mx-auto flex items-center gap-3 px-4 py-2.5">
        <Crown className="h-4 w-4 text-amber-100 shrink-0" />
        <div className="flex-1 min-w-0 text-[13px] leading-tight text-amber-50">
          <p className="font-semibold">{planLabel} renewal pending</p>
          <p className="text-[11px] text-amber-100/90 truncate">
            Access ends {expiresAt ? fmt(expiresAt) : "soon"} unless you renew.
          </p>
        </div>
        <button
          onClick={() => navigate("/subscription")}
          className="shrink-0 text-[12px] font-semibold bg-white text-amber-700 px-3 py-1.5 rounded-md hover:bg-amber-50"
        >
          Renew
        </button>
        <button
          onClick={() => {
            try { sessionStorage.setItem("monitraq_grace_dismissed", "1"); } catch { /* noop */ }
            setDismissed(true);
          }}
          aria-label="Dismiss"
          className="shrink-0 text-amber-100 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default SubscriptionGraceBanner;
