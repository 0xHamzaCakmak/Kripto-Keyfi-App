package arena

import (
	"errors"
	"sync"
)

type Registry struct {
	mutex      sync.RWMutex
	strategies map[string]Strategy
}

func NewRegistry() *Registry { return &Registry{strategies: make(map[string]Strategy)} }

func (registry *Registry) Register(strategyVersionID string, strategy Strategy) error {
	if strategyVersionID == "" || strategy == nil {
		return errors.New("strategy version and runtime are required")
	}
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	if _, exists := registry.strategies[strategyVersionID]; exists {
		return errors.New("strategy runtime is already registered")
	}
	registry.strategies[strategyVersionID] = strategy
	return nil
}

func (registry *Registry) Resolve(strategyVersionID string) (Strategy, error) {
	registry.mutex.RLock()
	strategy := registry.strategies[strategyVersionID]
	registry.mutex.RUnlock()
	if strategy == nil {
		return nil, errors.New("strategy runtime is not registered")
	}
	return strategy, nil
}
