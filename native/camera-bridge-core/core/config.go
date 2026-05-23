package core

// Config drives one RTSP -> WHIP publish session for a patient.
type Config struct {
	RTSPURL   string // full rtsp URL (with credentials); sub stream preferred for WAN
	SFUOrigin string // e.g. https://sfu.monitraq.com (no trailing slash)
	PatientID string
	JWT       string // Supabase patient access_token OR minted bridge_jwt

	// ICEJSON optional JSON array: [{"urls":"stun:stun.l.google.com:19302"},{"urls":["turn:..."],"username":"...","credential":"..."}]
	ICEJSON string

	// UseRTSPUDP when true prefers UDP RTP (not recommended). Default false forces TCP interleaving — stable on noisy Wi‑Fi.
	UseRTSPUDP bool

	HardwareSerial string // reserved for pairing UX / future metadata
}

// Hooks surfaces progress to wrappers (gomobile/Android/iOS/native).
type Hooks struct {
	OnState func(state string)
	OnError func(message string)

	// OnBytesTransferred called with cumulative payload bytes forwarded (approx).
	OnBytesTransferred func(total int64)
}
