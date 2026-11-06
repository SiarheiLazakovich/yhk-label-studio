#!/usr/bin/env python3
"""Builds ios/YHK Label Studio.shortcut: an iOS Shortcuts command that opens the Bluefy
browser (iOS browsers have no Web Bluetooth; Bluefy has it). iOS 15+ imports only signed
shortcuts, so the plist is signed with the macOS `shortcuts` tool:

    python3 tools/make-ios-shortcut.py

Requires macOS with an Apple ID signed in (used by `shortcuts sign`).
"""
import plistlib
import subprocess
import tempfile
from pathlib import Path

BLUEFY_BUNDLE = "con.pnn.ble-browser"  # Bluefy – Web BLE Browser, App Store id 1492822055
SITE = "https://siarheilazakovich.github.io/yhk-label-studio/"
OUT = Path(__file__).resolve().parent.parent / "ios" / "YHK Label Studio.shortcut"

workflow = {
    "WFWorkflowClientVersion": "2302.0.4",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowIcon": {"WFWorkflowIconStartColor": 463140863, "WFWorkflowIconGlyphNumber": 59511},
    "WFWorkflowImportQuestions": [],
    "WFWorkflowTypes": [],
    "WFWorkflowInputContentItemClasses": [],
    "WFWorkflowActions": [
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.comment",
            "WFWorkflowActionParameters": {
                "WFCommentActionText": "YHK Label Studio needs Web Bluetooth, which iOS browsers lack. "
                "This shortcut opens Bluefy, where the app prints. "
                f"Open {SITE} in Bluefy once so it comes back to it."
            },
        },
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.openapp",
            "WFWorkflowActionParameters": {
                "WFAppIdentifier": BLUEFY_BUNDLE,
                "WFSelectedApp": {"BundleIdentifier": BLUEFY_BUNDLE, "Name": "Bluefy", "TeamIdentifier": ""},
            },
        },
    ],
}

with tempfile.TemporaryDirectory() as tmp:
    unsigned = Path(tmp) / "unsigned.shortcut"
    unsigned.write_bytes(plistlib.dumps(workflow, fmt=plistlib.FMT_BINARY))
    OUT.parent.mkdir(exist_ok=True)
    subprocess.run(["shortcuts", "sign", "--mode", "anyone", "--input", str(unsigned), "--output", str(OUT)], check=True)
OUT.chmod(0o644)
print(f"signed shortcut: {OUT}")
