package paper

import (
	"errors"
	"math/big"
)

type Side string
type Liquidity string
type CloseReason string

const (
	Long  Side = "LONG"
	Short Side = "SHORT"

	Maker Liquidity = "MAKER"
	Taker Liquidity = "TAKER"

	CloseManual      CloseReason = "MANUAL"
	CloseStopLoss    CloseReason = "STOP_LOSS"
	CloseTakeProfit  CloseReason = "TAKE_PROFIT"
	CloseLiquidation CloseReason = "LIQUIDATION"
)

type FillConfig struct {
	MakerFeeBps           string
	TakerFeeBps           string
	SpreadBps             string
	SlippageBps           string
	PartialFillRatio      string
	TickSize              string
	LotSize               string
	MinimumQuantity       string
	MinimumNotional       string
	MaintenanceMarginRate string
}

func DefaultFillConfig() FillConfig {
	return FillConfig{
		MakerFeeBps: "2", TakerFeeBps: "4", SpreadBps: "2", SlippageBps: "2",
		PartialFillRatio: "1", TickSize: "0.01", LotSize: "0.001",
		MinimumQuantity: "0.001", MinimumNotional: "5", MaintenanceMarginRate: "0.005",
	}
}

type Engine struct{ config parsedConfig }

type parsedConfig struct {
	makerFee, takerFee, spread, slippage, partialFill   *big.Rat
	tickSize, lotSize, minimumQuantity, minimumNotional *big.Rat
	maintenanceMarginRate                               *big.Rat
}

type EntryRequest struct {
	Side       Side
	Quantity   string
	MarkPrice  string
	LimitPrice string
	Liquidity  Liquidity
	Leverage   int
	StopLoss   string
	TakeProfit string
}

type Position struct {
	Side             Side
	Quantity         string
	EntryPrice       string
	Leverage         int
	IsolatedMargin   string
	EntryFee         string
	Funding          string
	SlippageCost     string
	StopLoss         string
	TakeProfit       string
	LiquidationPrice string
}

type EntryResult struct {
	Position          Position
	RequestedQuantity string
	FilledQuantity    string
	Notional          string
	Fee               string
	FillPrice         string
}

type MarkResult struct {
	UnrealizedPnL  string
	Equity         string
	TriggeredClose CloseReason
}

type ExitRequest struct {
	MarkPrice string
	Liquidity Liquidity
	Reason    CloseReason
}

type ExitResult struct {
	ExitPrice    string
	ExitFee      string
	Fees         string
	Funding      string
	SlippageCost string
	GrossPnL     string
	RealizedPnL  string
	Reason       CloseReason
}

func NewEngine(config FillConfig) (*Engine, error) {
	values := []*string{
		&config.MakerFeeBps, &config.TakerFeeBps, &config.SpreadBps, &config.SlippageBps,
		&config.PartialFillRatio, &config.TickSize, &config.LotSize, &config.MinimumQuantity,
		&config.MinimumNotional, &config.MaintenanceMarginRate,
	}
	parsed := make([]*big.Rat, len(values))
	for index, value := range values {
		var ok bool
		parsed[index], ok = decimal(*value)
		if !ok || parsed[index].Sign() < 0 {
			return nil, errors.New("paper fill config contains an invalid decimal")
		}
	}
	if parsed[4].Sign() <= 0 || parsed[4].Cmp(one()) > 0 || parsed[5].Sign() <= 0 || parsed[6].Sign() <= 0 {
		return nil, errors.New("paper fill ratios and increments are invalid")
	}
	if parsed[0].Cmp(big.NewRat(10000, 1)) > 0 || parsed[1].Cmp(big.NewRat(10000, 1)) > 0 ||
		new(big.Rat).Add(new(big.Rat).Quo(parsed[2], big.NewRat(2, 1)), parsed[3]).Cmp(big.NewRat(10000, 1)) >= 0 {
		return nil, errors.New("paper fill costs are outside supported bounds")
	}
	if parsed[9].Cmp(one()) >= 0 {
		return nil, errors.New("maintenance margin rate must be below one")
	}
	return &Engine{config: parsedConfig{
		makerFee: parsed[0], takerFee: parsed[1], spread: parsed[2], slippage: parsed[3], partialFill: parsed[4],
		tickSize: parsed[5], lotSize: parsed[6], minimumQuantity: parsed[7], minimumNotional: parsed[8],
		maintenanceMarginRate: parsed[9],
	}}, nil
}

func (engine *Engine) Enter(request EntryRequest) (EntryResult, error) {
	quantity, quantityOK := decimal(request.Quantity)
	mark, markOK := decimal(request.MarkPrice)
	if !quantityOK || !markOK || quantity.Sign() <= 0 || mark.Sign() <= 0 {
		return EntryResult{}, errors.New("paper entry quantity and mark price must be positive decimals")
	}
	if request.Side != Long && request.Side != Short {
		return EntryResult{}, errors.New("paper entry side is invalid")
	}
	if request.Liquidity != Maker && request.Liquidity != Taker {
		return EntryResult{}, errors.New("paper entry liquidity is invalid")
	}
	if request.Leverage < 1 || request.Leverage > 125 {
		return EntryResult{}, errors.New("paper leverage is outside supported bounds")
	}
	filledQuantity := floorStep(new(big.Rat).Mul(quantity, engine.config.partialFill), engine.config.lotSize)
	if filledQuantity.Cmp(engine.config.minimumQuantity) < 0 {
		return EntryResult{}, errors.New("paper fill is below minimum quantity")
	}
	fillPrice, err := engine.fillPrice(request.Side, request.Liquidity, mark, request.LimitPrice)
	if err != nil {
		return EntryResult{}, err
	}
	notional := new(big.Rat).Mul(filledQuantity, fillPrice)
	if notional.Cmp(engine.config.minimumNotional) < 0 {
		return EntryResult{}, errors.New("paper fill is below minimum notional")
	}
	stop, takeProfit, err := validateProtection(request.Side, fillPrice, request.StopLoss, request.TakeProfit)
	if err != nil {
		return EntryResult{}, err
	}
	fee := new(big.Rat).Mul(notional, bps(engine.feeRate(request.Liquidity)))
	margin := new(big.Rat).Quo(notional, big.NewRat(int64(request.Leverage), 1))
	slippageCost := new(big.Rat).Mul(abs(new(big.Rat).Sub(fillPrice, mark)), filledQuantity)
	liquidation := engine.liquidationPrice(request.Side, fillPrice, request.Leverage)
	position := Position{
		Side: request.Side, Quantity: format(filledQuantity), EntryPrice: format(fillPrice), Leverage: request.Leverage,
		IsolatedMargin: format(margin), EntryFee: format(fee), Funding: format(zero()),
		SlippageCost: format(slippageCost), StopLoss: formatOptional(stop), TakeProfit: formatOptional(takeProfit),
		LiquidationPrice: format(liquidation),
	}
	return EntryResult{
		Position: position, RequestedQuantity: format(quantity), FilledQuantity: position.Quantity,
		Notional: format(notional), Fee: position.EntryFee, FillPrice: position.EntryPrice,
	}, nil
}

func (engine *Engine) Mark(position Position, markPrice string) (MarkResult, error) {
	quantity, entry, mark, margin, fee, funding, err := parsePosition(position, markPrice)
	if err != nil {
		return MarkResult{}, err
	}
	gross := directionalPnL(position.Side, entry, mark, quantity)
	equity := new(big.Rat).Sub(new(big.Rat).Add(margin, gross), new(big.Rat).Add(fee, funding))
	trigger := engine.trigger(position, mark)
	return MarkResult{UnrealizedPnL: format(gross), Equity: format(equity), TriggeredClose: trigger}, nil
}

func (engine *Engine) ApplyFunding(position Position, markPrice, fundingRate string) (Position, string, error) {
	quantity, _, mark, _, _, currentFunding, err := parsePosition(position, markPrice)
	if err != nil {
		return Position{}, "", err
	}
	rate, ok := decimal(fundingRate)
	if !ok {
		return Position{}, "", errors.New("paper funding rate is invalid")
	}
	payment := new(big.Rat).Mul(new(big.Rat).Mul(mark, quantity), rate)
	if position.Side == Short {
		payment.Neg(payment)
	}
	position.Funding = format(new(big.Rat).Add(currentFunding, payment))
	return position, format(payment), nil
}

func (engine *Engine) Exit(position Position, request ExitRequest) (ExitResult, error) {
	quantity, entry, mark, _, entryFee, funding, err := parsePosition(position, request.MarkPrice)
	if err != nil {
		return ExitResult{}, err
	}
	if request.Liquidity != Maker && request.Liquidity != Taker {
		return ExitResult{}, errors.New("paper exit liquidity is invalid")
	}
	if request.Reason != CloseManual && request.Reason != CloseStopLoss && request.Reason != CloseTakeProfit && request.Reason != CloseLiquidation {
		return ExitResult{}, errors.New("paper close reason is invalid")
	}
	exitSide := Long
	if position.Side == Long {
		exitSide = Short
	}
	exitPrice, err := engine.fillPrice(exitSide, request.Liquidity, mark, "")
	if err != nil {
		return ExitResult{}, err
	}
	notional := new(big.Rat).Mul(quantity, exitPrice)
	exitFee := new(big.Rat).Mul(notional, bps(engine.feeRate(request.Liquidity)))
	gross := directionalPnL(position.Side, entry, exitPrice, quantity)
	totalFees := new(big.Rat).Add(entryFee, exitFee)
	realized := new(big.Rat).Sub(new(big.Rat).Sub(gross, totalFees), funding)
	exitSlippage := new(big.Rat).Mul(abs(new(big.Rat).Sub(exitPrice, mark)), quantity)
	entrySlippage, ok := decimal(position.SlippageCost)
	if !ok {
		return ExitResult{}, errors.New("paper position slippage is invalid")
	}
	return ExitResult{
		ExitPrice: format(exitPrice), ExitFee: format(exitFee), Fees: format(totalFees), Funding: format(funding),
		SlippageCost: format(new(big.Rat).Add(entrySlippage, exitSlippage)), GrossPnL: format(gross),
		RealizedPnL: format(realized), Reason: request.Reason,
	}, nil
}

func (engine *Engine) fillPrice(side Side, liquidity Liquidity, mark *big.Rat, limit string) (*big.Rat, error) {
	if liquidity == Maker {
		price, ok := decimal(limit)
		if !ok || price.Sign() <= 0 {
			return nil, errors.New("maker paper fill requires a positive limit price")
		}
		if side == Long {
			return floorStep(price, engine.config.tickSize), nil
		}
		return ceilStep(price, engine.config.tickSize), nil
	}
	cost := new(big.Rat).Add(new(big.Rat).Quo(engine.config.spread, big.NewRat(2, 1)), engine.config.slippage)
	factor := new(big.Rat).Add(one(), bps(cost))
	if side == Short {
		factor.Sub(one(), bps(cost))
	}
	return roundPrice(new(big.Rat).Mul(mark, factor), engine.config.tickSize, side), nil
}

func (engine *Engine) feeRate(liquidity Liquidity) *big.Rat {
	if liquidity == Maker {
		return engine.config.makerFee
	}
	return engine.config.takerFee
}

func (engine *Engine) liquidationPrice(side Side, entry *big.Rat, leverage int) *big.Rat {
	initialMarginRate := new(big.Rat).Quo(one(), big.NewRat(int64(leverage), 1))
	if side == Long {
		return floorStep(new(big.Rat).Mul(entry, new(big.Rat).Add(new(big.Rat).Sub(one(), initialMarginRate), engine.config.maintenanceMarginRate)), engine.config.tickSize)
	}
	return ceilStep(new(big.Rat).Mul(entry, new(big.Rat).Sub(new(big.Rat).Add(one(), initialMarginRate), engine.config.maintenanceMarginRate)), engine.config.tickSize)
}

func (engine *Engine) trigger(position Position, mark *big.Rat) CloseReason {
	liquidation, _ := decimal(position.LiquidationPrice)
	stop, hasStop := decimal(position.StopLoss)
	takeProfit, hasTakeProfit := decimal(position.TakeProfit)
	if position.Side == Long {
		if mark.Cmp(liquidation) <= 0 {
			return CloseLiquidation
		}
		if hasStop && mark.Cmp(stop) <= 0 {
			return CloseStopLoss
		}
		if hasTakeProfit && mark.Cmp(takeProfit) >= 0 {
			return CloseTakeProfit
		}
	} else {
		if mark.Cmp(liquidation) >= 0 {
			return CloseLiquidation
		}
		if hasStop && mark.Cmp(stop) >= 0 {
			return CloseStopLoss
		}
		if hasTakeProfit && mark.Cmp(takeProfit) <= 0 {
			return CloseTakeProfit
		}
	}
	return ""
}

func validateProtection(side Side, entry *big.Rat, stopValue, takeValue string) (*big.Rat, *big.Rat, error) {
	stop, hasStop := decimal(stopValue)
	take, hasTake := decimal(takeValue)
	if stopValue != "" && (!hasStop || stop.Sign() <= 0) {
		return nil, nil, errors.New("paper stop loss is invalid")
	}
	if takeValue != "" && (!hasTake || take.Sign() <= 0) {
		return nil, nil, errors.New("paper take profit is invalid")
	}
	if side == Long && ((hasStop && stop.Cmp(entry) >= 0) || (hasTake && take.Cmp(entry) <= 0)) {
		return nil, nil, errors.New("long paper protection prices are invalid")
	}
	if side == Short && ((hasStop && stop.Cmp(entry) <= 0) || (hasTake && take.Cmp(entry) >= 0)) {
		return nil, nil, errors.New("short paper protection prices are invalid")
	}
	return stop, take, nil
}

func parsePosition(position Position, markValue string) (quantity, entry, mark, margin, fee, funding *big.Rat, err error) {
	if position.Side != Long && position.Side != Short {
		err = errors.New("paper position side is invalid")
		return
	}
	values := []string{position.Quantity, position.EntryPrice, markValue, position.IsolatedMargin, position.EntryFee, position.Funding}
	parsed := make([]*big.Rat, len(values))
	for index, value := range values {
		var ok bool
		parsed[index], ok = decimal(value)
		if !ok {
			err = errors.New("paper position contains an invalid decimal")
			return
		}
	}
	quantity, entry, mark, margin, fee, funding = parsed[0], parsed[1], parsed[2], parsed[3], parsed[4], parsed[5]
	if quantity.Sign() <= 0 || entry.Sign() <= 0 || mark.Sign() <= 0 {
		err = errors.New("paper position values must be positive")
	}
	return
}

func directionalPnL(side Side, entry, exit, quantity *big.Rat) *big.Rat {
	difference := new(big.Rat).Sub(exit, entry)
	if side == Short {
		difference.Neg(difference)
	}
	return difference.Mul(difference, quantity)
}

func decimal(value string) (*big.Rat, bool) {
	if value == "" {
		return nil, false
	}
	parsed, ok := new(big.Rat).SetString(value)
	return parsed, ok
}
func bps(value *big.Rat) *big.Rat {
	return new(big.Rat).Quo(new(big.Rat).Set(value), big.NewRat(10000, 1))
}
func one() *big.Rat                { return big.NewRat(1, 1) }
func zero() *big.Rat               { return new(big.Rat) }
func abs(value *big.Rat) *big.Rat  { return new(big.Rat).Abs(value) }
func format(value *big.Rat) string { return value.FloatString(18) }
func formatOptional(value *big.Rat) string {
	if value == nil {
		return ""
	}
	return format(value)
}
func floorStep(value, step *big.Rat) *big.Rat {
	ratio := new(big.Rat).Quo(value, step)
	units := new(big.Int).Quo(ratio.Num(), ratio.Denom())
	return new(big.Rat).Mul(new(big.Rat).SetInt(units), step)
}
func ceilStep(value, step *big.Rat) *big.Rat {
	floor := floorStep(value, step)
	if floor.Cmp(value) == 0 {
		return floor
	}
	return floor.Add(floor, step)
}
func roundPrice(value, step *big.Rat, side Side) *big.Rat {
	if side == Long {
		return ceilStep(value, step)
	}
	return floorStep(value, step)
}
