# Architecture PR Checklist

## What changed?

- [ ] README overview
- [ ] Routing
- [ ] Bootstrap
- [ ] GSD PM
- [ ] UIUX
- [ ] QA
- [ ] AppSec
- [ ] Capability matrix
- [ ] Governance / evidence
- [ ] Security boundaries
- [ ] Diagrams
- [ ] Data YAML

## Required checks

- [ ] The change preserves `context loading != enforcement`.
- [ ] The change does not allow dynamic workflow to produce release verdicts.
- [ ] Active pentest remains manual-only and ROE-gated.
- [ ] Production active scan remains hard-refused.
- [ ] Evidence examples still match the documented schema.
