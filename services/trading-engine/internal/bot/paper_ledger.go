package bot

import (
	"errors"
	"math/big"
	"strconv"
)

const (
	DefaultPaperFeeBps      = 4.0
	DefaultPaperSlippageBps = 2.0
)

type PaperPosition struct {
	Symbol        string
	NetQuantity   string
	AvgEntryPrice string
	RealizedPnL   string
	TotalFees     string
}

type PaperExecution struct {
	Side          string
	Quantity      string
	MarkPrice     string
	FillPrice     string
	Notional      string
	Fee           string
	RealizedPnL   string
	SlippageBps   string
	FeeBps        string
	NetQuantity   string
	AvgEntryPrice string
	CumulativePnL string
	TotalFees     string
	UnrealizedPnL string
}

func ApplyPaperExecution(position PaperPosition, side, quantity, markPrice string, feeBps, slippageBps float64) (PaperExecution, error) {
	net, netOK := decimalOrZero(position.NetQuantity)
	entry, entryOK := decimalOrZero(position.AvgEntryPrice)
	realizedTotal, realizedOK := decimalOrZero(position.RealizedPnL)
	feesTotal, feesOK := decimalOrZero(position.TotalFees)
	qty, qtyOK := decimalRat(quantity)
	mark, markOK := decimalRat(markPrice)
	if !netOK || !entryOK || !realizedOK || !feesOK || !qtyOK || !markOK || qty.Sign() <= 0 || mark.Sign() <= 0 {
		return PaperExecution{}, errors.New("paper execution decimal is invalid")
	}
	if side != "BUY" && side != "SELL" {
		return PaperExecution{}, errors.New("paper execution side is invalid")
	}
	if feeBps < 0 || slippageBps < 0 {
		return PaperExecution{}, errors.New("paper execution costs cannot be negative")
	}

	fill := new(big.Rat).Set(mark)
	slippageRate := bpsRate(slippageBps)
	if side == "BUY" {
		fill.Mul(fill, new(big.Rat).Add(big.NewRat(1, 1), slippageRate))
	} else {
		fill.Mul(fill, new(big.Rat).Sub(big.NewRat(1, 1), slippageRate))
	}
	delta := new(big.Rat).Set(qty)
	if side == "SELL" {
		delta.Neg(delta)
	}
	notional := new(big.Rat).Mul(qty, fill)
	fee := new(big.Rat).Mul(notional, bpsRate(feeBps))
	fillRealized := new(big.Rat)
	newNet := new(big.Rat).Add(net, delta)
	newEntry := new(big.Rat).Set(entry)

	if net.Sign() == 0 || net.Sign() == delta.Sign() {
		oldCost := new(big.Rat).Mul(absRat(net), entry)
		newCost := new(big.Rat).Mul(qty, fill)
		newEntry.Quo(new(big.Rat).Add(oldCost, newCost), absRat(newNet))
	} else {
		closeQty := minRat(absRat(net), qty)
		if net.Sign() > 0 {
			fillRealized.Mul(new(big.Rat).Sub(fill, entry), closeQty)
		} else {
			fillRealized.Mul(new(big.Rat).Sub(entry, fill), closeQty)
		}
		switch {
		case newNet.Sign() == 0:
			newEntry.SetInt64(0)
		case newNet.Sign() != net.Sign():
			newEntry.Set(fill)
		}
	}

	newRealized := new(big.Rat).Add(realizedTotal, fillRealized)
	newFees := new(big.Rat).Add(feesTotal, fee)
	unrealized := paperUnrealized(newNet, newEntry, mark)
	return PaperExecution{
		Side: side, Quantity: decimalString(qty), MarkPrice: decimalString(mark), FillPrice: decimalString(fill),
		Notional: decimalString(notional), Fee: decimalString(fee), RealizedPnL: decimalString(fillRealized),
		SlippageBps: bpsString(slippageBps), FeeBps: bpsString(feeBps), NetQuantity: decimalString(newNet),
		AvgEntryPrice: decimalString(newEntry), CumulativePnL: decimalString(newRealized), TotalFees: decimalString(newFees),
		UnrealizedPnL: decimalString(unrealized),
	}, nil
}

func MarkPaperPosition(position PaperPosition, markPrice string) (string, error) {
	net, netOK := decimalOrZero(position.NetQuantity)
	entry, entryOK := decimalOrZero(position.AvgEntryPrice)
	mark, markOK := decimalRat(markPrice)
	if !netOK || !entryOK || !markOK || mark.Sign() <= 0 {
		return "", errors.New("paper mark decimal is invalid")
	}
	return decimalString(paperUnrealized(net, entry, mark)), nil
}

func paperUnrealized(net, entry, mark *big.Rat) *big.Rat {
	return new(big.Rat).Mul(new(big.Rat).Sub(mark, entry), net)
}

func decimalOrZero(value string) (*big.Rat, bool) {
	if value == "" {
		return new(big.Rat), true
	}
	return decimalRat(value)
}

func bpsRate(value float64) *big.Rat {
	parsed, _ := new(big.Rat).SetString(strconv.FormatFloat(value, 'f', 4, 64))
	return parsed.Quo(parsed, big.NewRat(10_000, 1))
}

func decimalString(value *big.Rat) string { return value.FloatString(18) }
func bpsString(value float64) string      { return strconv.FormatFloat(value, 'f', 4, 64) }
func absRat(value *big.Rat) *big.Rat      { return new(big.Rat).Abs(value) }
func minRat(left, right *big.Rat) *big.Rat {
	if left.Cmp(right) <= 0 {
		return new(big.Rat).Set(left)
	}
	return new(big.Rat).Set(right)
}
