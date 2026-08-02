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

func TestLoadAllowsPublicMarketBotSchedulerWithoutCredentialVault(t *testing.T) {
	t.Setenv("TRADING_ENGINE_TOKEN", "0123456789abcdef0123456789abcdef")
	t.Setenv("TRADING_ENGINE_BOT_SCHEDULER_ENABLED", "true")
	t.Setenv("TRADING_ENGINE_SHADOW_READ_ENABLED", "false")
	t.Setenv("DATABASE_URL", "mysql://user:pass@127.0.0.1:3306/app")
	t.Setenv("TRADING_CREDENTIALS_MASTER_KEY", "")
	config, err := Load()
	if err != nil || !config.BotScheduler || config.ShadowRead {
		t.Fatalf("public market scheduler should not require credentials: %#v, err=%v", config, err)
	}
}

func TestLoadKeepsAIObserverDisabledByDefault(t *testing.T) {
	t.Setenv("TRADING_ENGINE_TOKEN", "0123456789abcdef0123456789abcdef")
	t.Setenv("TRADING_ENGINE_AI_OBSERVER_ENABLED", "false")
	cfg, err := Load()
	if err != nil || cfg.AIObserver {
		t.Fatalf("AI observer must remain disabled by default: %#v, err=%v", cfg, err)
	}
}

func TestLoadRequiresSafeAIObserverConfiguration(t *testing.T) {
	t.Setenv("TRADING_ENGINE_TOKEN", "0123456789abcdef0123456789abcdef")
	t.Setenv("TRADING_ENGINE_MODE", "shadow")
	t.Setenv("TRADING_ENGINE_BOT_SCHEDULER_ENABLED", "true")
	t.Setenv("TRADING_ENGINE_SHADOW_READ_ENABLED", "false")
	t.Setenv("DATABASE_URL", "mysql://user:pass@127.0.0.1:3306/app")
	t.Setenv("TRADING_ENGINE_AI_OBSERVER_ENABLED", "true")
	t.Setenv("TRADING_ENGINE_AI_OBSERVER_URL", "https://observer.example.test/v1/signal")
	t.Setenv("TRADING_ENGINE_AI_OBSERVER_TOKEN", "0123456789abcdef0123456789abcdef")
	t.Setenv("TRADING_ENGINE_AI_OBSERVER_MODEL", "observer-model")
	cfg, err := Load()
	if err != nil || !cfg.AIObserver || cfg.AIObserverTimeout != 1500*time.Millisecond {
		t.Fatalf("valid AI observer configuration rejected: %#v, err=%v", cfg, err)
	}

	t.Setenv("TRADING_ENGINE_AI_OBSERVER_TIMEOUT", "3s")
	if _, err := Load(); err == nil {
		t.Fatal("observer timeout above scheduler safety limit must be rejected")
	}
}
