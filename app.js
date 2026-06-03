const STORAGE_KEY = "mix-design-studio-state-v1";
const META_KEY = "mix-design-studio-meta-v1";
const LOCAL_CASES_KEY = "mix-design-studio-local-cases-v1";
const API_ROOT = "";

const MATERIALS = [
  {
    key: "threeQuarterRock",
    label: '3/4" rock',
    description: "Coarse aggregate skeleton",
    effect: "Usually lowers fines content and can open the mix, pushing voids up if overused.",
  },
  {
    key: "halfRock",
    label: '1/2" rock',
    description: "Intermediate coarse aggregate",
    effect: "Helps bridge coarse and fine fractions; often moderates stability and density.",
  },
  {
    key: "crusherFines",
    label: "Crusher fines",
    description: "Fine aggregate filler fraction",
    effect: "Tightens the blend, usually reducing voids and improving compaction if balanced.",
  },
  {
    key: "sand",
    label: "Sand",
    description: "Natural or manufactured fine aggregate",
    effect: "Improves packing and workability, with a moderate effect on voids and finish.",
  },
  {
    key: "filler",
    label: "Filler",
    description: "Very fine mineral dust",
    effect: "Fills micro-voids and stiffens the matrix; too much can make the mix brittle.",
  },
  {
    key: "binder",
    label: "Binder",
    description: "Asphalt cement",
    effect: "Controls cohesion and durability; higher binder usually lowers voids and lifts stability to a point.",
  },
];

const METRICS = [
  { key: "voids", label: "Air voids", unit: "%" },
  { key: "compaction", label: "Compaction", unit: "%" },
  { key: "stability", label: "Stability", unit: "kN" },
];

const SIEVES = [
  { key: "oneInch", label: '1"' },
  { key: "threeQuarter", label: '3/4"' },
  { key: "half", label: '1/2"' },
  { key: "threeEighth", label: '3/8"' },
  { key: "no4", label: "No. 4" },
  { key: "no8", label: "No. 8" },
  { key: "no30", label: "No. 30" },
  { key: "no200", label: "No. 200" },
];

const GRADE_PROFILES = {
  threeQuarterRock: [8, 35, 88, 99, 100, 100, 100, 100],
  halfRock: [0, 10, 42, 92, 99, 100, 100, 100],
  crusherFines: [0, 0, 0, 18, 65, 92, 99, 100],
  sand: [0, 0, 0, 8, 28, 76, 96, 100],
  filler: [0, 0, 0, 0, 6, 26, 88, 100],
  binder: [100, 100, 100, 100, 100, 100, 100, 100],
};

const defaultState = {
  operatorId: "Plant A",
  caseName: "Morning batch",
  currentCaseId: null,
  designName: "Agreed mix design",
  recipeName: "Implemented recipe",
  targetMaterials: {
    threeQuarterRock: 26,
    halfRock: 18,
    crusherFines: 16,
    sand: 24,
    filler: 2,
    binder: 14,
  },
  actualMaterials: {
    threeQuarterRock: 31,
    halfRock: 14,
    crusherFines: 13,
    sand: 22,
    filler: 2,
    binder: 18,
  },
  targetResults: {
    voids: 4.0,
    compaction: 96.5,
    stability: 8.5,
  },
  actualResults: {
    voids: 5.6,
    compaction: 94.8,
    stability: 7.9,
  },
  sensitivities: {
    threeQuarterRock: { voids: 0.18, compaction: -0.14, stability: 0.05 },
    halfRock: { voids: 0.09, compaction: -0.07, stability: 0.03 },
    crusherFines: { voids: -0.16, compaction: 0.13, stability: 0.04 },
    sand: { voids: -0.07, compaction: 0.06, stability: 0.02 },
    filler: { voids: -0.10, compaction: 0.08, stability: 0.01 },
    binder: { voids: -0.22, compaction: 0.18, stability: 0.09 },
  },
  scenario: {
    threeQuarterRock: -2.0,
    halfRock: 0,
    crusherFines: 2.0,
    sand: 0,
    filler: 0,
    binder: 0,
  },
  manualRecommendation: {
    threeQuarterRock: 0,
    halfRock: 0,
    crusherFines: 0,
    sand: 0,
    filler: 0,
    binder: 0,
  },
  manualBalanceMode: "even",
  adjustable: {
    threeQuarterRock: true,
    halfRock: true,
    crusherFines: true,
    sand: false,
    filler: true,
    binder: true,
  },
  lockTotal: true,
};

const state = loadState();
let historyCases = [];
let apiOnline = true;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const metaRaw = localStorage.getItem(META_KEY);
    const base = structuredClone(defaultState);
    const merged = raw ? deepMerge(base, JSON.parse(raw)) : base;
    if (metaRaw) {
      const meta = JSON.parse(metaRaw);
      if (meta.operatorId) merged.operatorId = meta.operatorId;
      if (meta.caseName) merged.caseName = meta.caseName;
    }
    return merged;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveMeta() {
  try {
    localStorage.setItem(
      META_KEY,
      JSON.stringify({ operatorId: state.operatorId, caseName: state.caseName }),
    );
  } catch {
    // Meta persistence is optional.
  }
}

function deepMerge(base, incoming) {
  for (const key of Object.keys(incoming || {})) {
    const value = incoming[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      base[key] = deepMerge(base[key] || {}, value);
    } else {
      base[key] = value;
    }
  }
  return base;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveMeta();
  } catch {
    // Persistence is optional when the browser blocks local storage.
  }
}

function sumValues(obj) {
  return Object.values(obj).reduce((sum, value) => sum + Number(value || 0), 0);
}

function formatNumber(value, digits = 1) {
  return Number(value).toFixed(digits);
}

function percentDelta(current, target) {
  return current - target;
}

function normalizedShare(value, total) {
  if (!total) return 0;
  return (value / total) * 100;
}

function getAdjustableMaterialKeys() {
  return MATERIALS.filter((material) => state.adjustable[material.key]).map((material) => material.key);
}

function getManualBalanceMode() {
  return state.manualBalanceMode === "sensitivity" ? "sensitivity" : "even";
}

function getSensitivityWeight(materialKey) {
  return METRICS.reduce((sum, metric) => {
    const value = Number(state.sensitivities[materialKey]?.[metric.key] || 0);
    return sum + Math.abs(value);
  }, 0);
}

function getManualBalanceWeight(materialKey) {
  if (getManualBalanceMode() !== "sensitivity") {
    return 1;
  }
  return Math.max(0.0001, getSensitivityWeight(materialKey));
}

function redistributeManualDelta(delta, excludedKey) {
  const adjustableKeys = getAdjustableMaterialKeys().filter((key) => key !== excludedKey);
  if (!adjustableKeys.length || Math.abs(delta) < 1e-12) {
    return;
  }

  const weights = adjustableKeys.map((key) => getManualBalanceWeight(key));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const useFallback = totalWeight <= 0;

  adjustableKeys.forEach((key, index) => {
    const share = useFallback ? 1 / adjustableKeys.length : weights[index] / totalWeight;
    state.manualRecommendation[key] = Number(state.manualRecommendation[key] || 0) - delta * share;
  });
}

function parseLooseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rebalanceManualRecommendation(changedKey, nextValue) {
  const adjustableKeys = getAdjustableMaterialKeys();
  if (!adjustableKeys.includes(changedKey)) {
    state.manualRecommendation[changedKey] = 0;
    return;
  }

  const currentValue = Number(state.manualRecommendation[changedKey] || 0);
  const desiredValue = parseLooseNumber(nextValue);
  const delta = desiredValue - currentValue;
  state.manualRecommendation[changedKey] = desiredValue;
  redistributeManualDelta(delta, changedKey);
}

function buildSnapshot() {
  return {
    operatorId: state.operatorId,
    caseName: state.caseName,
    designName: state.designName,
    recipeName: state.recipeName,
    targetMaterials: structuredClone(state.targetMaterials),
    actualMaterials: structuredClone(state.actualMaterials),
    targetResults: structuredClone(state.targetResults),
    actualResults: structuredClone(state.actualResults),
    sensitivities: structuredClone(state.sensitivities),
    scenario: structuredClone(state.scenario),
    manualRecommendation: structuredClone(state.manualRecommendation),
    manualBalanceMode: state.manualBalanceMode,
    adjustable: structuredClone(state.adjustable),
    lockTotal: state.lockTotal,
    capturedAt: new Date().toISOString(),
  };
}

function applySnapshot(snapshot) {
  const merged = deepMerge(structuredClone(defaultState), snapshot || {});
  const toNumberMap = (obj) =>
    Object.fromEntries(Object.entries(obj || {}).map(([key, value]) => [key, Number(value)]));
  const toBooleanMap = (obj) =>
    Object.fromEntries(Object.entries(obj || {}).map(([key, value]) => [key, value === true || value === "true"]));
  state.operatorId = merged.operatorId || defaultState.operatorId;
  state.caseName = merged.caseName || defaultState.caseName;
  state.designName = merged.designName || defaultState.designName;
  state.recipeName = merged.recipeName || defaultState.recipeName;
  state.targetMaterials = toNumberMap(merged.targetMaterials);
  state.actualMaterials = toNumberMap(merged.actualMaterials);
  state.targetResults = toNumberMap(merged.targetResults);
  state.actualResults = toNumberMap(merged.actualResults);
  state.sensitivities = Object.fromEntries(
    Object.entries(merged.sensitivities || {}).map(([materialKey, metricMap]) => [
      materialKey,
      toNumberMap(metricMap),
    ]),
  );
  state.scenario = toNumberMap(merged.scenario);
  state.manualRecommendation = toNumberMap(merged.manualRecommendation);
  state.manualBalanceMode = merged.manualBalanceMode || defaultState.manualBalanceMode;
  state.adjustable = toBooleanMap(merged.adjustable);
  state.lockTotal = Boolean(merged.lockTotal);
  state.currentCaseId = merged.currentCaseId || null;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportSnapshotCsv(snapshot) {
  const rows = [["section", "key", "value"]];
  const addSection = (section, obj) => {
    Object.entries(obj).forEach(([key, value]) => rows.push([section, key, value]));
  };

  rows.push(["meta", "operatorId", snapshot.operatorId]);
  rows.push(["meta", "caseName", snapshot.caseName]);
  addSection("targetMaterials", snapshot.targetMaterials);
  addSection("actualMaterials", snapshot.actualMaterials);
  addSection("targetResults", snapshot.targetResults);
  addSection("actualResults", snapshot.actualResults);
  addSection("scenario", snapshot.scenario);
  addSection("manualRecommendation", snapshot.manualRecommendation);
  rows.push(["flags", "manualBalanceMode", snapshot.manualBalanceMode]);
  addSection("adjustable", snapshot.adjustable);
  Object.entries(snapshot.sensitivities).forEach(([materialKey, metricMap]) => {
    Object.entries(metricMap).forEach(([metricKey, value]) => {
      rows.push(["sensitivities", `${materialKey}.${metricKey}`, value]);
    });
  });
  rows.push(["flags", "lockTotal", snapshot.lockTotal]);
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function downloadText(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function apiGetCases() {
  const response = await fetch(`${API_ROOT}/api/cases?userId=${encodeURIComponent(state.operatorId)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.cases) ? data.cases : [];
}

async function apiSaveCase(payload) {
  const response = await fetch(`${API_ROOT}/api/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.case;
}

async function apiDeleteCase(id) {
  const response = await fetch(`${API_ROOT}/api/cases/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

function readLocalCases() {
  try {
    const raw = localStorage.getItem(LOCAL_CASES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCases(cases) {
  try {
    localStorage.setItem(LOCAL_CASES_KEY, JSON.stringify(cases));
  } catch {
    // local history is optional.
  }
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char === "\r") {
      continue;
    } else if (char === '"' && value === "") {
      quoted = true;
    } else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function snapshotFromCsv(text) {
  const rows = parseCsvRows(text);
  const [header, ...dataRows] = rows;
  if (!header || header[0] !== "section") {
    throw new Error("Unexpected CSV format.");
  }

  const snapshot = structuredClone(defaultState);
  const assign = (section, key, rawValue) => {
    if (section === "meta") {
      if (key === "operatorId") snapshot.operatorId = rawValue;
      if (key === "caseName") snapshot.caseName = rawValue;
      return;
    }
    if (section === "flags" && key === "lockTotal") {
      snapshot.lockTotal = rawValue === "true";
      return;
    }
    if (section === "flags" && key === "manualBalanceMode") {
      snapshot.manualBalanceMode = rawValue === "sensitivity" ? "sensitivity" : "even";
      return;
    }
    if (section === "sensitivities") {
      const [materialKey, metricKey] = key.split(".");
      if (snapshot.sensitivities[materialKey]) snapshot.sensitivities[materialKey][metricKey] = Number(rawValue);
      return;
    }
    if (snapshot[section] && typeof snapshot[section] === "object") {
      snapshot[section][key] = section === "adjustable" ? rawValue === "true" : Number(rawValue);
    }
  };

  for (const row of dataRows) {
    if (row.length < 3) continue;
    assign(row[0], row[1], row.slice(2).join(","));
  }

  return snapshot;
}

function createMaterialRows(container, kind) {
  const values = state[`${kind}Materials`];
  const total = sumValues(values);
  container.innerHTML = "";

  const list = document.createElement("div");
  list.className = "material-list";

  MATERIALS.forEach((material) => {
    const row = document.createElement("div");
    row.className = "row compact";

    const share = Number(values[material.key] || 0);
    row.innerHTML = `
      <div>
        <div class="label">${material.label}</div>
        <div class="subtle">${material.description}</div>
        <div class="subtle">${kind === "target" ? "Agreed design share" : "Implemented recipe share"}</div>
      </div>
      <div class="value-controls">
        <input class="slider" type="range" min="0" max="100" step="0.1" data-group="${kind}Materials" data-key="${material.key}" value="${formatNumber(share, 1)}" />
        <input class="input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-group="${kind}Materials" data-key="${material.key}" value="${formatNumber(share, 1)}" />
      </div>
      <div>
        <div class="subtle">Blend share</div>
        <strong>${formatNumber(normalizedShare(share, total), 1)}%</strong>
      </div>
      <div>
        <div class="bar-track" title="${formatNumber(share, 1)}%">
          <div class="bar-fill" style="width:${Math.max(0, Math.min(100, normalizedShare(share, total)))}%"></div>
        </div>
      </div>
    `;
    list.appendChild(row);
  });

  container.appendChild(list);
  const chip = document.getElementById(`${kind}-total`);
  chip.textContent = `Total = ${formatNumber(total, 1)}%`;
  chip.className = `chip ${Math.abs(total - 100) > 0.2 ? "danger" : "good"}`;
}

function createResultRows(container, kind) {
  const values = state[`${kind}Results`];
  container.innerHTML = "";

  const list = document.createElement("div");
  list.className = "result-list";

  METRICS.forEach((metric) => {
    const row = document.createElement("div");
    row.className = "row metric";
    row.innerHTML = `
      <div>
        <div class="label">${metric.label}</div>
        <div class="subtle">${kind === "target" ? "Desired outcome" : "Measured outcome"}</div>
      </div>
      <div>
        <input class="input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-group="${kind}Results" data-key="${metric.key}" value="${formatNumber(values[metric.key], 1)}" />
      </div>
      <div>
        <div class="subtle">Unit</div>
        <strong>${metric.unit}</strong>
      </div>
      <div>
        <div class="bar-track">
          <div class="bar-fill alt" style="width:${metric.key === "stability" ? Math.min(100, values[metric.key] * 10) : Math.min(100, values[metric.key] * 20)}%"></div>
        </div>
      </div>
    `;
    list.appendChild(row);
  });

  container.appendChild(list);
}

function renderSummary() {
  const summary = document.getElementById("summary-grid");
  const targetBlend = sumValues(state.targetMaterials);
  const actualBlend = sumValues(state.actualMaterials);
  const targetGap = targetBlend - 100;
  const actualGap = actualBlend - 100;
  const resultGap = state.actualResults.voids - state.targetResults.voids;
  const compGap = state.actualResults.compaction - state.targetResults.compaction;
  const stabGap = state.actualResults.stability - state.targetResults.stability;

  summary.innerHTML = [
    {
      label: "Blend total check",
      value: `${formatNumber(targetBlend, 1)}% / ${formatNumber(actualBlend, 1)}%`,
      note: `Target gap ${formatNumber(targetGap, 1)}% and actual gap ${formatNumber(actualGap, 1)}%.`,
    },
    {
      label: "Void delta",
      value: `${formatNumber(resultGap, 1)}%`,
      note: `${resultGap > 0 ? "Higher" : "Lower"} than target air voids.`,
    },
    {
      label: "Compaction delta",
      value: `${formatNumber(compGap, 1)}%`,
      note: `${compGap > 0 ? "Above" : "Below"} the target compaction level.`,
    },
    {
      label: "Stability delta",
      value: `${formatNumber(stabGap, 1)} kN`,
      note: `${stabGap > 0 ? "Stronger" : "Weaker"} than the target.`,
    },
  ]
    .map(
      (item) => `
        <article class="panel summary-card">
          <div class="summary-label">${item.label}</div>
          <div class="summary-value">${item.value}</div>
          <div class="summary-note">${item.note}</div>
        </article>
      `,
    )
    .join("");
}

function renderComparison() {
  const container = document.getElementById("comparison-table");
  const rows = METRICS.map((metric) => {
    const target = state.targetResults[metric.key];
    const actual = state.actualResults[metric.key];
    const delta = percentDelta(actual, target);
    const trendClass = Math.abs(delta) < 0.05 ? "" : delta < 0 ? "good" : "bad";
    return `
      <div class="compare-line">
        <div>
          <div class="label">${metric.label}</div>
          <div class="subtle">Target ${metric.unit}</div>
        </div>
        <div><strong>${formatNumber(target, 1)}</strong></div>
        <div><strong>${formatNumber(actual, 1)}</strong></div>
        <div class="trend ${trendClass}">${delta > 0 ? "+" : ""}${formatNumber(delta, 1)} ${metric.unit}</div>
      </div>
    `;
  }).join("");
  container.innerHTML = rows;
}

function renderSensitivity() {
  const container = document.getElementById("sensitivity-table");
  container.innerHTML = "";
  const list = document.createElement("div");
  list.className = "sensitivity-list";

  MATERIALS.forEach((material) => {
    const row = document.createElement("div");
    row.className = "row sensitivity";
    row.innerHTML = `
      <div>
        <div class="label">${material.label}</div>
        <div class="subtle">Sensitivity per 1% blend change</div>
      </div>
      ${METRICS.map((metric) => {
        const value = state.sensitivities[material.key][metric.key];
        return `
          <div>
            <div class="subtle">${metric.label}</div>
            <input class="input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-group="sensitivities.${material.key}" data-key="${metric.key}" value="${formatNumber(value, 2)}" />
          </div>
        `;
      }).join("")}
    `;
    list.appendChild(row);
  });

  container.appendChild(list);
}

function renderScenario() {
  const container = document.getElementById("scenario-table");
  container.innerHTML = "";
  const list = document.createElement("div");
  list.className = "scenario-list";

  MATERIALS.forEach((material) => {
    const row = document.createElement("div");
    row.className = "row scenario";
    row.innerHTML = `
      <div>
        <div class="label">${material.label}</div>
        <div class="subtle">${material.description}</div>
        <div class="subtle">Scenario delta vs actual recipe</div>
      </div>
      <div class="value-controls">
        <input class="slider" type="range" min="-10" max="10" step="0.1" data-group="scenario" data-key="${material.key}" value="${formatNumber(state.scenario[material.key], 1)}" />
        <input class="input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-group="scenario" data-key="${material.key}" value="${formatNumber(state.scenario[material.key], 1)}" />
      </div>
      <div>
        <div class="subtle">Selected</div>
        <strong>${state.adjustable[material.key] ? "Yes" : "No"}</strong>
      </div>
    `;
    list.appendChild(row);
  });

  container.appendChild(list);

  const predicted = predictResults(state.actualResults, state.scenario);
  document.getElementById("scenario-output").innerHTML = `
    <div class="label">Predicted result from this scenario</div>
    <div class="dual" style="margin-top:10px;">
      ${METRICS.map(
        (metric) => `
          <div class="row" style="grid-template-columns: 1.1fr 0.8fr 0.8fr;">
            <div>
              <div class="label">${metric.label}</div>
              <div class="subtle">Current ${formatNumber(state.actualResults[metric.key], 1)} ${metric.unit}</div>
            </div>
            <div><strong>${formatNumber(predicted[metric.key], 2)}</strong></div>
            <div class="${
              predicted[metric.key] <= state.targetResults[metric.key] && metric.key === "voids" ? "good" : ""
            }">${predicted[metric.key] - state.targetResults[metric.key] > 0 ? "+" : ""}${formatNumber(
          predicted[metric.key] - state.targetResults[metric.key],
          2,
        )}</div>
          </div>
        `,
      ).join("")}
    </div>
  `;
}

function predictResults(baseResults, deltas) {
  const predicted = structuredClone(baseResults);
  METRICS.forEach((metric) => {
    const change = MATERIALS.reduce((sum, material) => {
      const delta = Number(deltas[material.key] || 0);
      const sensitivity = Number(state.sensitivities[material.key][metric.key] || 0);
      return sum + delta * sensitivity;
    }, 0);
    predicted[metric.key] = Number(baseResults[metric.key]) + change;
  });
  return predicted;
}

function computeCombinedGradation(materials) {
  return SIEVES.map((sieve, index) => {
    const passing = MATERIALS.reduce((sum, material) => {
      const share = Number(materials[material.key] || 0);
      const profile = GRADE_PROFILES[material.key]?.[index] ?? 0;
      return sum + (share * profile) / 100;
    }, 0);
    return { sieve: sieve.label, passing };
  });
}

function gradationHint(targetCurve, actualCurve) {
  const gapBySieve = targetCurve.map((row, index) => ({
    sieve: row.sieve,
    gap: actualCurve[index].passing - row.passing,
  }));
  const largest = gapBySieve.reduce((best, row) => (Math.abs(row.gap) > Math.abs(best.gap) ? row : best), gapBySieve[0]);
  if (!largest) return "No gradation data available.";
  if (largest.gap > 0) {
    return `The actual blend is coarser at ${largest.sieve}. To move back toward target, increase finer fractions such as crusher fines, sand, or filler, and reduce the coarser stock that dominates that sieve gap.`;
  }
  return `The actual blend is finer at ${largest.sieve}. To move back toward target, shift some share from fines toward coarser aggregate such as 3/4\" rock or 1/2\" rock, then recheck voids and compaction.`;
}

function renderGradation() {
  const container = document.getElementById("gradation-table");
  const targetCurve = computeCombinedGradation(state.targetMaterials);
  const actualCurve = computeCombinedGradation(state.actualMaterials);

  container.innerHTML = `
    <div class="gradation-grid">
      ${SIEVES.map((sieve, index) => {
        const target = targetCurve[index].passing;
        const actual = actualCurve[index].passing;
        const gap = actual - target;
        return `
          <div class="gradation-row">
            <div class="gradation-label">
              <div class="label">${sieve.label}</div>
              <div class="subtle">Combined percent passing</div>
            </div>
            <div class="gradation-bars">
              <div class="gradation-bar">
                <span class="subtle">Target</span>
                <div class="bar-track">
                  <div class="bar-fill" style="width:${Math.max(0, Math.min(100, target))}%"></div>
                </div>
                <strong>${formatNumber(target, 1)}%</strong>
              </div>
              <div class="gradation-bar">
                <span class="subtle">Actual</span>
                <div class="bar-track">
                  <div class="bar-fill alt" style="width:${Math.max(0, Math.min(100, actual))}%"></div>
                </div>
                <strong>${formatNumber(actual, 1)}%</strong>
              </div>
            </div>
            <div class="gradation-gap ${Math.abs(gap) < 0.2 ? "good" : gap > 0 ? "danger" : "good"}">
              ${gap > 0 ? "+" : ""}${formatNumber(gap, 1)}%
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  document.getElementById("gradation-insight").innerHTML = `
    <div class="recommendation-block">
      <strong>Gradation insight</strong><br />
      ${gradationHint(targetCurve, actualCurve)}
    </div>
  `;
}

function renderAdjustmentPanel() {
  const container = document.getElementById("adjustment-panel");
  const adjustableMaterials = MATERIALS.filter((material) => state.adjustable[material.key]);
  const recommendation = computeRecommendation();
  const totalRecommendation = recommendation.reduce((sum, item) => sum + item.delta, 0);

  const rows = recommendation
    .map((item) => {
      const material = MATERIALS.find((entry) => entry.key === item.key);
      return `
        <div class="row adjustment">
          <div>
            <div class="label">${material.label}</div>
            <div class="subtle">${state.adjustable[item.key] ? "Adjustable" : "Locked"}</div>
            <div class="subtle">${material.effect}</div>
          </div>
          <div>
            <div class="subtle">Recommended shift</div>
            <strong class="${item.delta >= 0 ? "good" : "danger"}">${item.delta > 0 ? "+" : ""}${formatNumber(item.delta, 2)}%</strong>
          </div>
          <div>
            <div class="subtle">Current share</div>
            <strong>${formatNumber(state.actualMaterials[item.key], 1)}%</strong>
          </div>
          <div>
            <label class="toggle">
              <input type="checkbox" data-adjustable="${item.key}" ${state.adjustable[item.key] ? "checked" : ""} />
              Use
            </label>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="note">
      The solver uses the target-vs-actual result gap and the sensitivity map to recommend
      a blend shift. Use it as a guided adjustment, then validate against lab and plant data.
    </div>
    <div class="adjustment-list">${rows}</div>
    <div class="note" style="margin-top:16px;">
      Adjustment sum: <strong>${formatNumber(totalRecommendation, 2)}%</strong>
      ${Math.abs(totalRecommendation) < 0.1 ? "The total remains balanced." : "The solver keeps the recipe balanced by design."}
    </div>
  `;

  const lock = document.getElementById("lock-total");
  lock.checked = state.lockTotal;
}

function getFinalRecommendation() {
  const solverRecommendation = computeRecommendation();
  return solverRecommendation.map((item) => ({
    key: item.key,
    delta: item.delta + Number(state.manualRecommendation[item.key] || 0),
  }));
}

function computeRecommendation() {
  const activeMaterials = MATERIALS.filter((material) => state.adjustable[material.key]);
  if (!activeMaterials.length) {
    return MATERIALS.map((material) => ({ key: material.key, delta: 0 }));
  }

  const n = activeMaterials.length;
  const m = METRICS.length;
  const A = Array.from({ length: m }, () => Array(n).fill(0));
  const b = METRICS.map((metric) => state.targetResults[metric.key] - state.actualResults[metric.key]);

  for (let r = 0; r < m; r += 1) {
    const metric = METRICS[r];
    for (let c = 0; c < n; c += 1) {
      const material = activeMaterials[c];
      A[r][c] = Number(state.sensitivities[material.key][metric.key] || 0);
    }
  }

  const lambda = 0.05;
  let solution;

  if (state.lockTotal) {
    const size = n + 1;
    const K = Array.from({ length: size }, () => Array(size).fill(0));
    const rhs = Array(size).fill(0);

    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        let sum = 0;
        for (let r = 0; r < m; r += 1) {
          sum += A[r][i] * A[r][j];
        }
        K[i][j] = 2 * sum + (i === j ? 2 * lambda : 0);
      }
      K[i][n] = 1;
      K[n][i] = 1;

      let cross = 0;
      for (let r = 0; r < m; r += 1) {
        cross += A[r][i] * b[r];
      }
      rhs[i] = 2 * cross;
    }

    solution = solveLinearSystem(K, rhs);
  } else {
    const K = Array.from({ length: n }, () => Array(n).fill(0));
    const rhs = Array(n).fill(0);
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        let sum = 0;
        for (let r = 0; r < m; r += 1) {
          sum += A[r][i] * A[r][j];
        }
        K[i][j] = 2 * sum + (i === j ? 2 * lambda : 0);
      }
      let cross = 0;
      for (let r = 0; r < m; r += 1) {
        cross += A[r][i] * b[r];
      }
      rhs[i] = 2 * cross;
    }
    solution = solveLinearSystem(K, rhs);
  }

  const deltas = activeMaterials.map((material, index) => ({
    key: material.key,
    delta: solution ? solution[index] : 0,
  }));

  MATERIALS.forEach((material) => {
    if (!state.adjustable[material.key]) {
      deltas.push({ key: material.key, delta: 0 });
    }
  });

  const byKey = Object.fromEntries(deltas.map((item) => [item.key, item.delta]));
  return MATERIALS.map((material) => ({ key: material.key, delta: Number(byKey[material.key] || 0) }));
}

function solveLinearSystem(matrix, rhs) {
  const n = matrix.length;
  const aug = matrix.map((row, i) => [...row, rhs[i]]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) pivot = row;
    }
    if (Math.abs(aug[pivot][col]) < 1e-10) return null;
    if (pivot !== col) {
      [aug[pivot], aug[col]] = [aug[col], aug[pivot]];
    }

    const pivotValue = aug[col][col];
    for (let j = col; j <= n; j += 1) {
      aug[col][j] /= pivotValue;
    }

    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = aug[row][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = col; j <= n; j += 1) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  return aug.map((row) => row[n]);
}

function renderRecommendation() {
  const container = document.getElementById("recommendation");
  const activeMaterials = MATERIALS.filter((material) => state.adjustable[material.key]);
  const solverRecommendation = computeRecommendation();
  const finalRecommendation = getFinalRecommendation();
  const manualSum = activeMaterials.reduce((sum, material) => sum + Number(state.manualRecommendation[material.key] || 0), 0);
  const predicted = predictResults(
    state.actualResults,
    Object.fromEntries(finalRecommendation.map((item) => [item.key, item.delta])),
  );

  const bestVoids = predicted.voids - state.targetResults.voids;
  const bestComp = predicted.compaction - state.targetResults.compaction;
  const bestStab = predicted.stability - state.targetResults.stability;

  const keyMessage = [
    `The solver is using <strong>${activeMaterials.length}</strong> adjustable material(s).`,
    `It is currently trying to close the gap on <strong>voids</strong>, <strong>compaction</strong>, and <strong>stability</strong> at the same time.`,
  ].join(" ");

  container.innerHTML = `
    <div class="recommendation-block">
      <div class="recommendation-header">
        <strong>Recommended blend shift</strong>
        <label class="mode-control">
          <span>Balance mode</span>
          <select id="manual-balance-mode" class="input mode-select">
            <option value="even" ${getManualBalanceMode() === "even" ? "selected" : ""}>Even split</option>
            <option value="sensitivity" ${getManualBalanceMode() === "sensitivity" ? "selected" : ""}>Sensitivity weighted</option>
          </select>
        </label>
      </div>
      <div class="subtle" style="margin: 8px 0 14px;">
        ${getManualBalanceMode() === "sensitivity"
          ? "Operator balance uses sensitivity scores so the strongest movers absorb more of the redistribution."
          : "Operator balance is spread evenly across the remaining adjustable materials."}
      </div>
      ${solverRecommendation
        .map(
          (item) =>
            {
              const manual = Number(state.manualRecommendation[item.key] || 0);
              const finalValue = item.delta + manual;
              return `
                <div class="recommendation-control">
                  <div class="recommendation-control-label">
                    <div>
                      <strong>${MATERIALS.find((material) => material.key === item.key).label}</strong>
                      <div class="subtle">${MATERIALS.find((material) => material.key === item.key).description}</div>
                      <div class="subtle">${MATERIALS.find((material) => material.key === item.key).effect}</div>
                    </div>
                    <span class="subtle">Solver ${item.delta > 0 ? "+" : ""}${formatNumber(item.delta, 2)}% · Manual ${manual > 0 ? "+" : ""}${formatNumber(manual, 2)}%</span>
                  </div>
                  <div class="value-controls">
                    <input class="slider" type="range" min="-5" max="5" step="0.1" data-group="manualRecommendation" data-key="${item.key}" value="${formatNumber(manual, 1)}" ${state.adjustable[item.key] ? "" : "disabled"} />
                    <input class="input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-group="manualRecommendation" data-key="${item.key}" value="${formatNumber(manual, 2)}" ${state.adjustable[item.key] ? "" : "disabled"} />
                  </div>
                  <div class="recommendation-final ${finalValue >= 0 ? "good" : "danger"}">${finalValue > 0 ? "+" : ""}${formatNumber(finalValue, 2)}%</div>
                </div>
              `;
            },
        )
        .join("")}
    </div>
    <div class="recommendation-block">
      <strong>Predicted outcome after recommendation</strong><br />
      ${METRICS.map(
        (metric) => `
          ${metric.label}: <strong>${formatNumber(predicted[metric.key], 2)} ${metric.unit}</strong>
          <span class="${Math.abs(predicted[metric.key] - state.targetResults[metric.key]) < 0.1 ? "good" : "muted"}">
            (${predicted[metric.key] - state.targetResults[metric.key] > 0 ? "+" : ""}${formatNumber(
          predicted[metric.key] - state.targetResults[metric.key],
          2,
        )} vs target)
          </span><br />
        `,
      ).join("")}
    </div>
    <div class="recommendation-block">
      <strong>Interpretation</strong><br />
      ${keyMessage}<br /><br />
      If your current issue is high voids and low compaction, the model will usually push
      toward <strong>more crusher fines / finer material</strong> and away from
      <strong>excess coarse aggregate</strong>. If stability falls too far, it will look
      for a tradeoff that adds tighter packing without over-correcting the voids.
    </div>
    <div class="recommendation-block">
      <strong>Gap check after recommendation</strong><br />
      Void gap: <strong class="${Math.abs(bestVoids) < 0.2 ? "good" : "danger"}">${bestVoids > 0 ? "+" : ""}${formatNumber(bestVoids, 2)}</strong><br />
      Compaction gap: <strong class="${Math.abs(bestComp) < 0.2 ? "good" : "danger"}">${bestComp > 0 ? "+" : ""}${formatNumber(bestComp, 2)}</strong><br />
      Stability gap: <strong class="${Math.abs(bestStab) < 0.2 ? "good" : "danger"}">${bestStab > 0 ? "+" : ""}${formatNumber(bestStab, 2)}</strong>
    </div>
    <div class="recommendation-block">
      <strong>Manual balance</strong><br />
      Manual overlay sum: <strong class="${Math.abs(manualSum) < 0.01 ? "good" : "danger"}">${manualSum > 0 ? "+" : ""}${formatNumber(manualSum, 2)}%</strong><br />
      Dragging one material will redistribute the opposite change across the other adjustable materials.
    </div>
  `;
}

function renderHistory() {
  const container = document.getElementById("history-table");
  if (!historyCases.length) {
    container.innerHTML = `
      <div class="note">No saved cases found for <strong>${state.operatorId}</strong>.</div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="history-list">
      ${historyCases
        .map(
          (item) => `
            <div class="history-row">
              <div>
                <div class="label">${item.name}</div>
                <div class="subtle">${item.userId} · ${new Date(item.updatedAt).toLocaleString()}</div>
              </div>
              <div class="history-actions">
                <button class="button secondary" data-load-case="${item.id}">Load</button>
                <button class="button ghost" data-delete-case="${item.id}">Delete</button>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function normalizeMix(kind) {
  const values = state[`${kind}Materials`];
  const total = sumValues(values);
  if (!total) return;
  MATERIALS.forEach((material) => {
    values[material.key] = (Number(values[material.key]) / total) * 100;
  });
}

async function refreshHistory() {
  try {
    historyCases = await apiGetCases();
    apiOnline = true;
  } catch {
    apiOnline = false;
    historyCases = readLocalCases().filter((item) => item.userId === state.operatorId);
  }
  renderHistory();
  updateApiIndicator();
}

async function saveCurrentCase() {
  const payload = {
    id: state.currentCaseId || undefined,
    userId: state.operatorId,
    name: state.caseName,
    snapshot: buildSnapshot(),
  };
  try {
    const saved = await apiSaveCase(payload);
    state.currentCaseId = saved.id;
    apiOnline = true;
  } catch {
    apiOnline = false;
    const localCases = readLocalCases();
    const now = new Date().toISOString();
    const record = {
      id: payload.id || crypto.randomUUID(),
      userId: payload.userId,
      name: payload.name,
      snapshot: payload.snapshot,
      createdAt: payload.createdAt || now,
      updatedAt: now,
    };
    const index = localCases.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      localCases[index] = { ...localCases[index], ...record };
    } else {
      localCases.unshift(record);
    }
    writeLocalCases(localCases);
    state.currentCaseId = record.id;
  }
  await refreshHistory();
}

async function deleteSavedCase(id) {
  try {
    await apiDeleteCase(id);
    apiOnline = true;
  } catch {
    apiOnline = false;
    writeLocalCases(readLocalCases().filter((item) => item.id !== id));
  }
  if (state.currentCaseId === id) {
    state.currentCaseId = null;
  }
  await refreshHistory();
}

function bindEvents() {
  document.getElementById("operator-id").addEventListener("change", async (event) => {
    state.operatorId = event.target.value.trim() || defaultState.operatorId;
    saveState();
    await refreshHistory();
    render();
  });

  document.getElementById("case-name").addEventListener("change", (event) => {
    state.caseName = event.target.value.trim() || defaultState.caseName;
    saveState();
    render();
  });

  document.getElementById("save-case").addEventListener("click", async () => {
    await saveCurrentCase();
    render();
  });

  document.getElementById("refresh-history").addEventListener("click", async () => {
    await refreshHistory();
    render();
  });

  document.getElementById("export-json").addEventListener("click", () => {
    const snapshot = buildSnapshot();
    downloadText(
      `${state.operatorId}-${state.caseName}.json`.replaceAll(/[^\w.-]+/g, "_"),
      JSON.stringify(snapshot, null, 2),
      "application/json",
    );
  });

  document.getElementById("export-csv").addEventListener("click", () => {
    const snapshot = buildSnapshot();
    downloadText(
      `${state.operatorId}-${state.caseName}.csv`.replaceAll(/[^\w.-]+/g, "_"),
      exportSnapshotCsv(snapshot),
      "text/csv",
    );
  });

  document.getElementById("import-trigger").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });

  document.getElementById("import-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      let snapshot;
      if (file.name.toLowerCase().endsWith(".csv")) {
        snapshot = snapshotFromCsv(text);
      } else {
        const parsed = JSON.parse(text);
        snapshot = parsed.snapshot ? parsed.snapshot : parsed;
      }
      applySnapshot(snapshot);
      saveState();
      await refreshHistory();
      render();
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== "range") return;

    const { group, key } = target.dataset;
    if (!group || !key) return;

    const value = parseLooseNumber(target.value);
    if (group === "targetMaterials" || group === "actualMaterials") {
      state[group][key] = value;
    } else if (group === "targetResults" || group === "actualResults") {
      state[group][key] = value;
    } else if (group.startsWith("sensitivities.")) {
      const materialKey = group.split(".")[1];
      state.sensitivities[materialKey][key] = value;
    } else if (group === "scenario") {
      state.scenario[key] = value;
    } else if (group === "manualRecommendation") {
      rebalanceManualRecommendation(key, value);
    }

    saveState();
    render();
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.id === "lock-total") {
      state.lockTotal = target.checked;
      saveState();
      render();
      return;
    }

    if (target.id === "manual-balance-mode") {
      state.manualBalanceMode = target.value === "sensitivity" ? "sensitivity" : "even";
      saveState();
      render();
      return;
    }

    const adjustableKey = target.dataset.adjustable;
    if (adjustableKey) {
      const previousValue = Number(state.manualRecommendation[adjustableKey] || 0);
      state.adjustable[adjustableKey] = target.checked;
      if (!target.checked) {
        state.manualRecommendation[adjustableKey] = 0;
        redistributeManualDelta(-previousValue, adjustableKey);
      }
      saveState();
      render();
      return;
    }

    const { group, key } = target.dataset;
    if (!group || !key) return;
    if (target.type === "text") {
      const value = parseLooseNumber(target.value);
      if (group === "targetMaterials" || group === "actualMaterials") {
        state[group][key] = value;
      } else if (group === "targetResults" || group === "actualResults") {
        state[group][key] = value;
      } else if (group.startsWith("sensitivities.")) {
        const materialKey = group.split(".")[1];
        state.sensitivities[materialKey][key] = value;
      } else if (group === "scenario") {
        state.scenario[key] = value;
      } else if (group === "manualRecommendation") {
        rebalanceManualRecommendation(key, value);
      }
      saveState();
      render();
    }
  });

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-normalize]")) {
      const kind = target.dataset.normalize;
      normalizeMix(kind);
      saveState();
      render();
    }

    const loadCaseId = target.dataset.loadCase;
    if (loadCaseId) {
      const record = historyCases.find((item) => item.id === loadCaseId) || readLocalCases().find((item) => item.id === loadCaseId);
      if (record) {
        applySnapshot(record.snapshot);
        state.operatorId = record.userId || state.operatorId;
        state.caseName = record.name || state.caseName;
        state.currentCaseId = record.id;
        saveState();
        await refreshHistory();
        render();
      }
    }

    const deleteCaseId = target.dataset.deleteCase;
    if (deleteCaseId) {
      try {
        await deleteSavedCase(deleteCaseId);
        render();
      } catch (error) {
        alert(`Delete failed: ${error.message}`);
      }
    }
  });

  document.getElementById("load-example").addEventListener("click", () => {
    Object.assign(state, structuredClone(defaultState));
    state.currentCaseId = null;
    saveState();
    render();
  });

  document.getElementById("reset-data").addEventListener("click", () => {
    Object.assign(state, structuredClone(defaultState));
    state.currentCaseId = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(META_KEY);
    render();
  });
}

function render() {
  syncHeaderFields();
  renderSummary();
  createMaterialRows(document.getElementById("target-materials"), "target");
  createResultRows(document.getElementById("target-results"), "target");
  createMaterialRows(document.getElementById("actual-materials"), "actual");
  createResultRows(document.getElementById("actual-results"), "actual");
  renderComparison();
  renderGradation();
  renderSensitivity();
  renderScenario();
  renderAdjustmentPanel();
  renderRecommendation();
  renderHistory();
  updateApiIndicator();
}

function syncHeaderFields() {
  const operator = document.getElementById("operator-id");
  const caseName = document.getElementById("case-name");
  if (operator && operator.value !== state.operatorId) operator.value = state.operatorId;
  if (caseName && caseName.value !== state.caseName) caseName.value = state.caseName;
}

function updateApiIndicator() {
  const saveButton = document.getElementById("save-case");
  if (saveButton) {
    saveButton.textContent = apiOnline ? "Save case" : "Save local";
  }
}

bindEvents();
render();
refreshHistory();
