# App Store Review Notes — Monitraq

Copy the text below into **App Store Connect → Your App → App Review Information → Notes**.

Replace `[BRACKETS]` with your details before submitting.

---

Dear App Review Team,

Thank you for your previous feedback on Monitraq. We have addressed all three rejection points in this submission. Below are our responses, **step-by-step navigation for each paid feature**, and verification steps.

**App:** Monitraq  
**Bundle ID:** com.monitraq.mobile  
**Version:** [VERSION NUMBER]  
**Build:** [BUILD NUMBER]

**Bottom navigation tabs:** Home · Services · Health AI · Profile

---

## Response to Guideline 1.4.1 — Safety — Physical Harm

**Issue addressed:** Medical hardware jurisdiction and regulatory clearance.

**Changes made:**

1. **Territory restriction:** Monitraq is available for download only in **India** and the **United States** (App Store Connect → Pricing and Availability).

2. **In-app jurisdiction statement:** **Support → Medical Disclaimer** → section **“Jurisdiction & Device Clearance”**.

3. **Supporting documentation:** Regulatory/clarification documentation for **India** and the **United States** is available on request via the Resolution Center.

**How to verify (location guide):**

1. Sign in with the demo account.
2. Open **Privacy Policy** (in-app; also listed in App Store Connect metadata).
3. Scroll to the footer → tap **Support & Help**.
4. On the Support screen → tap **Medical Disclaimer**.
5. Read **“Jurisdiction & Device Clearance”**.

---

## Response to Guideline 2.1(b) — Performance — App Completeness (In-App Purchase)

**Issue addressed:** In-App Purchase errors when purchasing premium features.

**Changes made:**

1. **Apple In-App Purchase (IAP) is not used** in this build. All iOS payments use **Razorpay**.
2. **Legacy IAP products removed from sale** in App Store Connect.
3. In-app copy states: *“Payments are processed securely via Razorpay.”*

**Important:** Please **do not test In-App Purchase**. No IAP flow exists in this app.

---

## Where to find each payment (Razorpay) — location guides

All payments open the **Razorpay checkout modal in-app** (not the Apple payment sheet). You may dismiss checkout to confirm there is no IAP error; completing payment is optional for review.

### 1. Monitraq+ subscription

**Path:** **Profile** tab → **Upgrade plan** (or **Manage plan**) → select **Monthly** or **Quarterly** plan → tap **Upgrade to Monitraq+** → Razorpay checkout opens.

**Alternate path:** **Services** tab → tap **Upgrade to Monitraq+** banner (if shown on Free tier) → same subscription screen → select plan → **Upgrade to Monitraq+**.

---

### 2. AI Doctor — text consultation (pay per session)

**Path:** **Health AI** tab → **Text Consultation** card → tap **Pay & Start** → (on iOS) **Health AI data sharing** consent dialog → tap **I agree — continue to Health AI** → Razorpay checkout opens.

---

### 3. AI Doctor — voice consultation (pay per session)

**Path:** **Health AI** tab → **Voice Consultation** card → tap **Pay & Start** → (on iOS) consent dialog → **I agree — continue to Health AI** → Razorpay checkout opens.

---

### 4. Doctor appointment (video or audio)

**Path:** **Services** tab → **Book Appointment** → choose **Video** or **Audio** call mode → select date and time slot → enter reason for visit → tap **Pay & Book** → Razorpay checkout opens.

**Note:** If the assigned doctor is unavailable, the app may offer an alternative doctor → tap **Pay & Book Now** or **Pay & Book Next Available** → Razorpay checkout opens.

---

### 5. Emergency consultation

**Path:** **Home** tab → tap red **Emergency** button → confirm **Trigger Emergency Alert?** → if payment is required, Razorpay checkout opens.

**Note:** If no doctor is assigned, the app shows available emergency doctors → select a doctor → confirm booking → Razorpay checkout opens.

---

### 6. Radiologist report review

**Path:** **Services** tab → **Reports** → open the **DICOM / imaging studies** section → on a study, tap **Request radiologist** → select a radiologist and fill in the request form → tap **Pay & Request** → Razorpay checkout opens.

---

## Response to Guidelines 5.1.1(i) and 5.1.2(i) — Privacy — Third-Party AI Data Sharing

**Issue addressed:** Personal data shared with a third-party AI service without clear disclosure and consent.

**Changes made:** On **iOS**, a mandatory **“Health AI data sharing”** dialog appears **before** any Health AI data is sent. User must tap **“I agree — continue to Health AI”**. **“Not now”** blocks the feature.

**The dialog discloses:**

| Requirement | What the app shows |
|-------------|-------------------|
| Who receives data | **Google Med-Gemini 2.5 Flash** (Google Cloud / Google LLC), via Monitraq’s secure backend |
| What data is sent | Symptoms/messages, age, sex, medications, medical history, attached medical files, prior AI summaries, voice recordings (voice mode) |
| Purpose | AI health guidance for the session only; not sold to advertisers |
| Privacy Policy | Referenced in the dialog; full policy in App Store Connect and in-app |

**How to verify (location guide):**

1. Sign in on **iOS/iPadOS** with the demo account.
2. **Health AI** tab → tap **Pay & Start**, try to send a message, or start voice recording.
3. **Health AI data sharing** dialog appears **before** any data is transmitted.
4. Tap **Not now** → AI remains blocked.
5. Tap **I agree — continue to Health AI** → feature proceeds to payment or chat.
6. Review **Privacy Policy** (App Store Connect URL and in-app Privacy Policy screen).

---

## Demo account for review

| Field | Value |
|-------|--------|
| Email | [REVIEW_DEMO_EMAIL@example.com] |
| Password | [ReviewDemoPassword123] |

**Razorpay:** Opening the Razorpay checkout modal is sufficient to verify payments. Completing payment is optional. [Add test card/UPI details here if you want reviewers to complete a transaction.]

---

## Suggested review path (~10 minutes)

| Step | Where to go | What to confirm |
|------|-------------|-----------------|
| 1 | Log in | Demo account works |
| 2 | Privacy Policy → Support → **Medical Disclaimer** | Jurisdiction & device clearance (Guideline 1.4.1) |
| 3 | **Health AI** → Pay & Start | Consent dialog, then Razorpay — no IAP (Guidelines 5.1.1 / 2.1(b)) |
| 4 | **Profile** → Upgrade plan | Monitraq+ Razorpay checkout |
| 5 | **Services** → Book Appointment | Appointment Razorpay checkout |
| 6 | **Home** → Emergency | Emergency Razorpay checkout (optional) |
| 7 | **Services** → Reports → Request radiologist | Radiologist Razorpay checkout (optional) |

---

## Contact

If you need India/US medical device documentation, Razorpay test credentials, or additional information, contact us via the Resolution Center or at **support@monitraq.com**.

Thank you for your time and consideration.

Monitraq Team
