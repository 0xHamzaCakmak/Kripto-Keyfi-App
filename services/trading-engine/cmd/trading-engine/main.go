package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/config"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/credential"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/execution"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/httpapi"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/realtime"
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
	if cfg.ShadowRead {
		vault, err := credential.NewVault(cfg.MasterKey)
		if err != nil {
			logger.Error("credential vault initialization failed", "error", err)
			os.Exit(1)
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
		shadowService = shadow.New(store, &http.Client{Timeout: 8 * time.Second}, exchange.DemoEndpoints())
		if cfg.Mode == "cutover" {
			executionService = execution.New(store, store, &http.Client{Timeout: 8 * time.Second}, exchange.DemoEndpoints())
		}
	}

	server := httpapi.New(httpapi.Options{Addr: cfg.Addr, Logger: logger, Mode: cfg.Mode, Execution: executionService, Shadow: shadowService, Token: cfg.InternalToken})
	server.SetReady(true)

	errChannel := make(chan error, 1)
	go func() {
		logger.Info("trading engine started", "addr", cfg.Addr, "mode", cfg.Mode, "executor", executionService != nil, "shadow_read", cfg.ShadowRead)
		errChannel <- server.ListenAndServe()
	}()

	signalContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if cfg.Realtime && store != nil {
		manager := realtime.New(realtime.Options{
			Store: store, Client: &http.Client{Timeout: 10 * time.Second},
			Endpoints: exchange.DemoEndpoints(), Logger: logger,
		})
		go manager.Run(signalContext)
		logger.Info("private realtime streams enabled")
	}

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
