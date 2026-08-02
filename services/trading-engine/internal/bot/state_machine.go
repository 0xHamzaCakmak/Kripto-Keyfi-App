package bot

import "fmt"

type State string

const (
	StateDraft            State = "DRAFT"
	StateValidating       State = "VALIDATING"
	StateStarting         State = "STARTING"
	StateRunning          State = "RUNNING"
	StatePaused           State = "PAUSED"
	StateStopped          State = "STOPPED"
	StateRiskBlocked      State = "RISK_BLOCKED"
	StateReconciling      State = "RECONCILING"
	StateEmergencyStopped State = "EMERGENCY_STOPPED"
	StateError            State = "ERROR"
)

var transitions = map[State]map[State]struct{}{
	StateDraft:            set(StateValidating),
	StateValidating:       set(StateStopped, StateRiskBlocked, StateError),
	StateStopped:          set(StateValidating, StateStarting, StateEmergencyStopped),
	StateStarting:         set(StateReconciling, StateRunning, StateRiskBlocked, StateStopped, StateError, StateEmergencyStopped),
	StateReconciling:      set(StateRunning, StateRiskBlocked, StateStopped, StateError, StateEmergencyStopped),
	StateRunning:          set(StatePaused, StateStopped, StateRiskBlocked, StateReconciling, StateError, StateEmergencyStopped),
	StatePaused:           set(StateStarting, StateStopped, StateEmergencyStopped),
	StateRiskBlocked:      set(StateValidating, StateStarting, StateStopped, StateError, StateEmergencyStopped),
	StateError:            set(StateValidating, StateStarting, StateStopped, StateEmergencyStopped),
	StateEmergencyStopped: set(StateStopped),
}

func CanTransition(from, to State) bool {
	if from == to {
		return true
	}
	_, ok := transitions[from][to]
	return ok
}

func ValidateTransition(from, to State) error {
	if !CanTransition(from, to) {
		return fmt.Errorf("invalid bot transition %s -> %s", from, to)
	}
	return nil
}

func set(states ...State) map[State]struct{} {
	result := make(map[State]struct{}, len(states))
	for _, state := range states {
		result[state] = struct{}{}
	}
	return result
}
