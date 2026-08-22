package bot

import (
	"errors"
	"math/big"
	"strconv"
	"strings"
)

type ManagedExitInput struct {
	Side, EntryPrice, Quantity, StopLoss, FirstTarget, MarkPrice, MarketRegime string
	PartialTaken                                                               bool
	PartialFraction, TrailingStopBps                                           float64
}

type ManagedExitPlan struct {
	Action, Quantity, NewStop, Reason string
}

func PlanManagedExit(input ManagedExitInput) (ManagedExitPlan, error) {
	entry, entryOK := new(big.Rat).SetString(input.EntryPrice)
	quantity, quantityOK := new(big.Rat).SetString(input.Quantity)
	stop, stopOK := new(big.Rat).SetString(input.StopLoss)
	mark, markOK := new(big.Rat).SetString(input.MarkPrice)
	if !entryOK || !quantityOK || !stopOK || !markOK || entry.Sign() <= 0 || quantity.Sign() <= 0 || stop.Sign() <= 0 || mark.Sign() <= 0 || (input.Side != "BUY" && input.Side != "SELL") {
		return ManagedExitPlan{}, errors.New("managed exit input is invalid")
	}
	if input.PartialFraction <= 0 || input.PartialFraction >= 1 || input.TrailingStopBps <= 0 {
		return ManagedExitPlan{}, errors.New("managed exit configuration is invalid")
	}
	stopReached := (input.Side == "BUY" && mark.Cmp(stop) <= 0) || (input.Side == "SELL" && mark.Cmp(stop) >= 0)
	if stopReached {
		reason := "STOP_LOSS"
		if input.PartialTaken {
			reason = "TRAILING_STOP"
		}
		return ManagedExitPlan{Action: "CLOSE", Quantity: input.Quantity, Reason: reason}, nil
	}
	regime := strings.ToUpper(strings.TrimSpace(input.MarketRegime))
	if regime != "" && regime != "TREND" {
		return ManagedExitPlan{Action: "CLOSE", Quantity: input.Quantity, Reason: "REGIME_CHANGE"}, nil
	}
	if !input.PartialTaken {
		target, targetOK := new(big.Rat).SetString(input.FirstTarget)
		if !targetOK || target.Sign() <= 0 {
			return ManagedExitPlan{}, errors.New("managed exit first target is invalid")
		}
		targetReached := (input.Side == "BUY" && mark.Cmp(target) >= 0) || (input.Side == "SELL" && mark.Cmp(target) <= 0)
		if targetReached {
			fraction, _ := new(big.Rat).SetString(strconv.FormatFloat(input.PartialFraction, 'f', 8, 64))
			partial := new(big.Rat).Mul(quantity, fraction)
			return ManagedExitPlan{Action: "PARTIAL_TAKE_PROFIT", Quantity: partial.FloatString(18), NewStop: input.EntryPrice, Reason: "PARTIAL_TAKE_PROFIT"}, nil
		}
		return ManagedExitPlan{Action: "NONE"}, nil
	}
	rate, _ := new(big.Rat).SetString(strconv.FormatFloat(input.TrailingStopBps/10_000, 'f', 8, 64))
	one := big.NewRat(1, 1)
	candidate := new(big.Rat)
	if input.Side == "BUY" {
		candidate.Mul(mark, new(big.Rat).Sub(one, rate))
		if candidate.Cmp(stop) > 0 {
			return ManagedExitPlan{Action: "MOVE_STOP", NewStop: candidate.FloatString(18), Reason: "TRAILING_STOP_ADVANCE"}, nil
		}
	} else {
		candidate.Mul(mark, new(big.Rat).Add(one, rate))
		if candidate.Cmp(stop) < 0 {
			return ManagedExitPlan{Action: "MOVE_STOP", NewStop: candidate.FloatString(18), Reason: "TRAILING_STOP_ADVANCE"}, nil
		}
	}
	return ManagedExitPlan{Action: "NONE"}, nil
}
