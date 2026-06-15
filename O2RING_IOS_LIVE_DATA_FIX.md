# O2Ring Live Data on iOS — Root Cause & Fix

This document explains why the O2Ring (Wellue/Viatom pulse oximeter) connected on iOS but
never showed live data, and exactly how it was fixed. All native changes live in
`ios/App/App/WellueSDKPlugin.swift`.

---

## 1. Symptoms

The app connected to the O2Ring successfully, but the UI was stuck in one of two states:

- **"Connecting & Establishing Stream…"** — no data ever arrived.
- **"Finger Out, Waiting for sensor input"** — even while the ring was worn and clearly
  showing valid SpO₂/HR on its own display.

The logs showed an endless, destructive loop:

```
⏰ [RT TIMER] O2Ring poll tick – woxi_requestWOxiRealData() (A5 protocol)
⚠️ [HEALTH] SDK TIMEOUT! No data for 15 seconds
🔄 [HEALTH] Marking SDK as not deployed, forcing re-deployment...
🎉 [VIATOM SDK] DEPLOYMENT COMPLETED!
... (repeat forever)
```

Crucially, there were **zero** `📥 [BLE DATA]` / `🧬 [O2 FRAME]` lines — meaning the device
was not sending real-time frames at all.

---

## 2. Background: how this device actually talks

The Viatom SDK (`VTMProductLib` / `VTO2Communicate`) supports two wire protocols:

| Protocol | Trigger method                  | Frame header |
|----------|---------------------------------|--------------|
| **AA** (legacy) | `beginGetRealData()`     | `0xAA`       |
| **A5** (newer)  | `woxi_requestWOxiRealData()` | `0xA5`   |

This particular **O2Ring 1434** unit does **neither** cleanly:

- It only starts emitting real-time data after `beginGetRealData()` is sent.
- But it replies with a **`0x55`-header, 21-byte frame** that **neither** the AA parser **nor**
  the A5 parser in the SDK can decode. The SDK rejects it with
  `CMD FAILED: cmdType=0xCC` (`VTA5RespHeadError`).

So the SDK can *prompt* the device but can never *parse* its reply.

---

## 3. The two root causes

### Cause A — Wrong trigger command (no data at all)

An earlier change had **removed `beginGetRealData()`** and relied solely on
`woxi_requestWOxiRealData()`, on the theory that the AA command was "poisoning" the stream.

That theory was wrong. Empirically:

- **With `beginGetRealData()`** → `0x55` frames arrive (real SpO₂/PR bytes present).
- **With `woxi_requestWOxiRealData()` only** → nothing arrives, watchdog times out forever.

`beginGetRealData()` is the *only* command that makes this device stream. Removing it killed
all data — that was the "stuck on Connecting" regression.

### Cause B — SDK command queue stalls after the first frame

Even when `beginGetRealData()` was present, the device streamed **only one frame per deploy**,
then went silent until the health watchdog re-deployed the SDK (~every 13–15 s).

Why: `beginGetRealData()` enqueues a command into the SDK's internal `aa_cmdArr` queue and
waits for a valid completion to dequeue it. The device's reply is the un-parseable `0x55`
frame → `commandFailed 0xCC` → the command **never completes** → the queue stays blocked →
every subsequent request is silently dropped until a full re-deploy resets the queue.

That is why data only "refreshed" once per noisy re-deploy cycle, and why the watchdog churned.

### Cause C (already fixed earlier) — Wrong byte offsets → "Finger Out"

The `0x55` frame was initially parsed with incorrect offsets, so valid readings were
misread as "finger out." The offsets were corrected against the live stream (see §5).

---

## 4. The fix

Because the SDK cannot parse the device's frames, the plugin **self-parses** the raw BLE
notification stream and emits its own normalized `o2RingRt` event. Two things were needed to
make data flow *continuously*:

### 4.1 Restore the correct trigger + unblock the queue every tick

In `startO2RingPollingTimer()` (fires every 2 s):

```swift
if let o2Comm = self.viatomUtils as? VTO2Communicate {
    // The device's 0x55 reply fails the SDK parser (commandFailed 0xCC), so the prior AA
    // command never "completes" and aa_cmdArr stays blocked. Clearing it each tick lets
    // beginGetRealData() re-fire continuously — we parse the reply ourselves anyway.
    if let cmdArr = o2Comm.value(forKey: "aa_cmdArr") as? NSMutableArray, cmdArr.count > 0 {
        cmdArr.removeAllObjects()
    }
    o2Comm.beginGetRealData()          // proven trigger for this device
    self.viatomUtils?.woxi_requestWOxiRealData()  // harmless A5 nudge, kept for safety
}
```

- **`beginGetRealData()`** is restored — it is what makes the device stream.
- **`aa_cmdArr.removeAllObjects()`** clears the stuck command so the next request is actually
  sent, giving a fresh `0x55` frame every 2 s **without** depending on the heavy re-deploy
  cycle. It is guarded by `as? NSMutableArray` + `count > 0` to avoid touching SDK internals
  when there is nothing to clear.

### 4.2 Self-parse the raw 0x55 stream

The plugin taps the RX characteristic directly:

- `isO2RingRxChar(_:)` — identifies the O2Ring/BP2 notify characteristic.
- `handleO2RingRealtimeData(_:)` — buffers notification fragments, resyncs to the `0x55`
  header, and slices out fixed 21-byte frames. It also calls `markDataReceived()` so the
  health watchdog stays calm (this is what stops the destructive re-deploy churn).
- `parseAndEmitO2Frame(_:)` — decodes a frame and emits `o2RingRt`.
- `emitO2Rt(...)` — normalizes and sends the event to JavaScript.

---

## 5. Decoded 21-byte real-time frame

Layout reverse-engineered from the live device stream:

| Byte    | Meaning                                  |
|---------|------------------------------------------|
| `[0]`   | `0x55` frame header                      |
| `[1-2]` | `0x00 0xFF` (cmd / ~cmd)                  |
| `[3-4]` | `0x00 0x00`                              |
| `[5]`   | `0x0D` payload length (13)               |
| `[6]`   | `0x00`                                   |
| `[7]`   | **SpO₂ (%)**                             |
| `[8-9]` | **PR (bpm, little-endian)**              |
| `[14]`  | **Battery (%)**                          |
| `[16]`  | **PI ×10** (e.g. `0x36` → 5.4)           |
| `[20]`  | checksum                                 |

**Finger-in detection:** a reading is treated as valid (finger-in) when
`1 ≤ SpO₂ ≤ 100` and `1 ≤ PR ≤ 511`. Otherwise a finger-out status is emitted
(`state = 1`, zeroed vitals) while battery is still reported.

---

## 6. `o2RingRt` event payload (to JavaScript)

```json
{
  "spo2": 97,
  "pr": 72,
  "pi": 5.4,
  "battery": 80,
  "batteryState": 0,
  "state": 0,        // 0 = finger-in / valid, 1 = finger-out / no reading
  "runStatus": 2
}
```

---

## 7. Health watchdog interaction

- `DATA_TIMEOUT_THRESHOLD` = 15 s.
- Every parsed frame calls `markDataReceived()`, resetting the timer.
- With data now arriving every ~2 s, the watchdog stays healthy
  (`✅ [HEALTH] SDK healthy`) and no longer triggers the re-deploy loop.
- The re-deploy/auto-recovery path remains as a genuine fallback for real disconnects.

---

## 8. How to verify

After connecting the worn O2Ring, the device log should show, repeating every ~2 s:

```
⏰ [RT TIMER] O2Ring poll tick – beginGetRealData() + woxi_requestWOxiRealData()
📥 [BLE DATA] ... 55 00 FF 00 00 0D 00 61 48 00 ...
🧬 [O2 FRAME] len=21 55 00 FF ...
✅ [O2 SELF-PARSE] Finger-in reading: spo2=97 pr=72 pi=5.4 battery=80%
📡 [O2 SELF-PARSE] ✅ Emitting o2RingRt: spo2=97 pr=72 ...
✅ [HEALTH] SDK healthy - last data 1s ago
```

And **no** recurring `⚠️ [HEALTH] SDK TIMEOUT!` / `🔄 forcing re-deployment` lines.

---

## 9. Files touched

- `ios/App/App/WellueSDKPlugin.swift`
  - `startO2RingPollingTimer()` — restored `beginGetRealData()`, clear `aa_cmdArr` each tick.
  - `isO2RingRxChar()`, `handleO2RingRealtimeData()`, `parseAndEmitO2Frame()`, `emitO2Rt()`
    — self-parse pipeline for the `0x55` stream.
  - `peripheral(_:didUpdateValueFor:error:)` — routes O2Ring RX notifications into the parser.

---

## 10. Key takeaways / gotchas

1. **`beginGetRealData()` is mandatory** for this O2Ring — `woxi_requestWOxiRealData()` alone
   does not start the stream.
2. **The SDK cannot parse this device's `0x55` frames** — we must self-parse and emit our own
   event; the SDK's `commandFailed 0xCC` is expected and ignored.
3. **The `aa_cmdArr` queue stalls** on every un-parseable reply — clear it each poll so the
   trigger keeps firing without relying on re-deploys.
4. **Don't rely on the watchdog re-deploy for data delivery** — it should only handle real
   disconnects; live data must come from the steady 2 s poll.
