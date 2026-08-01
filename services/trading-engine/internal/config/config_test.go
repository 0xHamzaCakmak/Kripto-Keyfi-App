package config

import (
	"testing"
	"time"
)

func TestLoadRequiresInternalToken(t *testing.T) {
	t.Setenv("TRADING_ENGINE_TOKEN", "short")
	if _, err := Load(); err == nil {
		t.Fatal("expected a token validation error")
	}
}

func TestLoadKeepsEngineInShadowMode(t *testing.T) {
	t.Setenv("TRADING_ENGINE_TOKEN", "0123456789abcdef0123456789abcdef")
	t.Setenv("TRADING_ENGINE_MODE", "active")
	if _, err := Load(); err == nil {
		t.Fatal("expected active mode to be rejected before cutover")
	}
}

func TestLoadRequiresDatabaseConfigurationOnlyForShadowReads(t *testing.T) {
	t.Setenv("TRADING_ENGINE_TOKEN", "0123456789abcdef0123456789abcdef")
	t.Setenv("TRADING_ENGINE_SHADOW_READ_ENABLED", "true")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("TRADING_CREDENTIALS_MASTER_KEY", "")
	if _, err := Load(); err == nil {
		t.Fatal("enabled shadow reads must require database credentials")
	}
	t.Setenv("DATABASE_URL", "mysql://user:pass@127.0.0.1:3306/app")
	t.Setenv("TRADING_CREDENTIALS_MASTER_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	config, err := Load()
	if err != nil || !config.ShadowRead {
		t.Fatalf("expected enabled shadow reads: %#v, err=%v", config, err)
	}
}

func TestLoadParsesSafeDefaults(t *testing.T) {
	t.Setenv("TRADING_ENGINE_TOKEN", "0123456789abcdef0123456789abcdef")
	t.Setenv("TRADING_ENGINE_MODE", "shadow")
	t.Setenv("TRADING_ENGINE_ADDR", "")
	t.Setenv("TRADING_ENGINE_LOG_LEVEL", "")
	t.Setenv("TRADING_ENGINE_SHUTDOWN_TIMEOUT", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Addr != ":8081" || cfg.Mode != "shadow" || cfg.ShutdownTimeout != 10*time.Second {
		t.Fatalf("unexpected config: %+v", cfg)
	}
}
