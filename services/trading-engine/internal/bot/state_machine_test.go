package bot

import "testing"

func TestStateMachineAllowsSafeLifecycle(t *testing.T) {
	path := []State{StateDraft, StateValidating, StateStopped, StateStarting, StateReconciling, StateRunning, StatePaused, StateStarting, StateRunning, StateStopped}
	for index := 1; index < len(path); index++ {
		if err := ValidateTransition(path[index-1], path[index]); err != nil {
			t.Fatalf("safe transition rejected: %v", err)
		}
	}
}

func TestStateMachineRejectsUnsafeLifecycle(t *testing.T) {
	for _, transition := range [][2]State{{StateDraft, StateRunning}, {StateStopped, StateRunning}, {StateEmergencyStopped, StateRunning}} {
		if CanTransition(transition[0], transition[1]) {
			t.Fatalf("unsafe transition accepted: %s -> %s", transition[0], transition[1])
		}
	}
}
