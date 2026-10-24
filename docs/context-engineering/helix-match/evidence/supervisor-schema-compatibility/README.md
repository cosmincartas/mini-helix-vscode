# Routine fixture-schema compatibility alignment

Author: Codex supervisor `/root`. This is a small verification-metadata change under the existing request to finish the full implementation plan. It is separate from the Task 10 correction and changes no product/specification behavior. No new user approval is claimed, and no correction allowance is reset. The four earlier behavioral fixes remain unapplied and awaiting the actual user answer.

Task 7 already added 28 initial-state normalization cases with the `selection-identity` tag and empty `steps`. The oracle and its runner support these inputs; the published schema had not described them. Task 10's all-corpus schema check exposed that earlier drift.

Changes: add only the existing `selection-identity` tag to the closed tag enum; allow an empty `steps` array; document both forms. Other types, required fields, and unknown-property restrictions remain. No fixture contents or expected outcomes changed (all 14 case-file hashes checked unchanged during validation).

Verification: `corpus-validation.txt` records all 14 files / 940 cases valid. `negative-controls.txt` confirms rejection of non-string Git attributes/config, unknown input properties/tags, and non-array steps. `schema-compatibility.patch`, before-images, and `provenance.json` preserve the attributable delta. The source case count may grow with later native tasks; this result is dated evidence.

This cleanup should be included in the next focused independent metadata review. The runtime code and completed Task 10 behavioral correction are unaffected.
