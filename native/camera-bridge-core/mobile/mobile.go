// Package mobile is built with gomobile for Android/iOS.
package mobile

import (
	"context"

	"github.com/lepu/camera-bridge-core/core"
)

// StatusListener receives bridge updates on the native side.
type StatusListener interface {
	OnState(state string)
	OnError(msg string)
	OnBytes(total int64)
}

// Bridge wraps core.Run for gomobile embedding in Capacitor plugins.
type Bridge struct {
	cancel context.CancelFunc
}

// Start begins RTSP→WHIP in a goroutine; returns immediately. Idempotent: stops previous run.
func (b *Bridge) Start(rtspURL, sfuOrigin, patientID, jwt, iceJSON string, useUDP bool, hwSerial string, lst StatusListener) {
	if b.cancel != nil {
		b.cancel()
		b.cancel = nil
	}
	if lst == nil {
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	b.cancel = cancel
	hooks := core.Hooks{
		OnState:            lst.OnState,
		OnError:            lst.OnError,
		OnBytesTransferred: lst.OnBytes,
	}
	cfg := core.Config{
		RTSPURL:        rtspURL,
		SFUOrigin:      sfuOrigin,
		PatientID:      patientID,
		JWT:            jwt,
		ICEJSON:        iceJSON,
		UseRTSPUDP:     useUDP,
		HardwareSerial: hwSerial,
	}
	go func() {
		_ = core.Run(ctx, cfg, hooks)
	}()
}

// Stop cancels the bridge if running.
func (b *Bridge) Stop() {
	if b.cancel != nil {
		b.cancel()
		b.cancel = nil
	}
}
