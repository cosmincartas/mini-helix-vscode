# Supervisor context for P5R-1: minimum supported runtime

This is context for the existing Task 5 correction, not a new requirement or user approval.

The installed VS Code 1.85.2 binary, run with its own `--ms-enable-electron-run-as-node` flag, reports Node v18.15.0. `process.report` has no `excludeNetwork` property. Assigning it to true does not disable network-interface reporting or reverse endpoint-name lookup: the isolated loopback probe still returns `localhost` and `networkInterfacesStillIncluded: true`.

[Observed output](minimum-runtime-probe.json). Probe script: `/tmp/helix-match-resume-20261024/minimum-runtime-probe.cjs`. It prints only these selected fields, not the report or environment.

The accepted P5R-1 fix must honor the existing no-network requirement on this minimum runtime too. Feature-detect actual support and use a non-networking alternative or an explicit bounded failure where safe detection is unavailable; simply adding an undeclared property is not a fix on Node 18. Preserve the original recovery and platform contracts. Source code has not been modified by the supervisor.
