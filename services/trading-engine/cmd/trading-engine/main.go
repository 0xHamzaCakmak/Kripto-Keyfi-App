package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/bot"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/config"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/credential"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/execution"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/httpapi"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/realtime"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/reconciliation"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/shadow"
	mysqlstore "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/storage/mysql"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid trading engine configuration", "error", err)
		os.Exit(1)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel}))
	slog.SetDefault(logger)
	var shadowService *shadow.Service
	var executionService *execution.Service
	var store *mysqlstore.AccountStore
	if cfg.ShadowRead || cfg.BotScheduler {
		var vault *credential.Vault
		if cfg.ShadowRead {
			vault, err = credential.NewVault(cfg.MasterKey)
			if err != nil {
				logger.Error("credential vault initialization failed", "error", err)
				os.Exit(1)
			}
		}
		store, err = mysqlstore.Open(context.Background(), cfg.DatabaseURL, vault)
		if err != nil {
			logger.Error("shadow account store initialization failed", "error", err)
			os.Exit(1)
		}
		defer func() {
			if err := store.Close(); err != nil {
				logger.Warn("shadow account store close failed", "error", err)
			}
		}()
		if cfg.ShadowRead {
			shadowService = shadow.New(store, &http.Client{Timeout: 8 * time.Second}, exchange.DemoEndpoints())
			if cfg.Mode == "cutover" {
				executionService = execution.New(store, store, store, &http.Client{Timeout: 8 * time.Second}, exchange.DemoEndpoints())
			}
		}
	}

	server := httpapi.New(httpapi.Options{Addr: cfg.Addr, Logger: logger, Mode: cfg.Mode, Execution: executionService, Shadow: shadowService, Token: cfg.InternalToken})
	server.SetReady(false)

	signalContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errChannel := make(chan error, 1)
	go func() {
		logger.Info("trading engine started", "addr", cfg.Addr, "mode", cfg.Mode, "executor", executionService != nil, "shadow_read", cfg.ShadowRead)
		errChannel <- server.ListenAndServe()
	}()

	go func() {
		var worker *reconciliation.Worker
		if cfg.ShadowRead && store != nil {
			worker = reconciliation.New(reconciliation.Options{
				Store: store, Client: &http.Client{Timeout: 10 * time.Second},
				Endpoints: exchange.DemoEndpoints(), Logger: logger,
			})
			for signalContext.Err() == nil {
				startupContext, cancel := context.WithTimeout(signalContext, 45*time.Second)
				err := worker.Initialize(startupContext)
				cancel()
				if err == nil {
					break
				}
				logger.Error("startup reconciliation failed; engine remains unavailable", "error", err)
				timer := time.NewTimer(5 * time.Second)
				select {
				case <-signalContext.Done():
					timer.Stop()
					return
				case <-timer.C:
				}
			}
			if signalContext.Err() != nil {
				return
			}
			go worker.Run(signalContext)
			logger.Info("startup reconciliation completed")
		}
		server.SetReady(true)
		if cfg.BotScheduler && store != nil {
			owner := fmt.Sprintf("%s:%d", hostname(), os.Getpid())
			runner := bot.NewStrategyRunner(store, &http.Client{Timeout: 8 * time.Second}, exchange.DemoEndpoints())
			var observer bot.SignalObserver
			if cfg.AIObserver {
				createdObserver, observerErr := bot.NewHTTPObserver(bot.HTTPObserverOptions{
					Endpoint: cfg.AIObserverURL, Token: cfg.AIObserverToken, Provider: cfg.AIProvider,
					Model: cfg.AIModel, PromptVersion: cfg.AIPromptVersion, Client: &http.Client{Timeout: cfg.AIObserverTimeout},
				})
				if observerErr != nil {
					logger.Error("AI observer initialization failed", "error", observerErr)
					stop()
					return
				}
				observer = createdObserver
				logger.Info("comparison-only AI observer enabled", "provider", cfg.AIProvider, "model", cfg.AIModel, "prompt_version", cfg.AIPromptVersion)
			}
			scheduler := bot.NewScheduler(bot.Options{Store: store, Runner: runner, Observer: observer, Owner: owner, Logger: logger})
			go scheduler.Run(signalContext)
			logger.Info("shadow/paper bot scheduler enabled", "owner", owner)
		}
		if cfg.Realtime && store != nil {
			manager := realtime.New(realtime.Options{
				Store: store, Client: &http.Client{Timeout: 10 * time.Second},
				Endpoints: exchange.DemoEndpoints(), Logger: logger,
			})
			go manager.Run(signalContext)
			logger.Info("private realtime streams enabled")
		}
	}()

	select {
	case err := <-errChannel:
		if err != nil {
			logger.Error("trading engine stopped unexpectedly", "error", err)
			os.Exit(1)
		}
	case <-signalContext.Done():
		logger.Info("trading engine shutdown requested")
	}

	shutdownContext, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	if err := server.Shutdown(shutdownContext); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}
	logger.Info("trading engine stopped", "timestamp", time.Now().UTC())
}

func hostname() string {
	name, err := os.Hostname()
	if err != nil || name == "" {
		return "trading-engine"
	}
	return name
}
