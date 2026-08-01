package exchange

import (
	"math/big"
	"strings"
)

func IsNonZero(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	rational, ok := new(big.Rat).SetString(value)
	return ok && rational.Sign() != 0
}

func AddDecimal(left, right string) string {
	leftValue, leftOK := new(big.Rat).SetString(left)
	rightValue, rightOK := new(big.Rat).SetString(right)
	if !leftOK || !rightOK {
		return "0"
	}
	return formatRat(new(big.Rat).Add(leftValue, rightValue), max(decimalScale(left), decimalScale(right)))
}

func MultiplyDecimal(left, right string, maximumScale int) string {
	leftValue, leftOK := new(big.Rat).SetString(left)
	rightValue, rightOK := new(big.Rat).SetString(right)
	if !leftOK || !rightOK {
		return "0"
	}
	scale := min(decimalScale(left)+decimalScale(right), maximumScale)
	return formatRat(new(big.Rat).Mul(leftValue, rightValue), scale)
}

func decimalScale(value string) int {
	if index := strings.IndexByte(value, '.'); index >= 0 {
		return len(value) - index - 1
	}
	return 0
}

func formatRat(value *big.Rat, scale int) string {
	formatted := value.FloatString(scale)
	if strings.Contains(formatted, ".") {
		formatted = strings.TrimRight(strings.TrimRight(formatted, "0"), ".")
	}
	if formatted == "-0" || formatted == "" {
		return "0"
	}
	return formatted
}
