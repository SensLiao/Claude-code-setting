#!/usr/bin/env python3
"""Edge-case round-trip tests for discoverability-sdk yaml_load/yaml_dump.
Tests BOTH the PyYAML path (when available) and the stdlib-only fallback
(by forcing _PYYAML=None). STOP_BUILDING follow-through (NATIVE-OVERLAP-AUDIT §6 #9)."""
import importlib.util, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("dsdk", os.path.join(HERE, "discoverability-sdk.py"))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

CASES = [
    {"gate_status": "PASS", "tag": "v1.0", "score": 87, "ok": True, "note": None},
    {"channels": ["seo", "ai-search"], "findings": [{"id": "F1", "sev": "high"}, {"id": "F2", "sev": "low"}]},
    {"unicode": "上线后被找到 / 可发现性", "nested": {"a": {"b": {"c": 1}}}},
    {"empty_list": [], "empty_map": {}, "zero": 0, "false": False},
    {"handoff": {"appsec": ["robots leak"], "qa": [], "gsd": ["replan"]}},
]

def run(label, force_fallback):
    saved = m._PYYAML
    if force_fallback:
        m._PYYAML = None
    pf = "fallback" if force_fallback else ("pyyaml" if saved else "fallback(no-pyyaml-installed)")
    npass = nfail = 0
    for i, case in enumerate(CASES):
        try:
            dumped = m.yaml_dump(case)
            loaded = m.yaml_load(dumped)
            if loaded == case:
                npass += 1
            else:
                nfail += 1
                print(f"  FAIL [{pf}] case {i}: {case!r} -> {loaded!r}\n    dumped:\n{dumped}")
        except Exception as e:
            nfail += 1
            print(f"  FAIL [{pf}] case {i}: exception {e!r}")
    m._PYYAML = saved
    print(f"  {label} [{pf}]: {npass} PASS / {nfail} FAIL")
    return nfail == 0

ok1 = run("primary path", force_fallback=False)
ok2 = run("stdlib fallback", force_fallback=True)
print("---")
print(f"PyYAML installed: {m._PYYAML is not None}")
sys.exit(0 if (ok1 and ok2) else 1)
