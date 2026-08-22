package bot

import (
	"errors"
	"math/big"
	"strings"
)

// FixedRiskQuantity sizes an entry from capital, a constant risk fraction and
// the actual entry-to-stop distance. It deliberately has no win/loss input, so
// martingale-style sizing cannot influence the result.
func FixedRiskQuantity(capital, riskFraction, entry, stop string) (string, error) {
	capitalValue, capitalOK := new(big.Rat).SetString(strings.TrimSpace(capital))
	riskValue, riskOK := new(big.Rat).SetString(strings.TrimSpace(riskFraction))
	entryValue, entryOK := new(big.Rat).SetString(strings.TrimSpace(entry))
	stopValue, stopOK := new(big.Rat).SetString(strings.TrimSpace(stop))
	one := big.NewRat(1, 1)
	if !capitalOK || !riskOK || !entryOK || !stopOK || capitalValue.Sign() <= 0 || riskValue.Sign() <= 0 || riskValue.Cmp(one) > 0 || entryValue.Sign() <= 0 || stopValue.Sign() <= 0 {
		return "", errors.New("fixed-risk sizing input is invalid")
	}
	distance := new(big.Rat).Abs(new(big.Rat).Sub(entryValue, stopValue))
	if distance.Sign() == 0 {
		return "", errors.New("fixed-risk stop distance must be positive")
	}
	riskBudget := new(big.Rat).Mul(capitalValue, riskValue)
	return new(big.Rat).Quo(riskBudget, distance).FloatString(18), nil
}
