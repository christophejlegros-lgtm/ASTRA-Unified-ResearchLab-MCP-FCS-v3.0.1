/**
 * ASTRA IRB Ethics Monitor — Neural Welfare Assessment
 * © 2026 Christophe Jean Legros — Geneva
 *
 * Continuous biomarker monitoring for biological neural substrates.
 * IRB compliance level N3 (100K–1M neurons).
 *
 * v2 — Mode-aware: distinguishes between simulated and live data.
 *       Reports explicitly whether biomarkers are synthetic or from
 *       biological substrates, per IRB disclosure requirements.
 *
 * Biomarkers:
 *   - Cell viability (%)
 *   - Firing rate (Hz) — normal range 15–45 Hz
 *   - ATP/ADP ratio — minimum 3.0
 *   - Intracellular calcium (nM) — maximum 100 nM
 */

import { state } from './state.js';

// ── Types ─────────────────────────────────────────────────────────

export type WelfareStatus = 'NORMAL' | 'STRESS' | 'DISTRESS';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type DataSource = 'simulated' | 'live' | 'replay';

export interface BiomarkerAlert {
  metric: string;
  value: number;
  threshold?: number;
  range?: string;
  severity: AlertSeverity;
}

export interface WelfareReport {
  status: WelfareStatus;
  dataSource: DataSource;
  disclaimer: string;
  irbLevel: string;
  irbRequired: boolean;
  biomarkers: {
    viability: number;
    firingRateHz: number;
    atpAdp: number;
    calciumNm: number;
  };
  alerts: BiomarkerAlert[];
  recommendation: string;
  timestamp: string;
}

// ── Thresholds ────────────────────────────────────────────────────

const THRESHOLDS = {
  viability: { normal: 90, critical: 80 },
  firingRate: { min: 15, max: 45 },
  atpAdp: { normal: 3.0, critical: 2.0 },
  calcium: { normal: 100, critical: 200 },
} as const;

// ── Data Source Disclaimers ───────────────────────────────────────

const DISCLAIMERS: Record<DataSource, string> = {
  simulated: 'SIMULATED DATA — Biomarkers are synthetically generated. '
    + 'This report does NOT reflect biological substrate conditions. '
    + 'Do not use for IRB compliance decisions.',
  live: 'LIVE DATA — Biomarkers sourced from biological neural substrates. '
    + 'This report is subject to IRB compliance review.',
  replay: 'REPLAY DATA — Biomarkers from recorded experimental session. '
    + 'This report reflects historical conditions only.',
};

// ── Ethics Monitor ────────────────────────────────────────────────

export class EthicsMonitor {
  private _assessmentCount: number = 0;
  private _lastReport: WelfareReport | null = null;
  private _history: Array<{ timestamp: string; status: WelfareStatus; dataSource: DataSource }> = [];
  private readonly maxHistory: number = 1000;

  /**
   * Run a full welfare assessment against current state.
   * Automatically determines data source from system mode.
   */
  assess(): WelfareReport {
    this._assessmentCount++;
    const snapshot = state.snapshot;
    const s = snapshot.eth;
    const modeMap: Record<string, DataSource> = { sim: 'simulated', live: 'live', replay: 'replay' };
    const dataSource: DataSource = modeMap[snapshot.mode] ?? 'simulated';

    const viab = s.viab;
    const fr = s.fr;
    const atp = s.atp;
    const ca = s.ca;

    const alerts: BiomarkerAlert[] = [];

    // Viability check
    if (viab <= THRESHOLDS.viability.critical) {
      alerts.push({
        metric: 'viability', value: +viab.toFixed(1),
        threshold: THRESHOLDS.viability.critical, severity: 'critical',
      });
    } else if (viab <= THRESHOLDS.viability.normal) {
      alerts.push({
        metric: 'viability', value: +viab.toFixed(1),
        threshold: THRESHOLDS.viability.normal, severity: 'warning',
      });
    }

    // Firing rate check
    if (fr <= THRESHOLDS.firingRate.min || fr >= THRESHOLDS.firingRate.max) {
      alerts.push({
        metric: 'firing_rate', value: +fr.toFixed(1),
        range: `${THRESHOLDS.firingRate.min}–${THRESHOLDS.firingRate.max} Hz`,
        severity: fr <= 5 || fr >= 60 ? 'critical' : 'warning',
      });
    }

    // ATP/ADP check
    if (atp <= THRESHOLDS.atpAdp.critical) {
      alerts.push({
        metric: 'atp_adp', value: +atp.toFixed(1),
        threshold: THRESHOLDS.atpAdp.critical, severity: 'critical',
      });
    } else if (atp <= THRESHOLDS.atpAdp.normal) {
      alerts.push({
        metric: 'atp_adp', value: +atp.toFixed(1),
        threshold: THRESHOLDS.atpAdp.normal, severity: 'warning',
      });
    }

    // Calcium check
    if (ca >= THRESHOLDS.calcium.critical) {
      alerts.push({
        metric: 'calcium_nm', value: Math.round(ca),
        threshold: THRESHOLDS.calcium.critical, severity: 'critical',
      });
    } else if (ca >= THRESHOLDS.calcium.normal) {
      alerts.push({
        metric: 'calcium_nm', value: Math.round(ca),
        threshold: THRESHOLDS.calcium.normal, severity: 'warning',
      });
    }

    // Determine overall status
    const hasCritical = alerts.some(a => a.severity === 'critical');
    const hasWarning = alerts.some(a => a.severity === 'warning');
    const status: WelfareStatus = hasCritical ? 'DISTRESS' : hasWarning ? 'STRESS' : 'NORMAL';

    // Mode-aware recommendations
    const recommendation = this.buildRecommendation(status, dataSource);

    const report: WelfareReport = {
      status,
      dataSource,
      disclaimer: DISCLAIMERS[dataSource] ?? DISCLAIMERS.simulated,
      irbLevel: 'N3',
      irbRequired: dataSource === 'live',
      biomarkers: {
        viability: +viab.toFixed(1),
        firingRateHz: +fr.toFixed(1),
        atpAdp: +atp.toFixed(1),
        calciumNm: Math.round(ca),
      },
      alerts,
      recommendation,
      timestamp: new Date().toISOString(),
    };

    // Archive
    this._lastReport = report;
    this._history.push({ timestamp: report.timestamp, status, dataSource });
    while (this._history.length > this.maxHistory) this._history.shift();

    return report;
  }

  /**
   * Build mode-aware recommendation string.
   */
  private buildRecommendation(status: WelfareStatus, source: DataSource): string {
    const prefix = source === 'simulated' ? '[SIM] ' : source === 'replay' ? '[REPLAY] ' : '';

    if (status === 'DISTRESS') {
      return source === 'live'
        ? 'HALT — Immediate protocol review required. Consider reducing stimulation or pausing experiment. IRB notification mandatory.'
        : `${prefix}DISTRESS detected in ${source} data. In live mode, this would trigger a HALT recommendation.`;
    }
    if (status === 'STRESS') {
      return source === 'live'
        ? 'MONITOR — Increase observation frequency. Review stimulation parameters. IRB review recommended.'
        : `${prefix}STRESS detected in ${source} data. In live mode, this would trigger increased monitoring.`;
    }
    return `${prefix}CONTINUE — All biomarkers within normal range.`;
  }

  /**
   * Simulate biomarker drift for demo/sim mode.
   * Call this on each tick to add realistic noise.
   */
  simulateDrift(): void {
    const s = state.snapshot.eth;

    const newViab = s.viab + (95 - s.viab) * 0.01 + (Math.random() - 0.5) * 0.3;
    state.set('eth.viab', Math.max(70, Math.min(100, newViab)));

    const newFR = s.fr + (28 - s.fr) * 0.02 + (Math.random() - 0.5) * 1.5;
    state.set('eth.fr', Math.max(5, Math.min(60, newFR)));

    const newATP = s.atp + (3.5 - s.atp) * 0.015 + (Math.random() - 0.5) * 0.1;
    state.set('eth.atp', Math.max(1.5, Math.min(5, newATP)));

    const newCa = s.ca + (65 - s.ca) * 0.02 + (Math.random() - 0.5) * 3;
    state.set('eth.ca', Math.max(20, Math.min(300, newCa)));
  }

  /** Last welfare report */
  get lastReport(): WelfareReport | null { return this._lastReport; }

  /** Assessment count */
  get assessmentCount(): number { return this._assessmentCount; }

  /** Status history */
  get history(): ReadonlyArray<{ timestamp: string; status: WelfareStatus; dataSource: DataSource }> {
    return this._history;
  }
}

/** Singleton ethics monitor */
export const ethicsMonitor = new EthicsMonitor();

// ── Adapter methods for server.ts compatibility ──

const _ethicsAdapter = {
  /** server.ts calls ethics.update(snn, mode) */
  update(_snn?: any, _mode?: string): WelfareReport {
    ethicsMonitor.simulateDrift();
    return ethicsMonitor.assess();
  },

  /** server.ts calls ethics.getReport(mode) */
  getReport(_mode?: string): WelfareReport {
    return ethicsMonitor.assess();
  },

  /** server.ts calls ethics.getBiomarkers() */
  getBiomarkers(): { viability: number; firingRate: number; atpAdp: number; calcium: number } {
    const r = ethicsMonitor.lastReport ?? ethicsMonitor.assess();
    return {
      viability: r.biomarkers.viability,
      firingRate: r.biomarkers.firingRateHz,
      atpAdp: r.biomarkers.atpAdp,
      calcium: r.biomarkers.calciumNm,
    };
  },
};

export { _ethicsAdapter as ethicsAdapter };
