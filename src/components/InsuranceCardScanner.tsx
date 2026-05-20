/**
 * InsuranceCardScanner.tsx
 *
 * Lets the patient photograph their insurance card (front/back).
 * Sends the image to the insurance-card-ocr edge function (Gemini Vision).
 * Returns extracted fields to the parent so it can auto-fill the form.
 */

import React, { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, Loader2, CheckCircle2, X, ScanLine } from 'lucide-react';

export interface ScannedInsuranceData {
  policyNumber:    string | null;
  providerName:    string | null;
  memberName:      string | null;
  memberId:        string | null;
  groupNumber:     string | null;
  planName:        string | null;
  planType:        string | null;
  effectiveDate:   string | null;
  expirationDate:  string | null;
  cashlessEnabled: boolean | null;
  tpaName:         string | null;
  emergencyPhone:  string | null;
  confidence:      'high' | 'medium' | 'low' | null;
}

interface Props {
  onScanned: (data: ScannedInsuranceData) => void;
  onCancel?: () => void;
}

export const InsuranceCardScanner = ({ onScanned, onCancel }: Props) => {
  const { toast } = useToast();
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview,   setPreview]   = useState<string | null>(null);
  const [scanning,  setScanning]  = useState(false);
  const [scanned,   setScanned]   = useState<ScannedInsuranceData | null>(null);

  const processImage = async (file: File) => {
    // Show preview
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setScanning(true);
    try {
      // Convert to base64 (strip data URI prefix)
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const result = r.result as string;
          resolve(result.split(',')[1]); // strip "data:image/jpeg;base64,"
        };
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      const mimeType = file.type || 'image/jpeg';

      const { data, error } = await supabase.functions.invoke('insurance-card-ocr', {
        body: { imageBase64: base64, mimeType },
      });

      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error ?? 'OCR failed');

      const result = data.data as ScannedInsuranceData;
      setScanned(result);

      const confidence = result.confidence ?? 'low';
      toast({
        title: confidence === 'high' ? '✓ Card scanned successfully' : 'Card scanned — please verify',
        description: confidence === 'low'
          ? 'Low confidence — image may be blurry. Please check the extracted fields.'
          : `Extracted: ${[result.policyNumber, result.providerName].filter(Boolean).join(' · ')}`,
        variant: confidence === 'low' ? 'destructive' : 'default',
      });
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const handleUseData = () => {
    if (scanned) onScanned(scanned);
  };

  const reset = () => {
    setPreview(null);
    setScanned(null);
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ScanLine className="h-4 w-4 text-primary" />
          Scan Insurance Card
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {!preview ? (
          <>
            <p className="text-sm text-muted-foreground text-center">
              Take a photo of your insurance card or upload an image.<br />
              We'll extract the details automatically.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* Camera capture */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-2 border-2 border-dashed border-border rounded-xl p-5 hover:bg-muted/50 transition-colors active:scale-95"
              >
                <Camera className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium">Take Photo</span>
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* File upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 border-2 border-dashed border-border rounded-xl p-5 hover:bg-muted/50 transition-colors active:scale-95"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">Upload Image</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <p className="text-[10px] text-center text-muted-foreground">
              Supports JPEG, PNG, WebP · Front or back of card
            </p>
          </>
        ) : (
          <div className="space-y-3">
            {/* Preview */}
            <div className="relative rounded-lg overflow-hidden border">
              <img src={preview} alt="Insurance card" className="w-full object-contain max-h-48" />
              {scanning && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                  <p className="text-white text-sm font-medium">Scanning card…</p>
                </div>
              )}
            </div>

            {/* Extracted data */}
            {scanned && !scanning && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Extracted Data
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                    scanned.confidence === 'high'   ? 'bg-green-100 text-green-700' :
                    scanned.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                      'bg-red-100 text-red-700'
                  }`}>
                    {scanned.confidence ?? 'low'} confidence
                  </span>
                </div>

                <div className="rounded-lg border divide-y text-sm">
                  {[
                    ['Policy No.',   scanned.policyNumber],
                    ['Provider',     scanned.providerName],
                    ['Member Name',  scanned.memberName],
                    ['Plan',         scanned.planName],
                    ['Group No.',    scanned.groupNumber],
                    ['Valid From',   scanned.effectiveDate],
                    ['Expires',      scanned.expirationDate],
                    ['TPA',          scanned.tpaName],
                    ['Cashless',     scanned.cashlessEnabled != null ? (scanned.cashlessEnabled ? 'Yes' : 'No') : null],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string} className="flex items-center justify-between px-3 py-2">
                      <span className="text-muted-foreground text-xs">{label}</span>
                      <span className="font-medium text-xs text-right max-w-[60%]">{value as string}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={reset} className="flex-1">
                    Rescan
                  </Button>
                  <Button size="sm" onClick={handleUseData} className="flex-1">
                    Use This Data
                  </Button>
                </div>
              </div>
            )}

            {!scanned && !scanning && (
              <Button variant="outline" size="sm" className="w-full" onClick={reset}>
                Try Again
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
