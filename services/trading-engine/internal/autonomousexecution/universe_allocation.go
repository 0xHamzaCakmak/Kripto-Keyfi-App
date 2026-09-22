package autonomousexecution

import (
	"errors"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/bot"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"math"
	"strconv"
)

func remainingUniverseAllocation(instance bot.Instance, allocation float64, positions []domain.Position, orders []domain.Order, side domain.PositionSide) (float64, error) {
	for _, position := range positions {
		if position.Symbol == instance.Symbol && (instance.Configuration["hedgeModeEnabled"] != true || position.Side == side) {
			continue
		}
		if !hasBotProtectionForSide(orders, position.Symbol, botClientPrefix(instance.ID), position.Side) {
			continue
		}
		quantity, qe := strconv.ParseFloat(string(position.Quantity), 64)
		price, pe := strconv.ParseFloat(string(position.EntryPrice), 64)
		leverage, le := strconv.ParseFloat(string(position.Leverage), 64)
		if qe != nil || pe != nil || le != nil || price <= 0 || leverage < 1 {
			return 0, errors.New("cannot verify existing universe position allocation")
		}
		used := math.Abs(quantity) * price
		if instance.Configuration["testnetMarginAllocationMode"] == true {
			used /= leverage
		}
		allocation -= used
	}
	return math.Max(0, allocation), nil
}
