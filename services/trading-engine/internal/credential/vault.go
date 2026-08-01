package credential

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

type Vault struct {
	aead cipher.AEAD
}

func NewVault(masterKeyHex string) (*Vault, error) {
	key, err := hex.DecodeString(strings.TrimSpace(masterKeyHex))
	if err != nil || len(key) != 32 {
		return nil, errors.New("TRADING_CREDENTIALS_MASTER_KEY must be a 32-byte hexadecimal key")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("initialize credential cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("initialize credential GCM: %w", err)
	}
	return &Vault{aead: aead}, nil
}

func (v *Vault) Decrypt(payload string) (string, error) {
	parts := strings.Split(payload, ".")
	if len(parts) != 4 || parts[0] != "v1" {
		return "", errors.New("unsupported encrypted credential payload")
	}
	nonce, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || len(nonce) != v.aead.NonceSize() {
		return "", errors.New("invalid encrypted credential nonce")
	}
	tag, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || len(tag) != v.aead.Overhead() {
		return "", errors.New("invalid encrypted credential authentication tag")
	}
	ciphertext, err := base64.RawURLEncoding.DecodeString(parts[3])
	if err != nil {
		return "", errors.New("invalid encrypted credential body")
	}
	plaintext, err := v.aead.Open(nil, nonce, append(ciphertext, tag...), nil)
	if err != nil {
		return "", errors.New("encrypted credential authentication failed")
	}
	return string(plaintext), nil
}
