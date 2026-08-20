package arena

import (
	"context"
	"errors"
	"math/big"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/paper"
)

type PaperExecutor struct {
	engine  *paper.Engine
	service *paper.Service
}

func NewPaperExecutor(engine *paper.Engine, service *paper.Service) (*PaperExecutor, error) {
	if engine == nil || service == nil {
		return nil, errors.New("arena paper engine and service are required")
	}
	return &PaperExecutor{engine: engine, service: service}, nil
}

func (executor *PaperExecutor) Handle(ctx context.Context, bot Bot, event MarketEvent, signal Signal, state *RuntimeState) error {
	if state.Position != nil && event.ApplyFunding && event.FundingRate != "" {
		position, _, err := executor.engine.ApplyFunding(*state.Position, event.MarkPrice, event.FundingRate)
		if err != nil {
			return err
		}
		state.Position = &position
	}
	if state.Position != nil {
		mark, err := executor.engine.Mark(*state.Position, event.MarkPrice)
		if err != nil {
			return err
		}
		state.Equity, err = arenaEquity(bot.StartingBalance, state.RealizedPnL, mark.UnrealizedPnL, state.Position.EntryFee, state.Position.Funding)
		if err != nil {
			return err
		}
		if mark.TriggeredClose != "" {
			signal = Signal{Action: SignalClose, Liquidity: paper.Taker, CloseReason: mark.TriggeredClose}
		}
	}
	switch signal.Action {
	case SignalHold:
		return nil
	case SignalOpenLong, SignalOpenShort:
		if state.Position != nil {
			return errors.New("arena bot already has an open paper position")
		}
		side := paper.Long
		if signal.Action == SignalOpenShort {
			side = paper.Short
		}
		record, position, err := executor.service.Open(ctx, paper.OpenTradeRequest{
			TradingBotID: bot.ID, StrategyVersionID: bot.StrategyVersionID, Symbol: event.Symbol,
			Entry: paper.EntryRequest{
				Side: side, Quantity: signal.Quantity, MarkPrice: event.MarkPrice, LimitPrice: signal.LimitPrice,
				Liquidity: signal.Liquidity, Leverage: signal.Leverage, StopLoss: signal.StopLoss, TakeProfit: signal.TakeProfit,
			},
		})
		if err != nil {
			return err
		}
		state.Trade, state.Position = &record, &position
		state.Equity, err = arenaEquity(bot.StartingBalance, state.RealizedPnL, "0", position.EntryFee, position.Funding)
		return err
	case SignalClose:
		if state.Position == nil || state.Trade == nil {
			return errors.New("arena bot has no open paper position")
		}
		reason := signal.CloseReason
		if reason == "" {
			reason = paper.CloseManual
		}
		closed, result, err := executor.service.Close(ctx, *state.Trade, *state.Position, paper.ExitRequest{
			MarkPrice: event.MarkPrice, Liquidity: signal.Liquidity, Reason: reason,
		})
		if err != nil {
			return err
		}
		state.RealizedPnL, err = addDecimal(state.RealizedPnL, result.RealizedPnL)
		if err != nil {
			return err
		}
		state.Equity, err = addDecimal(bot.StartingBalance, state.RealizedPnL)
		state.Trade = &closed
		state.Position = nil
		return err
	default:
		return errors.New("arena strategy returned an invalid signal action")
	}
}

func arenaEquity(starting, realized, unrealized, entryFee, funding string) (string, error) {
	values := []string{starting, realized, unrealized, entryFee, funding}
	parsed := make([]*big.Rat, len(values))
	for index, value := range values {
		var ok bool
		parsed[index], ok = new(big.Rat).SetString(value)
		if !ok {
			return "", errors.New("arena equity contains an invalid decimal")
		}
	}
	equity := new(big.Rat).Add(parsed[0], parsed[1])
	equity.Add(equity, parsed[2]).Sub(equity, parsed[3]).Sub(equity, parsed[4])
	return equity.FloatString(18), nil
}

func addDecimal(left, right string) (string, error) {
	l, leftOK := new(big.Rat).SetString(left)
	r, rightOK := new(big.Rat).SetString(right)
	if !leftOK || !rightOK {
		return "", errors.New("arena decimal is invalid")
	}
	return new(big.Rat).Add(l, r).FloatString(18), nil
}
