import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

interface Props {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function AIDataSharingConsentDialog({ open, onAccept, onDecline }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onDecline(); }}>
      <DialogContent
        className="bg-[#101B34] border border-emerald-400/30 text-white rounded-2xl max-w-md w-[calc(100vw-2rem)] max-h-[min(85dvh,680px)] flex flex-col gap-0 p-0 overflow-hidden left-[50%] top-[max(1rem,env(safe-area-inset-top))] translate-x-[-50%] translate-y-0 sm:top-[50%] sm:translate-y-[-50%] sm:max-h-[min(90dvh,720px)]"
        aria-describedby="ai-consent-body"
      >
        <DialogHeader className="shrink-0 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 text-left space-y-2">
          <div className="flex items-center gap-2 text-emerald-300">
            <Shield className="h-5 w-5 shrink-0" />
            <DialogTitle className="text-emerald-100">Health AI data sharing</DialogTitle>
          </div>
        </DialogHeader>

        <div
          id="ai-consent-body"
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-3 text-slate-200 text-sm space-y-3"
        >
          <p>
            Before you use Dr. MonitraQ (Health AI), please review what information is sent and who receives it.
          </p>
          <div className="rounded-xl border border-slate-700/60 bg-[#0B1428] p-3 space-y-2">
            <p className="font-semibold text-white">Third-party AI provider</p>
            <p>
              Your health-related inputs are processed by{' '}
              <span className="text-emerald-300 font-medium">Google Med-Gemini 2.5 Flash</span>{' '}
              (Google Cloud / Google LLC) via Monitraq&apos;s secure backend.
            </p>
            <p className="font-semibold text-white pt-1">Data that may be sent</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>Symptoms and messages you type or speak</li>
              <li>Age, sex, medications, and medical history from your profile</li>
              <li>Medical files you attach (e.g. lab reports, X-rays, PDFs)</li>
              <li>Prior AI consultation summaries stored in Monitraq</li>
              <li>Voice audio recordings during voice consult mode</li>
            </ul>
            <p className="font-semibold text-white pt-1">How it is used</p>
            <p className="text-slate-300">
              This data is used only to generate AI health guidance for your session. It is not sold to advertisers.
              See our Privacy Policy for retention and your rights.
            </p>
          </div>
          <p className="text-xs text-slate-400 pb-1">
            Dr. MonitraQ is not a substitute for professional medical care. In an emergency, call local emergency services.
          </p>
        </div>

        <DialogFooter className="shrink-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 border-t border-slate-700/50 flex-col gap-2 sm:flex-col">
          <Button
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
            onClick={onAccept}
          >
            I agree — continue to Health AI
          </Button>
          <Button
            variant="outline"
            className="w-full border-white/25 bg-slate-900/45 text-white hover:bg-slate-800"
            onClick={onDecline}
          >
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
