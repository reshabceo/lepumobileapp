package core

import (
	"encoding/json"
	"strings"

	"github.com/pion/webrtc/v4"
)

func parseICEServersJSON(raw string) []webrtc.ICEServer {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []webrtc.ICEServer{{URLs: []string{"stun:stun.l.google.com:19302"}}}
	}
	var arr []struct {
		URLs       json.RawMessage `json:"urls"`
		Username   string          `json:"username,omitempty"`
		Credential string          `json:"credential,omitempty"`
	}
	if err := json.Unmarshal([]byte(raw), &arr); err != nil || len(arr) == 0 {
		return []webrtc.ICEServer{{URLs: []string{"stun:stun.l.google.com:19302"}}}
	}
	out := make([]webrtc.ICEServer, 0, len(arr))
	for _, e := range arr {
		var urls []string
		str := strings.TrimSpace(string(e.URLs))
		if strings.HasPrefix(str, "\"") && strings.HasSuffix(str, "\"") {
			var u string
			_ = json.Unmarshal(e.URLs, &u)
			if strings.TrimSpace(u) != "" {
				urls = append(urls, strings.TrimSpace(u))
			}
		} else {
			var ulist []string
			if err := json.Unmarshal(e.URLs, &ulist); err != nil || len(ulist) == 0 {
				var single string
				if err2 := json.Unmarshal(e.URLs, &single); err2 != nil || single == "" {
					continue
				}
				urls = append(urls, strings.TrimSpace(single))
			} else {
				urls = ulist
			}
		}
		s := webrtc.ICEServer{URLs: urls}
		if e.Username != "" {
			s.Username = e.Username
		}
		if e.Credential != "" {
			s.Credential = e.Credential
		}
		if len(s.URLs) > 0 {
			out = append(out, s)
		}
	}
	if len(out) == 0 {
		return []webrtc.ICEServer{{URLs: []string{"stun:stun.l.google.com:19302"}}}
	}
	return out
}
