package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr              string
	DatabaseURL       string
	InternalToken     string
	LogLevel          slog.Level
	MasterKey         string
	Mode              string
	Realtime          bool
	ShadowRead        bool
	ShutdownTimeout   time.Duration
	BotScheduler      bool
	BotWorkers        int
	BotPollInterval   time.Duration
	AutonomousTestnet bool
	LiquidationStream bool
	LiquidationURL    string
	AIObserver        bool
	AIObserverURL     string
	AIObserverToken   string
	AIProvider        string
	AIModel           string
	AIPromptVersion   string
	AIObserverTimeout time.Duration
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
	botScheduler, err := parseBoolean(valueOrDefault("TRADING_ENGINE_BOT_SCHEDULER_ENABLED", "false"))
	if err != nil {
		return Config{}, err
	}
	if botScheduler && !shadowRead {
		if !strings.HasPrefix(databaseURL, "mysql://") {
			return Config{}, errors.New("DATABASE_URL must use mysql:// when bot scheduler is enabled")
		}
	}
	botWorkers, err := strconv.Atoi(valueOrDefault("TRADING_ENGINE_BOT_WORKERS", "8"))
	if err != nil || botWorkers < 1 || botWorkers > 32 {
		return Config{}, errors.New("TRADING_ENGINE_BOT_WORKERS must be between 1 and 32")
	}
	botPollInterval, err := time.ParseDuration(valueOrDefault("TRADING_ENGINE_BOT_POLL_INTERVAL", "250ms"))
	if err != nil || botPollInterval < 100*time.Millisecond || botPollInterval > 10*time.Second {
		return Config{}, errors.New("TRADING_ENGINE_BOT_POLL_INTERVAL must be between 100ms and 10s")
	}
	autonomousTestnet, err := parseBoolean(valueOrDefault("TRADING_ENGINE_AUTONOMOUS_TESTNET_ENABLED", "false"))
	if err != nil {
		return Config{}, err
	}
	if autonomousTestnet && (mode != "cutover" || !shadowRead || !botScheduler) {
		return Config{}, errors.New("autonomous testnet execution requires cutover mode, shadow reads and bot scheduler")
	}
	liquidationStream, err := parseBoolean(valueOrDefault("TRADING_ENGINE_LIQUIDATION_STREAM_ENABLED", "false"))
	if err != nil {
		return Config{}, err
	}
	if liquidationStream && !botScheduler {
		return Config{}, errors.New("liquidation stream requires bot scheduler")
	}
	aiObserver, err := parseBoolean(valueOrDefault("TRADING_ENGINE_AI_OBSERVER_ENABLED", "false"))
	if err != nil {
		return Config{}, err
	}
	aiTimeout, err := time.ParseDuration(valueOrDefault("TRADING_ENGINE_AI_OBSERVER_TIMEOUT", "1500ms"))
	if err != nil || aiTimeout <= 0 || aiTimeout > 2*time.Second {
		return Config{}, errors.New("TRADING_ENGINE_AI_OBSERVER_TIMEOUT must be positive and at most 2s")
	}
	aiURL := strings.TrimSpace(os.Getenv("TRADING_ENGINE_AI_OBSERVER_URL"))
	aiToken := strings.TrimSpace(os.Getenv("TRADING_ENGINE_AI_OBSERVER_TOKEN"))
	aiProvider := valueOrDefault("TRADING_ENGINE_AI_OBSERVER_PROVIDER", "HTTP_GATEWAY")
	aiModel := strings.TrimSpace(os.Getenv("TRADING_ENGINE_AI_OBSERVER_MODEL"))
	aiPromptVersion := valueOrDefault("TRADING_ENGINE_AI_OBSERVER_PROMPT_VERSION", "v1")
	if aiObserver {
		if mode != "shadow" || !botScheduler {
			return Config{}, errors.New("AI observer requires shadow mode and the bot scheduler")
		}
		if aiURL == "" || len(aiToken) < 32 || aiModel == "" {
			return Config{}, errors.New("enabled AI observer requires URL, 32-character token and model")
		}
	}

	return Config{
		Addr:              valueOrDefault("TRADING_ENGINE_ADDR", ":8081"),
		DatabaseURL:       databaseURL,
		InternalToken:     token,
		LogLevel:          level,
		MasterKey:         masterKey,
		Mode:              mode,
		Realtime:          realtime,
		ShadowRead:        shadowRead,
		ShutdownTimeout:   shutdownTimeout,
		BotScheduler:      botScheduler,
		BotWorkers:        botWorkers,
		BotPollInterval:   botPollInterval,
		AutonomousTestnet: autonomousTestnet,
		LiquidationStream: liquidationStream,
		LiquidationURL:    strings.TrimSpace(os.Getenv("TRADING_ENGINE_LIQUIDATION_STREAM_URL")),
		AIObserver:        aiObserver,
		AIObserverURL:     aiURL,
		AIObserverToken:   aiToken,
		AIProvider:        aiProvider,
		AIModel:           aiModel,
		AIPromptVersion:   aiPromptVersion,
		AIObserverTimeout: aiTimeout,
	}, nil
}

func parseBoolean(value string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "true":
		return true, nil
	case "false":
		return false, nil
	default:
		return false, fmt.Errorf("boolean configuration value %q must be true or false", value)
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
