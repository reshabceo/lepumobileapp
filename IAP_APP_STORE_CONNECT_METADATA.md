# App Store Connect — IAP Metadata (v2)

Copy each field into **App Store Connect → Monetization → In-App Purchases** (consumables) or **Subscriptions**.

**Type:** All AI Doctor products = **Consumable**. Monitraq+ = **Auto-Renewable Subscription** (same subscription group).

**Pricing (India):** Set tier to match list price below.

---

## 1. AI Doctor Text — ₹129

| Field | Text |
|-------|------|
| **Product ID** | `com.monitraq.iap.ai.text.129_v2` |
| **Reference Name** | Monitraq AI Doctor Text 129 v2 |
| **Display Name** | AI Doctor Text Session |
| **Description** | Unlock one 24-hour AI Doctor text consultation in Monitraq. Chat with Dr. MonitraQ about symptoms, upload reports, and receive AI health guidance. This is a one-time consumable purchase; not a substitute for professional medical care. AI Doctor appointments with a human doctor are paid separately via Razorpay. |

---

## 2. AI Doctor Voice — ₹129

| Field | Text |
|-------|------|
| **Product ID** | `com.monitraq.iap.ai.voice.129_v2` |
| **Reference Name** | Monitraq AI Doctor Voice 129 v2 |
| **Display Name** | AI Doctor Voice Session |
| **Description** | Unlock one 24-hour AI Doctor voice consultation in Monitraq. Speak with Dr. MonitraQ and hear AI health guidance. One-time consumable purchase. Not a substitute for professional medical care. Human doctor visits are paid separately via Razorpay. |

---

## 3. AI Doctor Text — ₹175 (Premium tier)

| Field | Text |
|-------|------|
| **Product ID** | `com.monitraq.iap.ai.text.175_v2` |
| **Reference Name** | Monitraq AI Doctor Text 175 v2 |
| **Display Name** | AI Doctor Text Premium |
| **Description** | Unlock one 24-hour AI Doctor text consultation at the premium price tier. Includes chat with Dr. MonitraQ, symptom review, and file uploads. One-time consumable. For informational use only; not medical diagnosis or treatment. |

---

## 4. AI Doctor Voice — ₹175 (Premium tier)

| Field | Text |
|-------|------|
| **Product ID** | `com.monitraq.iap.ai.voice.175_v2` |
| **Reference Name** | Monitraq AI Doctor Voice 175 v2 |
| **Display Name** | AI Doctor Voice Premium |
| **Description** | Unlock one 24-hour AI Doctor voice consultation at the premium price tier. Speak with Dr. MonitraQ with voice replies. One-time consumable. For informational use only; not medical diagnosis or treatment. |

---

## 5. Monitraq+ Monthly

| Field | Text |
|-------|------|
| **Product ID** | `com.monitraq.subscription.monitraq_plus_monthly_v2` |
| **Reference Name** | Monitraq Plus Monthly v2 |
| **Display Name** | Monitraq+ Monthly |
| **Subscription Duration** | 1 month |
| **Description** | Monitraq+ premium membership — billed monthly, auto-renewable. Includes: live vitals and ECG history, AI-generated weekly health reports, secure chat with your assigned doctor, live home camera monitoring, prescriptions and medication reminders, and insurance claims and invoices. AI Doctor sessions and human doctor appointments are separate paid features. Cancel anytime in Apple ID Subscriptions; access continues until period end. |

---

## 6. Monitraq+ Quarterly

| Field | Text |
|-------|------|
| **Product ID** | `com.monitraq.subscription.monitraq_plus_quarterly_v2` |
| **Reference Name** | Monitraq Plus Quarterly v2 |
| **Display Name** | Monitraq+ Quarterly |
| **Subscription Duration** | 3 months |
| **Description** | Monitraq+ premium membership — billed every 3 months, auto-renewable. Same benefits as monthly: vitals/ECG history, weekly AI reports, doctor chat, home monitoring, prescriptions, and insurance tools. AI Doctor and human doctor services are purchased separately. Cancel anytime; access until period end. |

---

## App Review Notes (paste in App Review Information)

```
Monitraq iOS payment model (v2 IAP products):

IN-APP PURCHASE (test with Sandbox Apple ID):
• Monitraq+ — Profile → Upgrade plan → Subscribe with Apple
• AI Doctor Text — Health AI tab → Text Consultation → Pay & Start
• AI Doctor Voice — Health AI tab → Voice Consultation → Pay & Start

NOT IAP (uses Razorpay in-app on iOS — do not test as IAP):
• Doctor appointments — Services → Book Appointment
• Emergency — Home → Emergency
• Radiologist review — Services → Reports → Request radiologist

AI Doctor: User sees Health AI data-sharing consent before first use (Google Med-Gemini). 
Consumables unlock 24-hour AI consult access. Subscriptions unlock Monitraq+ monitoring features.

Demo account: [EMAIL] / [PASSWORD]
```

---

## Subscription group (suggested)

| Field | Value |
|-------|--------|
| **Subscription Group Reference Name** | Monitraq Plus |
| **Group Display Name** | Monitraq+ |

Place both monthly and quarterly products in the **same** subscription group.
