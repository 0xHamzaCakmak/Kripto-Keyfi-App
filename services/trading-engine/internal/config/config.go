package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"
)

type Config struct {
	Addr            string
	DatabaseURL     string
	InternalToken   string
	LogLevel        slog.Level
	MasterKey       string
	Mode            string
	Realtime        bool
	ShadowRead      bool
	ShutdownTimeout time.Duration
}

func Load() (Config, error) {
	level, err := parseLogLevel(valueOrDefault("TRADING_ENGINE_LOG_LEVEL", "info"))
	if err != nil {
		return Config{}, err
	}

	shutdownTimeout, err := time.ParseDuration(valueOrDefault("TRADING_ENGINE_SHUTDOWN_TIMEOUT", "10s"))
	if err != nil || shutdownTimeout <= 0 {
		return Config{}, errors.New("TRADING_ENGINE_SHUTDOWN_TIMEOUT must be a positive duration")
	}

	mode := strings.ToLower(strings.TrimSpace(valueOrDefault("TRADING_ENGINE_MODE", "shadow")))
	if mode != "shadow" && mode != "cutover" {
		return Config{}, fmt.Errorf("TRADING_ENGINE_MODE %q is not supported; use shadow or cutover", mode)
	}

	token := strings.TrimSpace(os.Getenv("TRADING_ENGINE_TOKEN"))
	if len(token) < 32 {
		return Config{}, errors.New("TRADING_ENGINE_TOKEN must contain at least 32 characters")
	}
	shadowRead, err := parseBoolean(valueOrDefault("TRADING_ENGINE_SHADOW_READ_ENABLED", "false"))
	if err != nil {
		return Config{}, err
	}
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	masterKey := strings.TrimSpace(os.Getenv("TRADING_CREDENTIALS_MASTER_KEY"))
	if shadowRead {
		if !strings.HasPrefix(databaseURL, "mysql://") {
			return Config{}, errors.New("DATABASE_URL must use mysql:// when shadow reads are enabled")
		}
		if len(masterKey) != 64 {
			return Config{}, errors.New("TRADING_CREDENTIALS_MASTER_KEY must be set when shadow reads are enabled")
		}
	}
	if mode == "cutover" && !shadowRead {
		return Config{}, errors.New("TRADING_ENGINE_MODE=cutover requires shadow reads and database ownership checks")
	}
	realtime, err := parseBoolean(valueOrDefault("TRADING_ENGINE_REALTIME_ENABLED", "false"))
	if err != nil {
		return Config{}, err
	}
	if realtime && !shadowRead {
		return Config{}, errors.New("TRADING_ENGINE_REALTIME_ENABLED=true requires shadow reads")
	}

	return Config{
		Addr:            valueOrDefault("TRADING_ENGINE_ADDR", ":8081"),
		DatabaseURL:     databaseURL,
		InternalToken:   token,
		LogLevel:        level,
		MasterKey:       masterKey,
		Mode:            mode,
		Realtime:        realtime,
		ShadowRead:      shadowRead,
		ShutdownTimeout: shutdownTimeout,
	}, nil
}

func parseBoolean(value string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "true":
		return true, nil
	case "false":
		return false, nil
	default:
		return false, fmt.Errorf("TRADING_ENGINE_SHADOW_READ_ENABLED must be true or false")
	}
}

func valueOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func parseLogLevel(value string) (slog.Level, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "debug":
		return slog.LevelDebug, nil
	case "info":
		return slog.LevelInfo, nil
	case "warn", "warning":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	default:
		return slog.LevelInfo, fmt.Errorf("unsupported TRADING_ENGINE_LOG_LEVEL %q", value)
	}
}
