package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
)

type config struct {
	NetworkMode  string `json:"networkMode"`
	RemoteURL    string `json:"remoteGatewayUrl,omitempty"`
	RememberMode bool   `json:"rememberMode"`
}

func main() {
	modeFlag := flag.String("network", "", "remote, userspace, wintun, or offline")
	rootFlag := flag.String("root", "", "application asset directory")
	flag.Parse()

	exe, err := os.Executable()
	if err != nil {
		log.Fatal(err)
	}
	bundle := filepath.Dir(exe)
	root := *rootFlag
	if root == "" {
		root = filepath.Join(bundle, "app")
	}
	cfgPath := filepath.Join(bundle, "vm-portable.json")
	cfg := loadConfig(cfgPath)
	mode := *modeFlag
	if mode == "" {
		mode = chooseMode(cfg.NetworkMode)
	}
	if !validMode(mode) {
		log.Fatalf("invalid network mode %q", mode)
	}
	cfg.NetworkMode = mode
	if cfg.RememberMode {
		saveConfig(cfgPath, cfg)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:8090")
	if err != nil {
		log.Fatalf("portable VM port 8090 is unavailable: %v", err)
	}
	defer listener.Close()
	server := &http.Server{Handler: assetHandler(root)}
	go func() {
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("web server: %v", err)
		}
	}()
	defer server.Close()

	gatewayURL, token, stopGateway, err := configureNetwork(bundle, mode, &cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Network unavailable: %v\n", err)
		fmt.Print("Continue offline? [Y/n]: ")
		var answer string
		fmt.Scanln(&answer)
		if strings.EqualFold(strings.TrimSpace(answer), "n") {
			os.Exit(1)
		}
		mode, gatewayURL, token = "offline", "", ""
	}
	if stopGateway != nil {
		defer stopGateway()
	}
	if cfg.RememberMode {
		saveConfig(cfgPath, cfg)
	}

	pageURL := fmt.Sprintf("http://%s/?portable=1", listener.Addr())
	if gatewayURL != "" && token != "" {
		pageURL += "#gateway=" + urlEncode(gatewayURL) + "&token=" + urlEncode(token)
	}
	chrome := findChrome(bundle)
	profile := filepath.Join(bundle, "data", "chrome-profile")
	_ = os.MkdirAll(profile, 0700)
	args := []string{"--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check"}
	if extension := filepath.Join(bundle, "extension"); directoryExists(extension) {
		args = append(args, "--disable-extensions-except="+extension, "--load-extension="+extension)
	}
	args = append(args, pageURL)
	fmt.Printf("Starting VM (%s networking)…\n", mode)
	command := exec.Command(chrome, args...)
	command.Stdout, command.Stderr = os.Stdout, os.Stderr
	if err := command.Run(); err != nil {
		log.Fatal(err)
	}
}

func chooseMode(previous string) string {
	if !validMode(previous) {
		previous = "remote"
	}
	labels := map[string]string{"remote": "Remote full gateway", "userspace": "Local userspace gateway", "wintun": "Native Wintun gateway", "offline": "Offline"}
	fmt.Println("VM Portable - networking")
	fmt.Printf("  [1] Local userspace gateway\n  [2] Remote full gateway (default)\n  [3] Native Wintun gateway\n  [5] Offline\nSelect [%s]: ", labels[previous])
	var answer string
	fmt.Scanln(&answer)
	switch strings.TrimSpace(answer) {
	case "1":
		return "userspace"
	case "2":
		return "remote"
	case "3":
		return "wintun"
	case "5":
		return "offline"
	case "":
		return previous
	default:
		return previous
	}
}

func configureNetwork(bundle, mode string, cfg *config) (string, string, func(), error) {
	switch mode {
	case "offline":
		return "", "", nil, nil
	case "remote":
		url := strings.TrimSpace(os.Getenv("VM_REMOTE_GATEWAY_URL"))
		if url == "" {
			url = cfg.RemoteURL
		}
		if url == "" {
			fmt.Print("Remote gateway WSS URL: ")
			fmt.Scanln(&url)
		}
		if !strings.HasPrefix(url, "wss://") && !strings.HasPrefix(url, "ws://127.0.0.1") {
			return "", "", nil, errors.New("remote gateway must use wss://")
		}
		token := strings.TrimSpace(os.Getenv("VM_REMOTE_GATEWAY_TOKEN"))
		if token == "" {
			fmt.Print("Short-lived session token: ")
			fmt.Scanln(&token)
		}
		if token == "" {
			return "", "", nil, errors.New("a remote session token is required")
		}
		cfg.RemoteURL = url
		return url, token, nil, nil
	case "userspace":
		return startUserspaceGateway(bundle)
	case "wintun":
		programData := os.Getenv("ProgramData")
		value, err := os.ReadFile(filepath.Join(programData, "VMV86", "connection.json"))
		if err != nil {
			return "", "", nil, errors.New("Wintun gateway is not installed; run setup-network.bat as Administrator once")
		}
		var connection struct {
			GatewayURL string `json:"gatewayUrl"`
			Token      string `json:"token"`
		}
		if json.Unmarshal(value, &connection) != nil || connection.GatewayURL == "" || connection.Token == "" {
			return "", "", nil, errors.New("invalid Wintun connection configuration")
		}
		return connection.GatewayURL, connection.Token, nil, nil
	}
	panic("unreachable")
}

func startUserspaceGateway(bundle string) (string, string, func(), error) {
	gateway := filepath.Join(bundle, "gateway", "v86net-gateway.exe")
	if _, err := os.Stat(gateway); err != nil {
		return "", "", nil, errors.New("userspace gateway executable is missing")
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", "", nil, err
	}
	address := listener.Addr().String()
	listener.Close()
	token := randomToken()
	command := exec.Command(gateway, "-backend", "userspace", "-listen", address, "-token", token, "-allow-origin", "http://127.0.0.1:8090")
	command.Stdout, command.Stderr = os.Stdout, os.Stderr
	command.SysProcAttr = hiddenProcessAttributes()
	if err := command.Start(); err != nil {
		return "", "", nil, err
	}
	stop := func() { _ = command.Process.Kill(); _, _ = command.Process.Wait() }
	if err := waitForHTTP("http://"+address+"/health", 5*time.Second); err != nil {
		stop()
		return "", "", nil, err
	}
	return "ws://" + address + "/v1/ethernet", token, stop, nil
}

func assetHandler(root string) http.Handler {
	files := http.FileServer(http.Dir(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		if ext := filepath.Ext(r.URL.Path); ext != "" {
			if kind := mime.TypeByExtension(ext); kind != "" {
				w.Header().Set("Content-Type", kind)
			}
		}
		files.ServeHTTP(w, r)
	})
}

func loadConfig(path string) config {
	cfg := config{NetworkMode: "remote", RemoteURL: "wss://gateway.fapstaff.com/v1/ethernet", RememberMode: true}
	value, err := os.ReadFile(path)
	if err == nil {
		_ = json.Unmarshal(value, &cfg)
	}
	return cfg
}
func saveConfig(path string, cfg config) {
	value, _ := json.MarshalIndent(cfg, "", "  ")
	_ = os.WriteFile(path, value, 0600)
}
func validMode(mode string) bool {
	return mode == "remote" || mode == "userspace" || mode == "wintun" || mode == "offline"
}
func randomToken() string {
	value := make([]byte, 32)
	_, _ = rand.Read(value)
	return base64.RawURLEncoding.EncodeToString(value)
}
func urlEncode(value string) string {
	replacer := strings.NewReplacer("%", "%25", ":", "%3A", "/", "%2F", "?", "%3F", "&", "%26", "=", "%3D", "#", "%23", "+", "%2B")
	return replacer.Replace(value)
}
func directoryExists(path string) bool { info, err := os.Stat(path); return err == nil && info.IsDir() }
func findChrome(bundle string) string {
	candidates := []string{filepath.Join(bundle, "browser", "chrome-win64", "chrome.exe"), filepath.Join(bundle, "browser", "chrome.exe")}
	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	log.Fatal("bundled Chrome for Testing is missing")
	return ""
}
func waitForHTTP(url string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		response, err := http.Get(url)
		if err == nil {
			io.Copy(io.Discard, response.Body)
			response.Body.Close()
			if response.StatusCode == 200 {
				return nil
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	return errors.New("gateway did not become ready")
}
func hiddenProcessAttributes() *syscall.SysProcAttr {
	if runtime.GOOS == "windows" {
		return &syscall.SysProcAttr{HideWindow: true}
	}
	return nil
}
