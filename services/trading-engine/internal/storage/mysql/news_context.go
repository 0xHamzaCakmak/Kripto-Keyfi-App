package mysqlstore

import (
	"context"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/bot"
)

func (s *AccountStore) LoadRecentNewsContext(ctx context.Context, symbol string, now time.Time) (bot.NewsContext, error) {
	base := strings.ToUpper(strings.TrimSpace(symbol))
	for _, suffix := range []string{"USDT", "USDC", "BUSD", "USD"} {
		if strings.HasSuffix(base, suffix) && len(base) > len(suffix) {
			base = strings.TrimSuffix(base, suffix)
			break
		}
	}
	rows, err := s.database.QueryContext(ctx, `SELECT a.id, COALESCE(ai.marketImpact, ''), COALESCE(ai.whyItMatters, ''),
CAST(ai.confidence AS CHAR), a.publishedAt
FROM news_articles a
JOIN news_sources src ON src.id = a.sourceId AND src.isTrusted = TRUE AND src.isActive = TRUE
JOIN news_ai_summaries ai ON ai.articleId = a.id AND ai.needsReview = FALSE
JOIN news_article_coins coin ON coin.articleId = a.id
WHERE a.status = 'PUBLISHED' AND a.aiStatus = 'READY' AND ai.confidence >= 0.65
  AND a.publishedAt >= ? AND UPPER(coin.symbol) IN (?, ?)
ORDER BY a.publishedAt DESC LIMIT 20`, now.Add(-6*time.Hour), base, strings.ToUpper(symbol))
	if err != nil {
		return bot.NewsContext{}, err
	}
	defer rows.Close()
	total, confidenceTotal, weightedCount := 0.0, 0.0, 0
	ids := make([]string, 0, 20)
	var latest time.Time
	for rows.Next() {
		var id, impact, why, confidenceText string
		var publishedAt time.Time
		if err := rows.Scan(&id, &impact, &why, &confidenceText, &publishedAt); err != nil {
			return bot.NewsContext{}, err
		}
		confidence, parseErr := strconv.ParseFloat(confidenceText, 64)
		if parseErr != nil || confidence < 0.65 || confidence > 1 {
			continue
		}
		direction := classifyNewsText(impact + " " + why)
		if direction == 0 {
			continue
		}
		total += direction * confidence
		confidenceTotal += confidence
		weightedCount++
		ids = append(ids, id)
		if publishedAt.After(latest) {
			latest = publishedAt
		}
	}
	if err := rows.Err(); err != nil {
		return bot.NewsContext{}, err
	}
	if weightedCount == 0 {
		return bot.NewsContext{}, nil
	}
	score := math.Max(-1, math.Min(1, total/float64(weightedCount)))
	bias := "NEUTRAL"
	if score >= 0.20 {
		bias = "BULLISH"
	} else if score <= -0.20 {
		bias = "BEARISH"
	}
	sort.Strings(ids)
	return bot.NewsContext{Available: true, Bias: bias, Score: score, Confidence: confidenceTotal / float64(weightedCount), ArticleIDs: ids, ObservedAt: latest.UTC().Format(time.RFC3339)}, nil
}

func classifyNewsText(value string) float64 {
	text := strings.ToLower(value)
	bullish := []string{"bullish", "yükseliş", "artış", "ralli", "breakout", "onaylandı", "approved", "adoption", "benimsen", "inflow", "giriş", "partnership", "ortaklık", "upgrade", "yükseltme"}
	bearish := []string{"bearish", "düşüş", "azalış", "çöküş", "hack", "saldırı", "exploit", "yasak", "ban", "outflow", "çıkış", "dava", "lawsuit", "delist", "iflas", "bankruptcy"}
	up, down := 0, 0
	for _, token := range bullish {
		if strings.Contains(text, token) {
			up++
		}
	}
	for _, token := range bearish {
		if strings.Contains(text, token) {
			down++
		}
	}
	if up == down {
		return 0
	}
	if up > down {
		return 1
	}
	return -1
}

var _ interface {
	LoadRecentNewsContext(context.Context, string, time.Time) (bot.NewsContext, error)
} = (*AccountStore)(nil)
