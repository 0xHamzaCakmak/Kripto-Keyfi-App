package bot

// Bot TESTNET targets use gross return on initial margin. Manual position
// instructions retain their explicitly selected price-movement semantics.
func UsesROETakeProfit(configuration map[string]any) bool {
	return configuration["testnetExecutionProfile"] == true && configuration["takeProfitBasis"] != "PRICE"
}
