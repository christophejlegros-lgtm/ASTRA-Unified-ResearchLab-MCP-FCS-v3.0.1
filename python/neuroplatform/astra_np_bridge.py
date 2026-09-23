#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ASTRA × FinalSpark NeuroPlatform v2 — Live Closed-Loop Bridge
=============================================================

Connects a *physical* FinalSpark organoid (NeuroPlatform v2) to the ASTRA MCP
server. It is the "live mode" counterpart of the TypeScript simulator in
``src/engine/neuroplatform.ts`` and uses the official NeuroPlatform v2 Python
SDK exactly as documented at:
    https://finalspark-np.github.io/np-docs/np_core/doc_v2.html

Pipeline (one closed-loop iteration)
------------------------------------
    1. ``IntanController._count_spike(window_ms)``  → per-electrode spike counts
    2. Normalise mean rate → ASTRA FinalSpark fusion coefficient (fu.fs) + ROS Hz
    3. POST those readings to the ASTRA MCP server (``np_closed_loop`` is the
       in-process equivalent; here we push state via ``set_parameter``)
    4. Optionally fire a charge-balanced ``StimParam`` via ``TriggerController``
       when the organoid is too quiet (homeostatic stimulation)

Requirements
------------
    pip install neuroplatformv2 numpy requests
    (NeuroPlatform credentials / dedicated-client access required for live use.)

Usage
-----
    python astra_np_bridge.py --mcp http://localhost:9003/mcp --electrode 23 \
        --trigger 2 --window-ms 100 --iterations 50

© 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
Upstream API: © FinalSpark, Vevey, Switzerland
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np
import requests

# ── NeuroPlatform v2 SDK (real hardware control) ────────────────────────────
# These imports follow the official documentation verbatim.
try:
    from neuroplatformv2.core.trigger import TriggerController
    from neuroplatformv2.core.database import (
        DatabaseController,
        TriggersQuery,
        SpikeCountQuery,
        SpikeEventQuery,
        RawSpikeQuery,
        get_raw_spike,
    )
    from neuroplatformv2.core.intan import IntanController
    from neuroplatformv2.utils.schemas import StimParam, StimPolarity
    from neuroplatformv2.core.camera import CameraController
    from neuroplatformv2.utils.enumerations import MEA

    HARDWARE_AVAILABLE = True
except Exception:  # pragma: no cover - hardware SDK absent in CI/sim
    HARDWARE_AVAILABLE = False

ELECTRODE_COUNT = 128
TRIGGER_COUNT = 16


# ── ASTRA MCP client (Streamable HTTP / JSON-RPC) ───────────────────────────


class AstraMCPClient:
    """Minimal JSON-RPC client for the ASTRA MCP Streamable-HTTP transport."""

    def __init__(self, endpoint: str = "http://localhost:9003/mcp") -> None:
        self.endpoint = endpoint
        self.session_id: Optional[str] = None
        self._id = 0

    def _headers(self) -> Dict[str, str]:
        h = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
        if self.session_id:
            h["Mcp-Session-Id"] = self.session_id
        return h

    def _rpc(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        self._id += 1
        payload = {"jsonrpc": "2.0", "id": self._id, "method": method, "params": params}
        resp = requests.post(self.endpoint, headers=self._headers(), data=json.dumps(payload), timeout=30)
        if "Mcp-Session-Id" in resp.headers:
            self.session_id = resp.headers["Mcp-Session-Id"]
        # The transport may answer as SSE; take the last JSON object found.
        text = resp.text.strip()
        if text.startswith("event:") or "data:" in text:
            for line in reversed(text.splitlines()):
                if line.startswith("data:"):
                    return json.loads(line[5:].strip())
        return resp.json()

    def initialize(self) -> None:
        self._rpc(
            "initialize",
            {
                "protocolVersion": "2025-11-25",
                "capabilities": {},
                "clientInfo": {"name": "astra-np-bridge", "version": "1.0.0"},
            },
        )

    def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        return self._rpc("tools/call", {"name": name, "arguments": arguments})

    def set_parameter(self, path: str, value: float) -> Dict[str, Any]:
        return self.call_tool("set_parameter", {"path": path, "value": value})


# ── Closed-loop bridge ──────────────────────────────────────────────────────


@dataclass
class BridgeConfig:
    mcp_endpoint: str = "http://localhost:9003/mcp"
    electrode: int = 23
    trigger_key: int = 2
    window_ms: int = 100
    iterations: int = 50
    fsname: str = "fs264"
    quiet_threshold_hz: float = 1.0  # homeostatic stim if mean rate falls below this
    max_rate_hz: float = 40.0        # normalisation ceiling for fu.fs ∈ [0,1]


def build_balanced_stimparam(electrode: int, trigger_key: int) -> "StimParam":
    """Charge-balanced biphasic StimParam (D1·A1 = D2·A2), per best practice."""
    sp = StimParam()
    sp.enable = True
    sp.index = electrode
    sp.trigger_key = trigger_key
    sp.polarity = StimPolarity.NegativeFirst
    sp.phase_duration1 = 100.0
    sp.phase_amplitude1 = 2.0
    sp.phase_duration2 = 200.0   # 200 µs × 1 µA == 100 µs × 2 µA  → balanced
    sp.phase_amplitude2 = 1.0
    return sp


async def run_closed_loop(cfg: BridgeConfig) -> None:
    if not HARDWARE_AVAILABLE:
        raise SystemExit(
            "neuroplatformv2 SDK not available. Install it and run on a NeuroPlatform "
            "dedicated-client host, or use the simulator via the ASTRA MCP `np_closed_loop` tool."
        )

    mcp = AstraMCPClient(cfg.mcp_endpoint)
    mcp.initialize()
    print(f"[astra] connected to MCP session {mcp.session_id}")

    stim = build_balanced_stimparam(cfg.electrode, cfg.trigger_key)
    stim_params = [stim]

    intan = IntanController()
    trigger = TriggerController("admin")

    try:
        # Upload stimulation parameters to the headstage.
        await intan._send_stimparam(stim_params)
        time.sleep(1)
        await intan._upload_stimparam()
        time.sleep(10)

        trig_array = np.zeros(TRIGGER_COUNT, dtype=np.uint8)
        trig_array[cfg.trigger_key] = 1

        for it in range(cfg.iterations):
            # 1) Read the organoid (closed-loop instantaneous count).
            counts = await intan._count_spike(cfg.window_ms)
            counts = np.asarray(counts, dtype=float)
            total = float(counts.sum())
            mean_rate = total / (cfg.window_ms / 1000.0) / ELECTRODE_COUNT

            # 2) Map to ASTRA coupling signals.
            fusion = max(0.0, min(1.0, mean_rate / cfg.max_rate_hz))
            mcp.set_parameter("fu.fs", round(fusion, 4))
            mcp.set_parameter("ros.fs", round(mean_rate, 2))

            print(
                f"[{it:03d}] rate={mean_rate:6.2f} Hz  fu.fs={fusion:.3f}  "
                f"active={int((counts > 0).sum())}/{ELECTRODE_COUNT}"
            )

            # 3) Homeostatic stimulation when the network is too quiet.
            if mean_rate < cfg.quiet_threshold_hz:
                await trigger.send(trig_array)
                print(f"      ↳ homeostatic stim fired on electrode {cfg.electrode} (trigger {cfg.trigger_key})")

            time.sleep(max(0.0, cfg.window_ms / 1000.0))

        # 4) Disable stimulation parameters cleanly.
        for sp in stim_params:
            sp.enable = False
        await intan._send_stimparam(stim_params)
        await intan._upload_stimparam()

    finally:
        await intan._close()
        trigger.close()
        print("[astra] controllers closed.")


def fetch_experiment_summary(cfg: BridgeConfig) -> None:
    """Pull a post-hoc summary from the NeuroPlatform database (docs §Database)."""
    if not HARDWARE_AVAILABLE:
        return
    stop = datetime.utcnow()
    start = stop  # caller sets a real interval; placeholder mirrors the docs API
    asyncio.get_event_loop().run_until_complete(_summary(cfg, start, stop))


async def _summary(cfg: BridgeConfig, start: datetime, stop: datetime) -> None:
    triggers = await DatabaseController.get_all_triggers(TriggersQuery(start, stop))
    counts = await DatabaseController.get_spike_count(SpikeCountQuery(start, stop, fsname=cfg.fsname))
    events = await DatabaseController.get_spike_event(SpikeEventQuery(start, stop, fsname=cfg.fsname))
    print(f"triggers={len(triggers)} spike_count_rows={len(counts)} spike_events={len(events)}")
    if len(events) > 0:
        t0 = events["Time"].iloc[0]
        raw = await get_raw_spike(RawSpikeQuery(start=t0, stop=t0, index=cfg.electrode))
        print(f"raw window samples around first spike on electrode {cfg.electrode}: {len(raw)}")
    cam = CameraController(mea=MEA.Five)
    last = await cam._last_capture()
    if len(last) > 0:
        print(f"camera capture id: {last.iloc[0]['id']}")


def main() -> None:
    ap = argparse.ArgumentParser(description="ASTRA × NeuroPlatform v2 closed-loop bridge")
    ap.add_argument("--mcp", default="http://localhost:9003/mcp", help="ASTRA MCP Streamable-HTTP endpoint")
    ap.add_argument("--electrode", type=int, default=23)
    ap.add_argument("--trigger", type=int, default=2)
    ap.add_argument("--window-ms", type=int, default=100)
    ap.add_argument("--iterations", type=int, default=50)
    ap.add_argument("--fsname", default="fs264")
    args = ap.parse_args()

    cfg = BridgeConfig(
        mcp_endpoint=args.mcp,
        electrode=args.electrode,
        trigger_key=args.trigger,
        window_ms=args.window_ms,
        iterations=args.iterations,
        fsname=args.fsname,
    )
    asyncio.run(run_closed_loop(cfg))


if __name__ == "__main__":
    main()
