package credential

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/hex"
	"testing"
)

func TestVaultDecryptsNodeCompatiblePayload(t *testing.T) {
	key := []byte("0123456789abcdef0123456789abcdef")
	block, _ := aes.NewCipher(key)
	aead, _ := cipher.NewGCM(block)
	nonce := []byte("123456789012")
	sealed := aead.Seal(nil, nonce, []byte("demo-api-secret"), nil)
	ciphertext, tag := sealed[:len(sealed)-aead.Overhead()], sealed[len(sealed)-aead.Overhead():]
	payload := "v1." + base64.RawURLEncoding.EncodeToString(nonce) + "." +
		base64.RawURLEncoding.EncodeToString(tag) + "." + base64.RawURLEncoding.EncodeToString(ciphertext)
	vault, err := NewVault(hex.EncodeToString(key))
	if err != nil {
		t.Fatal(err)
	}
	plaintext, err := vault.Decrypt(payload)
	if err != nil || plaintext != "demo-api-secret" {
		t.Fatalf("unexpected plaintext %q, err=%v", plaintext, err)
	}
}

func TestVaultRejectsTamperedPayload(t *testing.T) {
	vault, err := NewVault("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := vault.Decrypt("v1.MTIzNDU2Nzg5MDEy.dGFtcGVyZWQtdGFn.Ym9keQ"); err == nil {
		t.Fatal("tampered payload must be rejected")
	}
}
