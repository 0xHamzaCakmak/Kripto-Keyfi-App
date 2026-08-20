package autonomousrisk

import (
	"math/big"
	"strings"
	"time"
)

type Policy struct {
	Enabled, GlobalKillSwitch, AccountKillSwitch                               bool
	MaxRiskPerTradePct, MaxDailyLossPct, MaxWeeklyLossPct, MaxDrawdownPct      string
	MaxLeverage, MaxConcurrentPositions, CooldownSeconds, MaxConsecutiveLosses int
	MaxTotalExposure, MaxSymbolExposure, MaxPositionSize, MinRiskReward        string
	StopLossRequired                                                           bool
	MarginModePolicy                                                           string
}

type Intent struct {
	Mode, Side, MarginMode, EntryPrice, StopLoss, TakeProfit, Quantity string
	Leverage                                                           int
	RiskReducing, OpensNewPosition                                     bool
}

type Snapshot struct {
	Equity, DailyLoss, WeeklyLoss, DrawdownPct                             string
	ProjectedTotalExposure, ProjectedSymbolExposure, ProjectedPositionSize string
	OpenPositions, ConsecutiveLosses                                       int
	LastFillAt                                                             *time.Time
	Now                                                                    time.Time
}

type Decision struct {
	Approved              bool
	Status, Code, Message string
	Metrics               map[string]any
}

func Evaluate(policy Policy, intent Intent, snapshot Snapshot) Decision {
	if intent.Mode != "PAPER" && intent.Mode != "SHADOW" {
		return block("RISK_MODE_UNSAFE", "Autonomous risk engine accepts only PAPER or SHADOW mode.", nil)
	}
	if intent.RiskReducing {
		return approve("RISK_REDUCING_EXIT", "Risk-reducing autonomous exit approved.", nil)
	}
	if policy.GlobalKillSwitch {
		return block("GLOBAL_KILL_SWITCH_ACTIVE", "Global emergency stop is active.", nil)
	}
	if !policy.Enabled {
		return block("RISK_PROFILE_DISABLED", "Autonomous risk profile is disabled.", nil)
	}
	if policy.AccountKillSwitch {
		return block("ACCOUNT_KILL_SWITCH_ACTIVE", "Account emergency stop is active.", nil)
	}
	if !validPolicy(policy) {
		return block("RISK_POLICY_INVALID", "Autonomous risk policy is invalid or incomplete.", nil)
	}
	if intent.Leverage < 1 || intent.Leverage > policy.MaxLeverage {
		return reject("RISK_MAX_LEVERAGE_EXCEEDED", "Autonomous leverage exceeds policy.", map[string]any{"leverage": intent.Leverage, "maximum": policy.MaxLeverage})
	}
	if policy.MarginModePolicy == "ISOLATED_ONLY" && intent.MarginMode != "ISOLATED" {
		return reject("RISK_MARGIN_MODE_POLICY", "Autonomous entries require isolated margin.", nil)
	}
	if policy.MarginModePolicy != "ISOLATED_ONLY" && policy.MarginModePolicy != "ALLOW_CROSS" {
		return block("RISK_POLICY_INVALID", "Margin mode policy is invalid.", nil)
	}
	if strings.TrimSpace(intent.StopLoss) == "" {
		return reject("RISK_STOP_LOSS_REQUIRED", "A stop loss is required for autonomous entries.", nil)
	}

	entry, eok := decimal(intent.EntryPrice)
	quantity, qok := decimal(intent.Quantity)
	equity, eqok := decimal(snapshot.Equity)
	dailyLoss, dlok := decimal(snapshot.DailyLoss)
	weeklyLoss, wlok := decimal(snapshot.WeeklyLoss)
	drawdown, ddok := decimal(snapshot.DrawdownPct)
	position, pok := decimal(snapshot.ProjectedPositionSize)
	total, tok := decimal(snapshot.ProjectedTotalExposure)
	symbol, sok := decimal(snapshot.ProjectedSymbolExposure)
	maxPosition, mpok := decimal(policy.MaxPositionSize)
	maxTotal, mtok := decimal(policy.MaxTotalExposure)
	maxSymbol, msok := decimal(policy.MaxSymbolExposure)
	if !eok || !qok || !eqok || !dlok || !wlok || !ddok || !pok || !tok || !sok || !mpok || !mtok || !msok || entry.Sign() <= 0 || quantity.Sign() <= 0 || equity.Sign() <= 0 || dailyLoss.Sign() < 0 || weeklyLoss.Sign() < 0 || drawdown.Sign() < 0 {
		return block("RISK_SNAPSHOT_INVALID", "Autonomous risk snapshot is incomplete or invalid.", nil)
	}
	metrics := map[string]any{"equity": text(equity), "projectedPositionSize": text(position), "projectedTotalExposure": text(total), "projectedSymbolExposure": text(symbol)}
	if position.Cmp(maxPosition) > 0 {
		return reject("RISK_MAX_POSITION_SIZE", "Autonomous position size exceeds policy.", metrics)
	}
	if total.Cmp(maxTotal) > 0 {
		return reject("RISK_MAX_TOTAL_EXPOSURE", "Total autonomous exposure exceeds policy.", metrics)
	}
	if symbol.Cmp(maxSymbol) > 0 {
		return reject("RISK_MAX_SYMBOL_EXPOSURE", "Symbol autonomous exposure exceeds policy.", metrics)
	}
	if intent.OpensNewPosition && snapshot.OpenPositions >= policy.MaxConcurrentPositions {
		return reject("RISK_MAX_CONCURRENT_POSITIONS", "Maximum autonomous concurrent positions reached.", metrics)
	}
	if exceedsRatio(snapshot.DailyLoss, snapshot.Equity, policy.MaxDailyLossPct) {
		return block("RISK_MAX_DAILY_LOSS", "Autonomous daily loss limit reached.", metrics)
	}
	if exceedsRatio(snapshot.WeeklyLoss, snapshot.Equity, policy.MaxWeeklyLossPct) {
		return block("RISK_MAX_WEEKLY_LOSS", "Autonomous weekly loss limit reached.", metrics)
	}
	if greater(snapshot.DrawdownPct, policy.MaxDrawdownPct) {
		return block("RISK_MAX_DRAWDOWN", "Autonomous drawdown limit reached.", metrics)
	}
	if policy.MaxConsecutiveLosses > 0 && snapshot.ConsecutiveLosses >= policy.MaxConsecutiveLosses {
		return block("RISK_CONSECUTIVE_LOSS_LOCK", "Autonomous consecutive-loss lock is active.", metrics)
	}
	if snapshot.LastFillAt != nil && policy.CooldownSeconds > 0 && snapshot.Now.Sub(*snapshot.LastFillAt) < time.Duration(policy.CooldownSeconds)*time.Second {
		return reject("RISK_COOLDOWN_ACTIVE", "Autonomous trade cooldown is active.", metrics)
	}

	stop, stopOK := decimal(intent.StopLoss)
	take, takeOK := decimal(intent.TakeProfit)
	if !stopOK || !takeOK {
		return reject("RISK_REWARD_UNAVAILABLE", "Stop loss and take profit are required to verify risk/reward.", metrics)
	}
	var riskDistance, rewardDistance *big.Rat
	if intent.Side == "BUY" && stop.Cmp(entry) < 0 && take.Cmp(entry) > 0 {
		riskDistance, rewardDistance = new(big.Rat).Sub(entry, stop), new(big.Rat).Sub(take, entry)
	} else if intent.Side == "SELL" && stop.Cmp(entry) > 0 && take.Cmp(entry) < 0 {
		riskDistance, rewardDistance = new(big.Rat).Sub(stop, entry), new(big.Rat).Sub(entry, take)
	} else {
		return reject("RISK_INVALID_PROTECTION", "Stop loss and take profit do not protect the requested side.", metrics)
	}
	riskAmount := new(big.Rat).Mul(riskDistance, quantity)
	riskPct := new(big.Rat).Quo(riskAmount, equity)
	maxRisk, maxRiskOK := decimal(policy.MaxRiskPerTradePct)
	minimumRR, rrOK := decimal(policy.MinRiskReward)
	rewardRatio := new(big.Rat).Quo(rewardDistance, riskDistance)
	if !maxRiskOK || !rrOK {
		return block("RISK_POLICY_INVALID", "Autonomous risk ratios are invalid.", metrics)
	}
	metrics["riskAmount"], metrics["riskPct"], metrics["riskReward"] = text(riskAmount), text(riskPct), text(rewardRatio)
	if riskPct.Cmp(maxRisk) > 0 {
		return reject("RISK_MAX_PER_TRADE", "Autonomous trade risk exceeds policy.", metrics)
	}
	if rewardRatio.Cmp(minimumRR) < 0 {
		return reject("RISK_MIN_REWARD_RATIO", "Autonomous trade risk/reward is below policy.", metrics)
	}
	return approve("RISK_APPROVED", "Autonomous intent passed immutable risk controls.", metrics)
}

func exceedsRatio(loss, equity, maximum string) bool {
	l, lok := decimal(loss)
	e, eok := decimal(equity)
	m, mok := decimal(maximum)
	return lok && eok && mok && e.Sign() > 0 && new(big.Rat).Quo(l, e).Cmp(m) > 0
}
func validPolicy(policy Policy) bool {
	ratios := []string{policy.MaxRiskPerTradePct, policy.MaxDailyLossPct, policy.MaxWeeklyLossPct, policy.MaxDrawdownPct}
	one := big.NewRat(1, 1)
	for _, value := range ratios {
		parsed, ok := decimal(value)
		if !ok || parsed.Sign() <= 0 || parsed.Cmp(one) > 0 {
			return false
		}
	}
	positiveDecimals := []string{policy.MaxTotalExposure, policy.MaxSymbolExposure, policy.MaxPositionSize, policy.MinRiskReward}
	for _, value := range positiveDecimals {
		parsed, ok := decimal(value)
		if !ok || parsed.Sign() <= 0 {
			return false
		}
	}
	return policy.MaxLeverage > 0 && policy.MaxConcurrentPositions > 0 && policy.CooldownSeconds >= 0 && policy.MaxConsecutiveLosses > 0 && policy.StopLossRequired
}
func greater(left, right string) bool {
	l, lok := decimal(left)
	r, rok := decimal(right)
	return lok && rok && l.Cmp(r) > 0
}
func decimal(value string) (*big.Rat, bool) { return new(big.Rat).SetString(strings.TrimSpace(value)) }
func text(value *big.Rat) string {
	return strings.TrimRight(strings.TrimRight(value.FloatString(18), "0"), ".")
}
func approve(code, message string, metrics map[string]any) Decision {
	return Decision{Approved: true, Status: "APPROVED", Code: code, Message: message, Metrics: metrics}
}
func reject(code, message string, metrics map[string]any) Decision {
	return Decision{Status: "REJECTED", Code: code, Message: message, Metrics: metrics}
}
func block(code, message string, metrics map[string]any) Decision {
	return Decision{Status: "SYSTEM_BLOCKED", Code: code, Message: message, Metrics: metrics}
}
