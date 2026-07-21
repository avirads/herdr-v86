package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/netip"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/coder/websocket"
)

const (
	maxEthernetFrame = 65535
	maxTunnelMessage = 1 << 20
)

type gateway struct {
	tapName         string
	legacyToken     string
	allowQuery      bool
	adminToken      string
	defaultTTL      time.Duration
	maxTTL          time.Duration
	sessions        *sessionStore
	active          atomic.Bool
	bytesFromGuest  atomic.Uint64
	bytesToGuest    atomic.Uint64
	framesDropped   atomic.Uint64
	policy          packetPolicy
	maxSessionBytes uint64
	allowOrigins    map[string]bool
}

func main() {
	listen := flag.String("listen", "127.0.0.1:8086", "HTTP/WebSocket listen address")
	tapName := flag.String("tap", "v86tap0", "existing TAP interface")
	legacyToken := flag.String("token", os.Getenv("V86NET_TOKEN"), "optional legacy static token")
	adminToken := flag.String("admin-token", os.Getenv("V86NET_ADMIN_TOKEN"), "admin bearer token used to create sessions")
	adminTokenFile := flag.String("admin-token-file", "", "read admin bearer token from a file")
	legacyTokenFile := flag.String("token-file", "", "read legacy browser token from a file")
	prepareAdapter := flag.Bool("prepare-adapter", false, "create/open the native packet adapter and exit")
	allowOrigin := flag.String("allow-origin", "", "comma-separated browser origins allowed to use legacy tokens")
	tlsCert := flag.String("tls-cert", "", "TLS certificate file; requires -tls-key")
	tlsKey := flag.String("tls-key", "", "TLS private key file; requires -tls-cert")
	allowQuery := flag.Bool("allow-query-token", false, "allow legacy tokens in WebSocket query parameters")
	defaultTTL := flag.Duration("session-ttl", 15*time.Minute, "default secure-session lifetime")
	maxTTL := flag.Duration("max-session-ttl", time.Hour, "maximum secure-session lifetime")
	guestNetwork := flag.String("guest-network", "10.77.0.0/24", "guest CIDR allowed to reach gateway services")
	allowPrivate := flag.Bool("allow-private-egress", false, "allow guest access to private/link-local destination networks")
	maxSessionBytes := flag.Uint64("max-session-bytes", 1<<30, "maximum combined bytes per WebSocket session; 0 disables")
	flag.Parse()

	if runtime.GOOS != "linux" && runtime.GOOS != "windows" {
		log.Fatalf("the packet gateway requires Linux or Windows; got %s", runtime.GOOS)
	}
	if *prepareAdapter {
		device, err := openPacketDevice(*tapName)
		if err != nil {
			log.Fatal(err)
		}
		_ = device.Close()
		log.Printf("adapter %s is ready", *tapName)
		return
	}
	if *adminTokenFile != "" {
		value, err := os.ReadFile(*adminTokenFile)
		if err != nil {
			log.Fatalf("read admin token file: %v", err)
		}
		*adminToken = strings.TrimSpace(string(value))
	}
	if *legacyTokenFile != "" {
		value, err := os.ReadFile(*legacyTokenFile)
		if err != nil {
			log.Fatalf("read browser token file: %v", err)
		}
		*legacyToken = strings.TrimSpace(string(value))
	}
	if *adminToken == "" && *legacyToken == "" {
		log.Fatal("set -admin-token/V86NET_ADMIN_TOKEN (recommended) or a legacy -token")
	}

	guestPrefix, err := netip.ParsePrefix(*guestNetwork)
	if err != nil || !guestPrefix.Addr().Is4() {
		log.Fatalf("invalid -guest-network: %q", *guestNetwork)
	}
	g := &gateway{
		tapName: *tapName, legacyToken: *legacyToken, allowQuery: *allowQuery,
		adminToken: *adminToken, defaultTTL: *defaultTTL, maxTTL: *maxTTL,
		sessions: newSessionStore(), policy: packetPolicy{allowPrivate: *allowPrivate, guestNetwork: guestPrefix.Masked()},
		maxSessionBytes: *maxSessionBytes,
		allowOrigins:    make(map[string]bool),
	}
	for _, origin := range strings.Split(*allowOrigin, ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			g.allowOrigins[origin] = true
		}
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true, "tap": g.tapName, "active": g.active.Load(),
			"sessions": g.sessions.count(), "bytesFromGuest": g.bytesFromGuest.Load(),
			"bytesToGuest": g.bytesToGuest.Load(), "framesDropped": g.framesDropped.Load(),
		})
	})
	mux.HandleFunc("/v1/sessions", g.handleSessions)
	mux.HandleFunc("/v1/sessions/", g.handleSession)
	mux.HandleFunc("/metrics", g.handleMetrics)
	mux.HandleFunc("/v1/ethernet", func(w http.ResponseWriter, r *http.Request) {
		current, protocol, ok := g.authorizeWebSocket(r)
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		g.serveEthernet(w, r, current, protocol)
	})

	server := &http.Server{
		Addr:              *listen,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       70 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()

	log.Printf("v86 network gateway listening on %s (tap %s)", *listen, *tapName)
	var serveErr error
	if *tlsCert != "" || *tlsKey != "" {
		if *tlsCert == "" || *tlsKey == "" {
			log.Fatal("both -tls-cert and -tls-key are required")
		}
		serveErr = server.ListenAndServeTLS(*tlsCert, *tlsKey)
	} else {
		serveErr = server.ListenAndServe()
	}
	if serveErr != nil && serveErr != http.ErrServerClosed {
		log.Fatal(serveErr)
	}
}

func (g *gateway) handleMetrics(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	fmt.Fprintf(w, "v86net_active %d\n", boolInt(g.active.Load()))
	fmt.Fprintf(w, "v86net_sessions %d\n", g.sessions.count())
	fmt.Fprintf(w, "v86net_bytes_from_guest_total %d\n", g.bytesFromGuest.Load())
	fmt.Fprintf(w, "v86net_bytes_to_guest_total %d\n", g.bytesToGuest.Load())
	fmt.Fprintf(w, "v86net_frames_dropped_total %d\n", g.framesDropped.Load())
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func secureEqual(got, want string) bool {
	return len(got) == len(want) && subtle.ConstantTimeCompare([]byte(got), []byte(want)) == 1
}

func (g *gateway) handleSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !g.authorizeAdmin(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var request struct {
		Origin     string `json:"origin"`
		TTLSeconds int    `json:"ttlSeconds"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&request); err != nil && err.Error() != "EOF" {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	ttl := g.defaultTTL
	if request.TTLSeconds > 0 {
		ttl = time.Duration(request.TTLSeconds) * time.Second
	}
	if ttl <= 0 || ttl > g.maxTTL {
		http.Error(w, "session TTL outside allowed range", http.StatusBadRequest)
		return
	}
	created, err := g.sessions.create(request.Origin, ttl)
	if err != nil {
		http.Error(w, "could not create session", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"id": created.ID, "token": created.Token, "protocol": tokenProtocolPrefix + created.Token,
		"origin": created.Origin, "createdAt": created.CreatedAt, "expiresAt": created.ExpiresAt,
	})
}

func (g *gateway) handleSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		w.Header().Set("Allow", http.MethodDelete)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !g.authorizeAdmin(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := r.URL.Path[len("/v1/sessions/"):]
	if id == "" || !g.sessions.revoke(id) {
		http.NotFound(w, r)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (g *gateway) authorizeAdmin(r *http.Request) bool {
	const prefix = "Bearer "
	header := r.Header.Get("Authorization")
	return g.adminToken != "" && len(header) > len(prefix) && header[:len(prefix)] == prefix && secureEqual(header[len(prefix):], g.adminToken)
}

func (g *gateway) authorizeWebSocket(r *http.Request) (session, string, bool) {
	legacyOriginAllowed := len(g.allowOrigins) == 0 || g.allowOrigins[r.Header.Get("Origin")]
	for _, protocol := range websocketSubprotocols(r) {
		if len(protocol) <= len(tokenProtocolPrefix) || protocol[:len(tokenProtocolPrefix)] != tokenProtocolPrefix {
			continue
		}
		token := protocol[len(tokenProtocolPrefix):]
		if current, ok := g.sessions.authenticate(token, r.Header.Get("Origin")); ok {
			return current, protocol, true
		}
		if legacyOriginAllowed && g.legacyToken != "" && secureEqual(token, g.legacyToken) {
			return session{}, protocol, true
		}
	}
	if legacyOriginAllowed && g.allowQuery && g.legacyToken != "" && secureEqual(r.URL.Query().Get("token"), g.legacyToken) {
		return session{}, "", true
	}
	return session{}, "", false
}

func websocketSubprotocols(r *http.Request) []string {
	var protocols []string
	for _, header := range r.Header.Values("Sec-WebSocket-Protocol") {
		for _, protocol := range strings.Split(header, ",") {
			if trimmed := strings.TrimSpace(protocol); trimmed != "" {
				protocols = append(protocols, trimmed)
			}
		}
	}
	return protocols
}

func (g *gateway) serveEthernet(w http.ResponseWriter, r *http.Request, current session, protocol string) {
	if !g.active.CompareAndSwap(false, true) {
		http.Error(w, "a VM is already connected", http.StatusConflict)
		return
	}
	defer g.active.Store(false)

	device, err := openPacketDevice(g.tapName)
	if err != nil {
		http.Error(w, "open packet device: "+err.Error(), http.StatusServiceUnavailable)
		return
	}
	defer device.Close()

	options := &websocket.AcceptOptions{
		InsecureSkipVerify: true, // Session authorization checks the exact configured Origin.
		CompressionMode:    websocket.CompressionDisabled,
	}
	if protocol != "" {
		options.Subprotocols = []string{protocol}
	}
	conn, err := websocket.Accept(w, r, options)
	if err != nil {
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(maxTunnelMessage)

	ctx, cancel := context.WithCancel(r.Context())
	if !current.ExpiresAt.IsZero() {
		var expiryCancel context.CancelFunc
		ctx, expiryCancel = context.WithDeadline(ctx, current.ExpiresAt)
		defer expiryCancel()
	}
	defer cancel()
	errCh := make(chan error, 2)
	var sessionBytes atomic.Uint64
	var closeOnce sync.Once
	closeWith := func(err error) {
		closeOnce.Do(func() { errCh <- err; cancel() })
	}

	go func() {
		for {
			messageType, message, err := conn.Read(ctx)
			if err != nil {
				closeWith(err)
				return
			}
			if messageType != websocket.MessageBinary {
				g.framesDropped.Add(1)
				continue
			}
			frames, decodeErr := decodeTunnelMessage(message)
			if decodeErr != nil {
				g.framesDropped.Add(1)
				continue
			}
			for _, frame := range frames {
				if !g.policy.allowGuestFrame(frame) {
					g.framesDropped.Add(1)
					continue
				}
				if g.maxSessionBytes > 0 && sessionBytes.Add(uint64(len(frame))) > g.maxSessionBytes {
					closeWith(fmt.Errorf("session byte quota exceeded"))
					return
				}
				if err = device.WriteFrame(frame); err != nil {
					closeWith(err)
					return
				}
				g.bytesFromGuest.Add(uint64(len(frame)))
			}
		}
	}()
	go func() {
		buffer := make([]byte, maxEthernetFrame)
		for {
			n, err := device.ReadFrame(buffer)
			if err != nil {
				closeWith(err)
				return
			}
			if n < 14 {
				g.framesDropped.Add(1)
				continue
			}
			frame := append([]byte(nil), buffer[:n]...)
			if g.maxSessionBytes > 0 && sessionBytes.Add(uint64(n)) > g.maxSessionBytes {
				closeWith(fmt.Errorf("session byte quota exceeded"))
				return
			}
			if err = conn.Write(ctx, websocket.MessageBinary, frame); err != nil {
				closeWith(err)
				return
			}
			g.bytesToGuest.Add(uint64(n))
		}
	}()

	err = <-errCh
	log.Printf("VM disconnected from %s: %v", g.tapName, err)
	_ = conn.Close(websocket.StatusNormalClosure, "network tunnel closed")
}
