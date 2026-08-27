package bot

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

const observerSchemaVersion = "trading-bot-observer-v1"

type HTTPObserverOptions struct {
	Endpoint, Token, Provider, Model, PromptVersion string
	Client                                          *http.Client
	Now                                             func() time.Time
}

type HTTPObserver struct {
	endpoint, token, provider, model, promptVersion string
	client                                          *http.Client
	now                                             func() time.Time
}

type observerRequest struct {
	SchemaVersion string `json:"schemaVersion"`
	Bot           struct {
		ID     string `json:"id"`
		Type   string `json:"type"`
		Mode   string `json:"mode"`
		Symbol string `json:"symbol"`
	} `json:"bot"`
	Market struct {
		MarkPrice      string `json:"markPrice"`
		ReferencePrice string `json:"referencePrice"`
	} `json:"market"`
	RuleDecision struct {
		Kind    string         `json:"kind"`
		Action  string         `json:"action"`
		Summary string         `json:"summary"`
		Metrics map[string]any `json:"metrics,omitempty"`
	} `json:"ruleDecision"`
	Constraints struct {
		AllowedActions      []string `json:"allowedActions"`
		ExecutionAllowed    bool     `json:"executionAllowed"`
		SubmittedToExchange bool     `json:"submittedToExchange"`
		ComparisonOnly      bool     `json:"comparisonOnly"`
	} `json:"constraints"`
}

type observerResponse struct {
	Action               string  `json:"action"`
	Confidence           float64 `json:"confidence"`
	Rationale            string  `json:"rationale"`
	InvalidationLevel    float64 `json:"invalidationLevel"`
	SuggestedLeverage    int     `json:"suggestedLeverage"`
	AgreesWithRuleEngine bool    `json:"agreesWithRuleEngine"`
	Provider             string  `json:"provider"`
	Model                string  `json:"model"`
	PromptVersion        string  `json:"promptVersion"`
	ExpiresInSeconds     int     `json:"expiresInSeconds"`
}

func NewHTTPObserver(options HTTPObserverOptions) (*HTTPObserver, error) {
	parsed, err := url.Parse(strings.TrimSpace(options.Endpoint))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && !(parsed.Scheme == "http" && (parsed.Hostname() == "127.0.0.1" || parsed.Hostname() == "localhost"))) {
		return nil, errors.New("AI observer endpoint must use HTTPS, except localhost development")
	}
	if parsed.User != nil {
		return nil, errors.New("AI observer endpoint must not contain credentials")
	}
	if len(strings.TrimSpace(options.Token)) < 32 {
		return nil, errors.New("AI observer token must contain at least 32 characters")
	}
	provider, model, promptVersion := strings.TrimSpace(options.Provider), strings.TrimSpace(options.Model), strings.TrimSpace(options.PromptVersion)
	if provider == "" || len(provider) > 80 || model == "" || len(model) > 120 || promptVersion == "" || len(promptVersion) > 80 {
		return nil, errors.New("AI observer provider, model and prompt version are required and must fit ledger limits")
	}
	client := options.Client
	if client == nil {
		client = &http.Client{Timeout: 1500 * time.Millisecond}
	}
	now := options.Now
	if now == nil {
		now = time.Now
	}
	return &HTTPObserver{endpoint: parsed.String(), token: strings.TrimSpace(options.Token), provider: provider, model: model, promptVersion: promptVersion, client: client, now: now}, nil
}

func (o *HTTPObserver) Observe(ctx context.Context, instance Instance, decision Decision) (*AIObservation, error) {
	payload := observerRequest{SchemaVersion: observerSchemaVersion}
	payload.Bot.ID, payload.Bot.Type, payload.Bot.Mode, payload.Bot.Symbol = instance.ID, instance.Type, instance.Mode, instance.Symbol
	payload.Market.MarkPrice, payload.Market.ReferencePrice = decision.MarkPrice, decision.ReferencePrice
	payload.RuleDecision.Kind, payload.RuleDecision.Action, payload.RuleDecision.Summary = decision.Kind, signalActionForObserver(decision.Kind), decision.Summary
	payload.RuleDecision.Metrics = decision.Metrics
	payload.Constraints.AllowedActions = []string{"HOLD", "BUY", "SELL"}
	level := strings.ToLower(strings.TrimSpace(stringValue(instance.Configuration["aiAutonomyLevel"])))
	payload.Constraints.ExecutionAllowed = level == "co_signal" || level == "autonomous"
	payload.Constraints.SubmittedToExchange = false
	payload.Constraints.ComparisonOnly = level == "advisory"
	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("encode AI observer request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, o.endpoint, bytes.NewReader(encoded))
	if err != nil {
		return nil, fmt.Errorf("create AI observer request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+o.token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Observer-Schema", observerSchemaVersion)
	response, err := o.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call AI observer: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
		return nil, fmt.Errorf("AI observer returned %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	var result observerResponse
	decoder := json.NewDecoder(io.LimitReader(response.Body, 64*1024))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&result); err != nil {
		return nil, fmt.Errorf("decode AI observer response: %w", err)
	}
	result.Action = strings.ToUpper(strings.TrimSpace(result.Action))
	result.Rationale = strings.TrimSpace(result.Rationale)
	if result.Action != "HOLD" && result.Action != "BUY" && result.Action != "SELL" {
		return nil, errors.New("AI observer action is not allowed")
	}
	if math.IsNaN(result.Confidence) || math.IsInf(result.Confidence, 0) || result.Confidence < 0 || result.Confidence > 1 {
		return nil, errors.New("AI observer confidence must be between 0 and 1")
	}
	if math.IsNaN(result.InvalidationLevel) || math.IsInf(result.InvalidationLevel, 0) || result.InvalidationLevel < 0 {
		return nil, errors.New("AI observer invalidation level must be a non-negative finite number")
	}
	if result.SuggestedLeverage < 0 || result.SuggestedLeverage > 125 {
		return nil, errors.New("AI observer suggested leverage must be between 0 and 125")
	}
	if utf8.RuneCountInString(result.Rationale) < 5 || utf8.RuneCountInString(result.Rationale) > 200 {
		return nil, errors.New("AI observer rationale must contain 5 to 200 characters")
	}
	if result.ExpiresInSeconds == 0 {
		result.ExpiresInSeconds = 60
	}
	if result.ExpiresInSeconds < 1 || result.ExpiresInSeconds > 900 {
		return nil, errors.New("AI observer expiry must be between 1 and 900 seconds")
	}
	provider, model, promptVersion := strings.TrimSpace(result.Provider), strings.TrimSpace(result.Model), strings.TrimSpace(result.PromptVersion)
	if provider == "" {
		provider = o.provider
	}
	if model == "" {
		model = o.model
	}
	if promptVersion == "" {
		promptVersion = o.promptVersion
	}
	if len(provider) > 80 || len(model) > 120 || len(promptVersion) > 80 {
		return nil, errors.New("AI observer provider metadata exceeds ledger limits")
	}
	return &AIObservation{Action: result.Action, Confidence: result.Confidence, Rationale: result.Rationale,
		InvalidationLevel: result.InvalidationLevel, SuggestedLeverage: result.SuggestedLeverage, AgreesWithRuleEngine: result.AgreesWithRuleEngine,
		Provider: provider, Model: model, PromptVersion: promptVersion,
		ExpiresAt: o.now().UTC().Add(time.Duration(result.ExpiresInSeconds) * time.Second)}, nil
}

func signalActionForObserver(kind string) string {
	switch kind {
	case "BUY", "GRID_BUY":
		return "BUY"
	case "SELL", "GRID_SELL":
		return "SELL"
	default:
		return "HOLD"
	}
}
