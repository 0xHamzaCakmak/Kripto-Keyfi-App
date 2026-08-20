package paper

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"
)

type TradeRecord struct {
	ID                     string
	TradingBotID           string
	StrategyVersionID      string
	MarketRegimeSnapshotID *uint64
	Symbol                 string
	Side                   string
	Status                 string
	EntryPrice             string
	ExitPrice              string
	Quantity               string
	Leverage               int
	Fees                   string
	Funding                string
	SlippageCost           string
	RealizedPnL            string
	OpenedAt               time.Time
	ClosedAt               *time.Time
	StopLoss               string
	TakeProfit             string
	MaxFavorableExcursion  string
	MaxAdverseExcursion    string
	HoldingSeconds         *int64
	MarketContext          map[string]any
	CloseReason            string
	AIConfidence           *float64
	DecisionSummary        string
}

type TradeStore interface {
	CreatePaperTrade(context.Context, TradeRecord) error
	ClosePaperTrade(context.Context, TradeRecord) error
}

type Service struct {
	engine *Engine
	store  TradeStore
	now    func() time.Time
}

type OpenTradeRequest struct {
	TradingBotID           string
	StrategyVersionID      string
	MarketRegimeSnapshotID *uint64
	Symbol                 string
	Entry                  EntryRequest
	MarketContext          map[string]any
	AIConfidence           *float64
	DecisionSummary        string
}

func NewService(engine *Engine, store TradeStore) (*Service, error) {
	if engine == nil || store == nil {
		return nil, errors.New("paper engine and store are required")
	}
	return &Service{engine: engine, store: store, now: time.Now}, nil
}

func (service *Service) Open(ctx context.Context, request OpenTradeRequest) (TradeRecord, Position, error) {
	if request.TradingBotID == "" || request.Symbol == "" {
		return TradeRecord{}, Position{}, errors.New("paper trade bot and symbol are required")
	}
	entry, err := service.engine.Enter(request.Entry)
	if err != nil {
		return TradeRecord{}, Position{}, err
	}
	now := service.now().UTC()
	record := TradeRecord{
		ID: newTradeID(), TradingBotID: request.TradingBotID, StrategyVersionID: request.StrategyVersionID,
		MarketRegimeSnapshotID: request.MarketRegimeSnapshotID,
		Symbol:                 request.Symbol, Side: databaseSide(request.Entry.Side), Status: "OPEN",
		EntryPrice: entry.FillPrice, Quantity: entry.FilledQuantity, Leverage: request.Entry.Leverage,
		Fees: entry.Fee, Funding: entry.Position.Funding, SlippageCost: entry.Position.SlippageCost,
		RealizedPnL: format(zero()), OpenedAt: now,
		StopLoss: entry.Position.StopLoss, TakeProfit: entry.Position.TakeProfit,
		MaxFavorableExcursion: entry.Position.MaxFavorableExcursion,
		MaxAdverseExcursion:   entry.Position.MaxAdverseExcursion,
		MarketContext:         request.MarketContext, AIConfidence: request.AIConfidence, DecisionSummary: request.DecisionSummary,
	}
	if err := service.store.CreatePaperTrade(ctx, record); err != nil {
		return TradeRecord{}, Position{}, err
	}
	return record, entry.Position, nil
}

func (service *Service) Close(ctx context.Context, record TradeRecord, position Position, request ExitRequest) (TradeRecord, ExitResult, error) {
	exit, err := service.engine.Exit(position, request)
	if err != nil {
		return TradeRecord{}, ExitResult{}, err
	}
	now := service.now().UTC()
	record.Status = "CLOSED"
	if request.Reason == CloseLiquidation {
		record.Status = "LIQUIDATED"
	}
	record.ExitPrice, record.Fees, record.Funding = exit.ExitPrice, exit.Fees, exit.Funding
	record.SlippageCost, record.RealizedPnL, record.ClosedAt = exit.SlippageCost, exit.RealizedPnL, &now
	holding := int64(now.Sub(record.OpenedAt).Seconds())
	record.HoldingSeconds = &holding
	record.MaxFavorableExcursion, record.MaxAdverseExcursion = position.MaxFavorableExcursion, position.MaxAdverseExcursion
	record.CloseReason = string(request.Reason)
	if err := service.store.ClosePaperTrade(ctx, record); err != nil {
		return TradeRecord{}, ExitResult{}, err
	}
	return record, exit, nil
}

func databaseSide(side Side) string {
	if side == Long {
		return "BUY"
	}
	return "SELL"
}

func newTradeID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		panic("cryptographic randomness unavailable")
	}
	return "paper_" + hex.EncodeToString(bytes)
}
