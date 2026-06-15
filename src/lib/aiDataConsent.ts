const CONSENT_KEY = 'monitraq_ai_data_sharing_consent_v1';

export function hasAIDataSharingConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CONSENT_KEY) === 'granted';
}

export function grantAIDataSharingConsent(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONSENT_KEY, 'granted');
}

export function revokeAIDataSharingConsent(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CONSENT_KEY);
}
