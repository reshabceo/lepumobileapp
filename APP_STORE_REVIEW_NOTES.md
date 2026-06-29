# App Store Review Notes — Monitraq

Copy the text below into **App Store Connect → Your App → App Review Information → Notes**.

Replace `[BRACKETS]` with your details before submitting.

---

Dear App Review Team,

Thank you for your continued review of Monitraq. We have addressed all outstanding rejection points in this submission.

**App:** Monitraq  
**Bundle ID:** com.monitraq.mobile  
**Version:** [VERSION NUMBER]  
**Build:** [BUILD NUMBER]

**Device support:** **iPhone only** — not a Universal iPad app.  
`TARGETED_DEVICE_FAMILY = 1`, `UIDeviceFamily = 1` in Info.plist.  
**Please review on iPhone.** The app is not designed for native iPad layout. If opened in iPhone compatibility mode on iPad, UI is scaled from the iPhone layout.

**Territories:** **United States** and **India** only (Pricing and Availability in App Store Connect).

**Healthcare provider:** Monitraq is operated by **[YOUR COMPANY LEGAL NAME]** ([support@monitraq.com]). The app connects patients with licensed physicians on the Monitraq platform for remote monitoring, appointments, and prescriptions.

**Bottom navigation tabs:** Home · Services · Health AI · Profile

---

## Response to Guideline 4 — Design (iPhone-only / AI disclosure)

**Issue:** AI disclosure content appeared cut off on iPad.

**Changes made:**

1. **iPhone-only binary:** Xcode `TARGETED_DEVICE_FAMILY = 1`; `UIDeviceFamily = 1` in Info.plist; no iPad orientation keys.
2. **AI consent dialog:** Repositioned from vertical center to top-anchored layout with `safe-area-inset` padding, scrollable body, and fixed footer buttons so title, full disclosure text, and **I agree** / **Not now** are always visible on all iPhone sizes (and in iPhone compatibility mode on iPad).
3. **`UIRequiresFullScreen`:** Enabled.

**How to verify:**

1. Review on **iPhone** (recommended).
2. **Health AI** tab → **Pay & Start** (text or voice).
3. **Health AI data sharing** dialog: all text and both buttons visible; scroll if needed.

**App Store Connect:** Set **Devices = iPhone** (not Universal). Do not upload iPad-specific screenshots.

---

## Response to Guideline 3.1.1 — In-App Purchase

**Issue:** Health AI and Monitraq+ Plan could be purchased via non-IAP mechanisms.

**Changes made:**

All **digital subscriptions and Health AI sessions on iOS** now use **Apple In-App Purchase only**. Razorpay is used on iOS **only** for real-world human services (doctor appointments, emergency consults, radiologist report review) — not for digital content.

### IAP products (configured in App Store Connect)

| Product | Product ID | Type |
|---------|------------|------|
| Monitraq+ Monthly | `com.monitraq.subscription.monitraq_plus_monthly_v2` | Auto-renewable subscription |
| Monitraq+ Quarterly | `com.monitraq.subscription.monitraq_plus_quarterly_v2` | Auto-renewable subscription |
| AI Doctor Text (₹129 tier) | `com.monitraq.iap.ai.text.129_v2` | Consumable |
| AI Doctor Voice (₹129 tier) | `com.monitraq.iap.ai.voice.129_v2` | Consumable |
| AI Doctor Text (₹175 tier) | `com.monitraq.iap.ai.text.175_v2` | Consumable |
| AI Doctor Voice (₹175 tier) | `com.monitraq.iap.ai.voice.175_v2` | Consumable |

Legacy v1 IAP products have been removed from sale.

### Where to test IAP on iPhone

| Feature | Path | Payment |
|---------|------|---------|
| **Monitraq+ subscription** | **Profile** → **Upgrade plan** → select plan → **Upgrade to Monitraq+** | **Apple IAP** (StoreKit sheet) |
| **Health AI — text** | **Health AI** tab → **Text Consultation** → consent → **Pay & Start** | **Apple IAP** |
| **Health AI — voice** | **Health AI** tab → **Voice Consultation** → consent → **Pay & Start** | **Apple IAP** |
| Doctor appointment | **Services** → **Book Appointment** → **Pay & Book** | Razorpay (human service) |
| Emergency consult | **Home** → **Emergency** | Razorpay (human service) |
| Radiologist review | **Services** → **Reports** → **Request radiologist** | Razorpay (human service) |

**Sandbox testing:** Use a Sandbox Apple ID. IAP screen recording attached in Resolution Center / App Review attachments.

**In-app copy on iOS:** Subscription and Health AI screens state payments are processed via **Apple In-App Purchase**.

---

## Response to Guideline 1.4.1 — Medical citations

**Issue:** Medical information in Profile without citations.

**Changes made:**

1. **Profile → Vital High Risk Thresholds:** Added **Sources & References** section with links to:
   - American Heart Association (blood pressure, heart rate)
   - WHO (pulse oximetry / SpO2)
2. Clear labeling: thresholds are **doctor-configured alert limits** or **defaults until doctor sets custom values** — not medical advice.
3. **Support → Medical Disclaimer:** Expanded with device regulatory information (AliveCor, Wellue BP2, O2 Ring), jurisdiction (US + India), and full citation list.

**How to verify:**

1. **Profile** tab → scroll to **Vital High Risk Thresholds** → **Sources & References**.
2. **Support & Help** → **Medical Disclaimer** → device clearance and citation sections.

---

## Response to Guideline 1.4.1 — Medical hardware documentation

**Issue:** Regulatory clearance documentation for connected medical hardware.

**Changes made:**

1. App distribution restricted to **United States** and **India** where we hold applicable device documentation.
2. In-app **Medical Disclaimer** lists supported devices: **AliveCor KardiaMobile 6L**, **Wellue BP2**, **Wellue O2 Ring**, with manufacturer links and intended-use statements.
3. Regulatory clearance documents (FDA / CDSCO / manufacturer IFU as applicable) for **AliveCor**, **BP2**, and **O2 Ring** are attached in the Resolution Center with this submission.

---

## Response to Guideline 2.1 — Information Needed

**Question:** What is your relationship with Dr. John Smith?

**Answer:** **Dr. John Smith was a placeholder/test doctor record used during internal development and QA.** It is **not** a real healthcare provider on the Monitraq platform. We have removed all test doctor references from the production app UI and updated the App Review demo account to use a **real licensed physician** assigned through our platform.

**Question:** Which healthcare company provides this medical service?

**Answer:** Monitraq is provided by **[YOUR COMPANY LEGAL NAME]** (registered in [India/US]). The app is a patient-facing remote monitoring platform. Licensed physicians on the Monitraq network provide clinical oversight, appointments, and prescriptions. Monitraq does not replace in-person emergency care.

**Demo account for review:**

| Field | Value |
|-------|--------|
| Email | [REVIEW_DEMO_EMAIL@example.com] |
| Password | [ReviewDemoPassword123] |
| Assigned doctor | [REAL DOCTOR NAME — not a test account] |

---

## Response to Guidelines 5.1.1(i) and 5.1.2(i) — AI data sharing

On **iOS**, mandatory **Health AI data sharing** consent appears **before** any data is sent to Google Med-Gemini 2.5 Flash. User must tap **I agree — continue to Health AI** or **Not now** blocks the feature.

**Verify:** **Health AI** → **Pay & Start** → consent dialog before payment or chat.

---

## Suggested review path (~10 minutes)

| Step | Where | Confirm |
|------|-------|---------|
| 1 | Log in (iPhone) | Demo account works |
| 2 | **Profile** → Vital thresholds | Citations visible |
| 3 | **Support** → **Medical Disclaimer** | Device clearance + jurisdiction |
| 4 | **Health AI** → Pay & Start | Consent dialog fully visible |
| 5 | **Health AI** → Pay & Start | **Apple IAP** sheet (not Razorpay) |
| 6 | **Profile** → Upgrade plan | **Apple IAP** for Monitraq+ |
| 7 | **Services** → Book Appointment | Razorpay for human appointment (optional) |

---

## Attachments for this submission

- [ ] IAP Sandbox test screen recording (Monitraq+ + Health AI)
- [ ] AliveCor regulatory documentation (US / India)
- [ ] Wellue BP2 regulatory documentation (US / India)
- [ ] Wellue O2 Ring regulatory documentation (US / India)

---

If you need additional documentation or Sandbox test support, contact us via the Resolution Center or at **support@monitraq.com**.

Thank you for your time and consideration.

Monitraq Team
