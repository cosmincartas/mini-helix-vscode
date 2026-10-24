# Proposed Task 5 startup-shutdown correction

Supervisor-authored proposal; **unapplied**. The Task 5 automatic correction allowance is spent. A further correction batch needs the pending user decision under `/sdd-cc`.

The Verification review found that shutting down while the init handshake is pending kills the child and rejects startup but leaves `state` as `starting`. The correction removed a final unconditional state assignment to protect a newer session; the shared teardown path currently updates state only after readiness.

The proposed one-line change updates `stopped` inside the existing current-session guard, including before readiness. It preserves the guard against a late old shutdown clobbering a new session. A process-backed regression test checks rejection, process exit, and state.

`shutdown-startup.patch` is reviewable and passes `git apply --check`. `shutdown-startup-red.txt` shows the added test fails against original source. `client-tests.txt` shows all 43 client tests, including four real-helper cases, pass with the proposal in an isolated copy. The real helper binary was copied to avoid concurrent build changes. Production source and tests remain unchanged; hashes and scratch location are in `proposal-state.json`.

These focused results are not an independent Verification review and do not resolve the task ledger by themselves.
