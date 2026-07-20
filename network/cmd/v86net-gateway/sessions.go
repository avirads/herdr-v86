package main

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"sync"
	"time"
)

const tokenProtocolPrefix = "v86net."

type session struct {
	ID        string    `json:"id"`
	Token     string    `json:"-"`
	Origin    string    `json:"origin,omitempty"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}

type sessionStore struct {
	mu       sync.Mutex
	sessions map[string]session
	now      func() time.Time
}

func newSessionStore() *sessionStore {
	return &sessionStore{sessions: make(map[string]session), now: time.Now}
}

func (s *sessionStore) create(origin string, ttl time.Duration) (session, error) {
	if ttl <= 0 {
		return session{}, errors.New("TTL must be positive")
	}
	id, err := randomToken(12)
	if err != nil {
		return session{}, err
	}
	token, err := randomToken(32)
	if err != nil {
		return session{}, err
	}
	now := s.now().UTC()
	created := session{ID: id, Token: token, Origin: origin, CreatedAt: now, ExpiresAt: now.Add(ttl)}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked(now)
	s.sessions[token] = created
	return created, nil
}

func (s *sessionStore) authenticate(token, origin string) (session, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now().UTC()
	s.pruneLocked(now)
	current, ok := s.sessions[token]
	if !ok || (current.Origin != "" && current.Origin != origin) {
		return session{}, false
	}
	return current, true
}

func (s *sessionStore) revoke(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for token, current := range s.sessions {
		if current.ID == id {
			delete(s.sessions, token)
			return true
		}
	}
	return false
}

func (s *sessionStore) count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked(s.now().UTC())
	return len(s.sessions)
}

func (s *sessionStore) pruneLocked(now time.Time) {
	for token, current := range s.sessions {
		if !now.Before(current.ExpiresAt) {
			delete(s.sessions, token)
		}
	}
}

func randomToken(bytes int) (string, error) {
	buffer := make([]byte, bytes)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}
