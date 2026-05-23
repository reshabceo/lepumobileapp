package core

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync/atomic"
	"time"

	"github.com/bluenviron/gortsplib/v5"
	"github.com/bluenviron/gortsplib/v5/pkg/base"
	"github.com/bluenviron/gortsplib/v5/pkg/format"
	"github.com/bluenviron/gortsplib/v5/pkg/format/rtph264"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
)

const statusIdle = "idle"
const statusConnecting = "connecting"
const statusLive = "live"
const statusError = "error"

// Run blocks until ctx is cancelled or a fatal error occurs. It pulls Reolink RTSP (H.264) and publishes via WHIP.
func Run(ctx context.Context, cfg Config, h Hooks) error {
	if h.OnState == nil {
		h.OnState = func(string) {}
	}
	if h.OnError == nil {
		h.OnError = func(string) {}
	}
	if h.OnBytesTransferred == nil {
		h.OnBytesTransferred = func(int64) {}
	}

	cfg.SFUOrigin = strings.TrimRight(strings.TrimSpace(cfg.SFUOrigin), "/")
	if cfg.RTSPURL == "" || cfg.SFUOrigin == "" || cfg.PatientID == "" || cfg.JWT == "" {
		h.OnError("missing rtsp URL, SFU origin, patient id or jwt")
		return errors.New("invalid config")
	}

	u, err := base.ParseURL(cfg.RTSPURL)
	if err != nil {
		h.OnError("invalid rtsp URL: " + err.Error())
		return err
	}

	// Default to TCP interleaved RTSP; UDP often drops on home Wi‑Fi.
	var protoPtr *gortsplib.Protocol
	if !cfg.UseRTSPUDP {
		p := gortsplib.ProtocolTCP
		protoPtr = &p
	}

	rtspClient := &gortsplib.Client{
		Scheme:    u.Scheme,
		Host:      u.Host,
		Protocol:  protoPtr,
		UserAgent: "monitraq-camera-bridge/1.0",
	}

	h.OnState(statusConnecting)
	if err := rtspClient.Start(); err != nil {
		h.OnState(statusError)
		h.OnError("rtsp start: " + err.Error())
		return err
	}
	defer rtspClient.Close()

	desc, _, err := rtspClient.Describe(u)
	if err != nil {
		h.OnState(statusError)
		h.OnError("rtsp describe: " + err.Error())
		return err
	}

	var forma *format.H264
	medi := desc.FindFormat(&forma)
	if medi == nil {
		h.OnState(statusError)
		h.OnError("no H264 track in RTSP describe")
		return errors.New("no h264")
	}

	rtpDec, err := forma.CreateDecoder()
	if err != nil {
		h.OnState(statusError)
		h.OnError("h264 decoder: " + err.Error())
		return err
	}
	rtpEnc, err := forma.CreateEncoder()
	if err != nil {
		h.OnState(statusError)
		h.OnError("h264 encoder: " + err.Error())
		return err
	}

	_, err = rtspClient.Setup(desc.BaseURL, medi, 0, 0)
	if err != nil {
		h.OnState(statusError)
		h.OnError("rtsp setup: " + err.Error())
		return err
	}

	mediaEngine := &webrtc.MediaEngine{}
	sdpFmtp := buildH264FmtpLine(forma)
	pt := webrtc.PayloadType(forma.PayloadType())
	if err := mediaEngine.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{
			MimeType:    webrtc.MimeTypeH264,
			ClockRate:   90000,
			SDPFmtpLine: sdpFmtp,
		},
		PayloadType: pt,
	}, webrtc.RTPCodecTypeVideo); err != nil {
		h.OnState(statusError)
		h.OnError("media engine: " + err.Error())
		return err
	}
	api := webrtc.NewAPI(webrtc.WithMediaEngine(mediaEngine))
	ice := parseICEServersJSON(cfg.ICEJSON)
	pc, err := api.NewPeerConnection(webrtc.Configuration{ICEServers: ice})
	if err != nil {
		h.OnState(statusError)
		h.OnError("pc: " + err.Error())
		return err
	}
	defer func() { _ = pc.Close() }()

	videoTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{
			MimeType:    webrtc.MimeTypeH264,
			ClockRate:   90000,
			SDPFmtpLine: sdpFmtp,
		},
		"video",
		"monitraq-bridge",
	)
	if err != nil {
		h.OnState(statusError)
		h.OnError("track: " + err.Error())
		return err
	}
	if _, err := pc.AddTrack(videoTrack); err != nil {
		h.OnState(statusError)
		h.OnError("add track: " + err.Error())
		return err
	}

	var bytes atomic.Int64
	rtspClient.OnPacketRTP(medi, forma, func(pkt *rtp.Packet) {
		au, err2 := rtpDec.Decode(pkt)
		if err2 != nil {
			if !errors.Is(err2, rtph264.ErrNonStartingPacketAndNoPrevious) && !errors.Is(err2, rtph264.ErrMorePacketsNeeded) {
				// non-fatal noise on some cameras
			}
			return
		}
		outPkts, err2 := rtpEnc.Encode(au)
		if err2 != nil {
			return
		}
		for _, op := range outPkts {
			cp := *op
			cp.Payload = append([]byte(nil), op.Payload...)
			n := len(cp.Payload)
			if err := videoTrack.WriteRTP(&cp); err == nil {
				bytes.Add(int64(n))
				h.OnBytesTransferred(bytes.Load())
			}
		}
	})

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		h.OnState(statusError)
		h.OnError("create offer: " + err.Error())
		return err
	}
	if err := pc.SetLocalDescription(offer); err != nil {
		h.OnState(statusError)
		h.OnError("set local: " + err.Error())
		return err
	}
	gatherComplete := webrtc.GatheringCompletePromise(pc)
	select {
	case <-gatherComplete:
	case <-time.After(8 * time.Second):
	case <-ctx.Done():
		return ctx.Err()
	}

	local := pc.LocalDescription()
	if local == nil {
		h.OnState(statusError)
		h.OnError("no local sdp")
		return errors.New("no local sdp")
	}

	whipURL := fmt.Sprintf("%s/whip/%s", cfg.SFUOrigin, cfg.PatientID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, whipURL, strings.NewReader(local.SDP))
	if err != nil {
		h.OnState(statusError)
		h.OnError("whip req: " + err.Error())
		return err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.JWT)
	req.Header.Set("Content-Type", "application/sdp")

	httpCl := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpCl.Do(req)
	if err != nil {
		h.OnState(statusError)
		h.OnError("whip post: " + err.Error())
		return err
	}
	defer resp.Body.Close()
	answerBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusCreated {
		h.OnState(statusError)
		h.OnError(fmt.Sprintf("whip http %d: %s", resp.StatusCode, strings.TrimSpace(string(answerBytes))))
		return fmt.Errorf("whip: %d", resp.StatusCode)
	}

	loc := resp.Header.Get("Location")
	resourceID := ""
	if loc != "" {
		parts := strings.Split(strings.Trim(loc, "/"), "/")
		if len(parts) > 0 {
			resourceID = parts[len(parts)-1]
		}
	}

	if err := pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: string(answerBytes)}); err != nil {
		h.OnState(statusError)
		h.OnError("set remote: " + err.Error())
		return err
	}

	h.OnState(statusLive)

	hbCtx, hbCancel := context.WithCancel(ctx)
	defer hbCancel()
	go heartbeatLoop(hbCtx, cfg, h)

	_, err = rtspClient.Play(nil)
	if err != nil {
		h.OnState(statusError)
		h.OnError("rtsp play: " + err.Error())
		_ = deleteWHIP(ctx, cfg, resourceID)
		return err
	}

	waitErr := make(chan error, 1)
	go func() {
		waitErr <- rtspClient.Wait()
	}()

	select {
	case <-ctx.Done():
		_ = deleteWHIP(context.Background(), cfg, resourceID)
		_ = pc.Close()
		rtspClient.Close()
		h.OnState(statusIdle)
		return ctx.Err()
	case err := <-waitErr:
		_ = deleteWHIP(context.Background(), cfg, resourceID)
		_ = pc.Close()
		if err != nil {
			h.OnState(statusError)
			h.OnError("rtsp wait: " + err.Error())
			return err
		}
		h.OnState(statusIdle)
		return nil
	}
}

func deleteWHIP(ctx context.Context, cfg Config, resourceID string) error {
	if resourceID == "" {
		return nil
	}
	u := fmt.Sprintf("%s/whip/%s/%s", cfg.SFUOrigin, cfg.PatientID, resourceID)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, u, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.JWT)
	cl := &http.Client{Timeout: 10 * time.Second}
	resp, err := cl.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("whip delete %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

func heartbeatLoop(ctx context.Context, cfg Config, h Hooks) {
	t := time.NewTicker(15 * time.Second)
	defer t.Stop()
	do := func() {
		url := fmt.Sprintf("%s/bridges/heartbeat/%s", cfg.SFUOrigin, cfg.PatientID)
		req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, nil)
		if err != nil {
			return
		}
		req.Header.Set("Authorization", "Bearer "+cfg.JWT)
		cl := &http.Client{Timeout: 12 * time.Second}
		resp, err := cl.Do(req)
		if err != nil {
			return
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}
	do()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			do()
		}
	}
}

func buildH264FmtpLine(f *format.H264) string {
	m := f.FMTP()
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	for i, k := range keys {
		if i > 0 {
			b.WriteByte(';')
		}
		b.WriteString(k)
		b.WriteByte('=')
		b.WriteString(m[k])
	}
	return b.String()
}
