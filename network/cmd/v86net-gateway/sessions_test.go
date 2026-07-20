package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSessionOriginAndExpiry(t *testing.T) {
	store := newSessionStore()
	now := time.Date(2026, 7, 19, 12, 0, 0, 0, time.UTC)
	store.now = func() time.Time { return now }
	created, err := store.create("https://vm.example", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := store.authenticate(created.Token, "https://vm.example"); !ok {
		t.Fatal("valid session was rejected")
	}
	if _, ok := store.authenticate(created.Token, "https://attacker.example"); ok {
		t.Fatal("wrong origin was accepted")
	}
	now = now.Add(time.Minute)
	if _, ok := store.authenticate(created.Token, "https://vm.example"); ok {
		t.Fatal("expired session was accepted")
	}
}

func TestSessionHTTPAuthorizationAndCreation(t *testing.T) {
	gateway := &gateway{
		adminToken: "admin-secret", defaultTTL: time.Minute, maxTTL: time.Hour,
		sessions: newSessionStore(),
	}
	unauthorized := httptest.NewRecorder()
	gateway.handleSessions(unauthorized, httptest.NewRequest(http.MethodPost, "/v1/sessions", strings.NewReader("{}")))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", unauthorized.Code)
	}

	request := httptest.NewRequest(http.MethodPost, "/v1/sessions", strings.NewReader(`{"origin":"https://vm.example","ttlSeconds":60}`))
	request.Header.Set("Authorization", "Bearer admin-secret")
	response := httptest.NewRecorder()
	gateway.handleSessions(response, request)
	if response.Code != http.StatusCreated || !strings.Contains(response.Body.String(), tokenProtocolPrefix) {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
}

func TestSessionRevocation(t *testing.T) {
	store := newSessionStore()
	created, err := store.create("", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if !store.revoke(created.ID) {
		t.Fatal("session was not revoked")
	}
	if _, ok := store.authenticate(created.Token, ""); ok {
		t.Fatal("revoked session was accepted")
	}
}
