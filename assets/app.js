// ══════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════
let currentStep = 0;
let assessmentData = {};
let resultsData = {};

// ══════════════════════════════════════════════
//  THEME: init + toggle (persisted)
// ══════════════════════════════════════════════
const rootEl = document.documentElement;
function applyTheme(theme) {
  if (theme === 'dark') {
    rootEl.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    rootEl.setAttribute('data-theme', 'light');
  } else {
    // System preference
    rootEl.removeAttribute('data-theme');
  }
}

function initTheme() {
  const saved = localStorage.getItem('aria.theme');
  applyTheme(saved || '');
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const current = rootEl.getAttribute('data-theme') || '';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('aria.theme', next);
    });
  }
}
// Initialize ASAP after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}

// ══════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════
function goToStep(n) {
  document.getElementById('step-' + currentStep).classList.remove('visible');
  document.getElementById('step-tab-' + currentStep).classList.add('done');
  document.getElementById('step-tab-' + currentStep).classList.remove('active');
  currentStep = n;
  document.getElementById('step-' + n).classList.add('visible');
  document.getElementById('step-tab-' + n).classList.add('active');
  document.getElementById('step-tab-' + n).classList.remove('done');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ══════════════════════════════════════════════
//  MCQ + CHECKBOX INTERACTION (delegated)
// ══════════════════════════════════════════════
function handleMcqSelect(target) {
  const opt = target.closest('.mcq-option');
  if (!opt) return;
  const input = opt.querySelector('input[type=radio]');
  if (!input) return;
  const name = input.name;
  document.querySelectorAll(`[name="${name}"]`).forEach(i => {
    const w = i.closest('.mcq-option');
    if (w) w.classList.remove('selected');
  });
  opt.classList.add('selected');
  input.checked = true;
}
function handleCheckToggle(target) {
  const opt = target.closest('.check-option');
  if (!opt) return;
  const input = opt.querySelector('input[type=checkbox]');
  if (!input) return;
  const willSelect = !opt.classList.contains('selected');
  opt.classList.toggle('selected', willSelect);
  input.checked = willSelect;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('.mcq-option')) {
    handleMcqSelect(e.target);
  } else if (e.target.closest('.check-option')) {
    handleCheckToggle(e.target);
  }
});

// Keyboard accessibility
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (e.target.closest('.mcq-option')) {
    e.preventDefault();
    handleMcqSelect(e.target);
  } else if (e.target.closest('.check-option')) {
    e.preventDefault();
    handleCheckToggle(e.target);
  }
});

// Sync UI if native input state changes
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('.mcq-option input[type=radio]')) {
    handleMcqSelect(t);
  } else if (t.matches('.check-option input[type=checkbox]')) {
    handleCheckToggle(t);
  }
});

// ══════════════════════════════════════════════
//  COLLECT FORM DATA
// ══════════════════════════════════════════════
function collectData() {
  const d = {};
  // Profile
  d.app_name = document.getElementById('app_name').value;
  d.org_name = document.getElementById('org_name').value;
  d.ai_function = document.getElementById('ai_function').value;
  d.model_type = document.getElementById('model_type').value;
  d.deployment = document.getElementById('deployment').value;
  d.jurisdiction = document.getElementById('jurisdiction').value;
  d.user_scale = document.getElementById('user_scale').value;
  d.deploy_phase = document.getElementById('deploy_phase').value;
  d.app_description = document.getElementById('app_description').value;

  // MCQs — collect radio values
  const radios = ['decision_automation','harm_level','override_process','financial_exposure',
    'data_consent','data_lineage','data_retention',
    'model_performance','model_drift','explainability','model_registry','hallucination',
    'adversarial_testing','access_control','supply_chain','model_integrity',
    'bias_testing','transparency','ethical_review','harmful_output',
    'compliance_docs','approval_process','vendor_risk',
    'incident_response','fallback','retraining','monitoring'];
  radios.forEach(name => {
    const el = document.querySelector(`[name="${name}"]:checked`);
    d[name] = el ? parseInt(el.value) : 3;
  });

  // Checkboxes
  d.data_types = [...document.querySelectorAll('.check-option input[type=checkbox]:checked')].map(c => c.value);
  d.regulations = [...document.querySelectorAll('[data-field="regulations"] input:checked')].map(c => c.value);

  // Slider
  d.data_quality = parseInt(document.getElementById('data_quality').value);
  // Invert: slider goes 1(poor)→5(excellent), but we want 5(poor)=high risk
  d.data_quality_score = 6 - d.data_quality;

  d.additional_context = document.getElementById('additional_context').value;

  return d;
}

// ══════════════════════════════════════════════
//  DOMAIN SCORE CALCULATION (local pre-compute)
// ══════════════════════════════════════════════
function computeLocalScores(d) {
  // Each domain: average of its fields (1=low risk, 5=high risk)
  const domains = {
    useCaseCriticality: avg([d.decision_automation, d.harm_level, d.override_process, d.financial_exposure]),
    dataGovernance:     avg([d.data_consent, d.data_lineage, d.data_retention, d.data_quality_score]),
    modelPerformance:   avg([d.model_performance, d.model_drift, d.explainability, d.model_registry, d.hallucination]),
    fairnessEthics:     avg([d.bias_testing, d.transparency, d.ethical_review, d.harmful_output]),
    security:           avg([d.adversarial_testing, d.access_control, d.supply_chain, d.model_integrity]),
    complianceGov:      avg([d.compliance_docs, d.approval_process, d.vendor_risk]),
    monitoring:         avg([d.incident_response, d.fallback, d.retraining, d.monitoring])
  };

  // Weights
  const weights = { useCaseCriticality:0.15, dataGovernance:0.15, modelPerformance:0.15, fairnessEthics:0.15, security:0.20, complianceGov:0.10, monitoring:0.10 };

  // Weighted raw risk (1-5)
  let weightedRisk = 0;
  for (const k in domains) weightedRisk += domains[k] * weights[k];

  // Scale to 0-100
  const inherentRisk = ((weightedRisk - 1) / 4) * 100;

  // Control effectiveness (inverse of domain averages) → simulate
  // For simplicity: control score is inverse: (5 - avgScore) / 4
  const controlEff = ((5 - weightedRisk) / 4);
  const residualRisk = Math.round(inherentRisk * (1 - controlEff * 0.4));

  // Clamp
  const rr = Math.max(0, Math.min(100, residualRisk));

  return { domains, weights, inherentRisk: Math.round(inherentRisk), residualRisk: rr, weightedRaw: weightedRisk };
}

function avg(arr) {
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}

// ══════════════════════════════════════════════
//  RUN ASSESSMENT (AI engine)
// ══════════════════════════════════════════════
async function runAssessment() {
  assessmentData = collectData();
  const localScores = computeLocalScores(assessmentData);

  // Show analyzing screen
  const overlay = document.getElementById('analyzing-screen');
  overlay.classList.add('show');
  animateSteps();

  // Build prompt for AI engine
  const prompt = buildPrompt(assessmentData, localScores);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are ARIA, an expert AI Risk Assessment engine used by enterprise grid teams. Analyze the provided AI system assessment data and respond ONLY with a valid JSON object. No preamble, no markdown fences. The JSON must exactly follow the schema provided.`,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    let clean = text.replace(/```json|```/g,'').trim();
    const aiResult = JSON.parse(clean);
    resultsData = { ...localScores, ...aiResult, input: assessmentData };
  } catch(e) {
    // Fallback: generate locally if API fails
    resultsData = generateLocalFallback(assessmentData, localScores);
  }

  setTimeout(() => {
    overlay.classList.remove('show');
    renderResults(resultsData, assessmentData);
  }, 3500);
}

function buildPrompt(d, scores) {
  return `Evaluate this AI system and return ONLY a JSON object with exactly this structure:
{
  "narrative": "3-4 sentence expert assessment narrative summarizing the risk profile",
  "adjustedResidualRisk": <integer 0-100, your calibrated residual risk after considering all context>,
  "riskLevel": "<Low|Moderate|High|Critical>",
  "verdict": "<APPROVE|APPROVE WITH CONDITIONS|REMEDIATION REQUIRED|REJECT>",
  "verdictClass": "<approve|conditions|remediate|reject>",
  "keyFindings": [
    {"type":"<critical|warning|ok|info>","text":"finding description"},
    ... (5-8 findings)
  ],
  "strengths": [
    {"text":"strength description"},
    ... (2-4 items)
  ],
  "recommendations": [
    {"action":"action title","domain":"domain name","priority":"<Critical|High|Medium|Low>","timeline":"<Immediate|30 days|60 days|90 days>"},
    ... (5-8 items)
  ],
  "domainNarrative": {
    "useCaseCriticality": "1-sentence assessment",
    "dataGovernance": "1-sentence assessment",
    "modelPerformance": "1-sentence assessment",
    "fairnessEthics": "1-sentence assessment",
    "security": "1-sentence assessment",
    "complianceGov": "1-sentence assessment",
    "monitoring": "1-sentence assessment"
  },
  "complianceGaps": ["gap1","gap2","gap3"],
  "inherentRiskScore": <integer 0-100>,
  "controlEffectivenessScore": <integer 0-100>
}

ASSESSMENT DATA:
App: ${d.app_name} | Org: ${d.org_name}
Function: ${d.ai_function} | Model: ${d.model_type}
Deployment: ${d.deployment} | Jurisdiction: ${d.jurisdiction}
Scale: ${d.user_scale} | Phase: ${d.deploy_phase}
Description: ${d.app_description}

DOMAIN SCORES (1=low risk, 5=high risk):
Use Case Criticality: ${scores.domains.useCaseCriticality.toFixed(2)}
Data Governance: ${scores.domains.dataGovernance.toFixed(2)}
Model Performance: ${scores.domains.modelPerformance.toFixed(2)}
Fairness & Ethics: ${scores.domains.fairnessEthics.toFixed(2)}
Security: ${scores.domains.security.toFixed(2)}
Compliance & Gov: ${scores.domains.complianceGov.toFixed(2)}
Monitoring & Ops: ${scores.domains.monitoring.toFixed(2)}
Computed Inherent Risk: ${scores.inherentRisk}/100
Computed Residual Risk: ${scores.residualRisk}/100

Decision Automation: ${d.decision_automation}/5
Harm Level: ${d.harm_level}/5
Override Process: ${d.override_process}/5
Data Consent: ${d.data_consent}/5
Data Lineage: ${d.data_lineage}/5
Model Explainability: ${d.explainability}/5
Bias Testing: ${d.bias_testing}/5
Adversarial Testing: ${d.adversarial_testing}/5
Access Control: ${d.access_control}/5
Compliance Docs: ${d.compliance_docs}/5
Monitoring: ${d.monitoring}/5
Regulations: ${d.regulations.join(', ')||'none identified'}
Data Types: ${d.data_types.join(', ')||'not specified'}
Additional Context: ${d.additional_context||'none'}

Be fair, rigorous, and specific. If the system is in early pilot with few users, weigh that. If it's a high-stakes financial or medical system with weak controls, flag it strongly. Calibrate verdicts correctly.`;
}

function generateLocalFallback(d, scores) {
  const rr = scores.residualRisk;
  let verdict, verdictClass, riskLevel;
  if (rr <= 25) { verdict='APPROVE'; verdictClass='approve'; riskLevel='Low'; }
  else if (rr <= 50) { verdict='APPROVE WITH CONDITIONS'; verdictClass='conditions'; riskLevel='Moderate'; }
  else if (rr <= 75) { verdict='REMEDIATION REQUIRED'; verdictClass='remediate'; riskLevel='High'; }
  else { verdict='REJECT'; verdictClass='reject'; riskLevel='Critical'; }

  return {
    ...scores,
    adjustedResidualRisk: rr,
    riskLevel, verdict, verdictClass,
    narrative: `The ${d.app_name} system has been assessed across 7 risk domains. With a residual risk score of ${rr}/100, it falls in the ${riskLevel} risk category. Key areas requiring attention include model governance, security controls, and compliance documentation. A structured remediation plan is recommended before production deployment.`,
    keyFindings: [
      {type: d.harm_level>=4?'critical':'warning', text: `Decision harm level rated ${d.harm_level}/5 — impacts require appropriate oversight mechanisms`},
      {type: d.data_consent>=4?'critical':'info', text: `Data consent and legal basis requires strengthening for regulatory compliance`},
      {type: d.explainability>=4?'warning':'ok', text: `Model explainability score ${d.explainability}/5 — explanations may be insufficient for high-stakes decisions`},
      {type: d.adversarial_testing>=4?'critical':'warning', text: `Security testing coverage is insufficient against AI-specific threat vectors`},
      {type: d.bias_testing>=4?'critical':'warning', text: `Fairness testing needs strengthening to ensure equitable outcomes across groups`},
    ],
    strengths: [{text:'Assessment initiated — formal risk awareness demonstrated'},{text:'Multiple domains evaluated systematically'}],
    recommendations: [
      {action:'Implement comprehensive bias and fairness testing', domain:'Fairness & Ethics', priority:'High', timeline:'30 days'},
      {action:'Establish model drift monitoring and alerting', domain:'Model Performance', priority:'High', timeline:'30 days'},
      {action:'Complete adversarial security testing (red teaming)', domain:'Security', priority:'Critical', timeline:'Immediate'},
      {action:'Document compliance requirement-to-control mapping', domain:'Compliance & Governance', priority:'High', timeline:'60 days'},
      {action:'Deploy AI-specific incident response playbook', domain:'Operations', priority:'Medium', timeline:'60 days'},
    ],
    domainNarrative: {
      useCaseCriticality:'Use case impact level requires proportionate governance and oversight mechanisms.',
      dataGovernance:'Data governance practices need strengthening around consent and lineage documentation.',
      modelPerformance:'Model performance characterization requires more comprehensive subgroup testing.',
      fairnessEthics:'Fairness testing coverage is insufficient for the stated use case and affected populations.',
      security:'AI-specific security testing should be prioritized to address adversarial vulnerability gaps.',
      complianceGov:'Compliance documentation completeness needs improvement for regulatory readiness.',
      monitoring:'Operational monitoring should be enhanced with AI-specific KPIs and alerting thresholds.'
    },
    complianceGaps:['Requirement-to-control mapping incomplete','Model card not finalized','Audit trail not automated'],
    inherentRiskScore: scores.inherentRisk,
    controlEffectivenessScore: Math.round((1 - scores.residualRisk/scores.inherentRisk) * 100),
    input: d
  };
}

// ══════════════════════════════════════════════
//  ANIMATE LOADING STEPS
// ══════════════════════════════════════════════
function animateSteps() {
  const steps = document.querySelectorAll('.analyze-step');
  let i = 0;
  const interval = setInterval(() => {
    if (i > 0) steps[i-1].classList.replace('active','done');
    if (i < steps.length) {
      steps[i].classList.add('active');
      i++;
    } else {
      clearInterval(interval);
    }
  }, 500);
}

// ══════════════════════════════════════════════
//  RENDER RESULTS
// ══════════════════════════════════════════════
function renderResults(r, d) {
  // Show results section
  document.getElementById('results-section').classList.add('visible');

  // Hide form steps
  document.querySelectorAll('.section-card').forEach(c => c.classList.remove('visible'));
  document.getElementById('progress-track').style.display = 'none';

  window.scrollTo({ top: 0, behavior: 'smooth' });

  const score = r.adjustedResidualRisk ?? r.residualRisk;

  // Header
  document.getElementById('res-app-name').textContent = d.app_name || 'Unnamed System';
  document.getElementById('res-meta').textContent = `${d.org_name} · ${d.ai_function} · ${d.model_type} · ${d.jurisdiction}`;

  // Tags
  const tags = [d.deploy_phase, d.user_scale, d.deployment];
  document.getElementById('res-tags').innerHTML = tags.map(t => `<span class="tag">${t}</span>`).join('');

  // Verdict
  const verdictEl = document.getElementById('res-verdict');
  verdictEl.className = `result-verdict verdict-${r.verdictClass}`;
  document.getElementById('res-verdict-text').textContent = r.verdict;
  const vLabel = verdictEl.querySelector('.verdict-label');
  vLabel.textContent = `${r.riskLevel} RISK — VERDICT`;

  // Gauge
  const arc = document.getElementById('gauge-arc');
  const totalLen = 251.3;
  const offset = totalLen - (score / 100) * totalLen;
  setTimeout(() => { arc.style.strokeDashoffset = offset; }, 100);
  document.getElementById('gauge-num').textContent = score;
  document.getElementById('gauge-score-display').textContent = score + '/100';
  document.getElementById('gauge-score-display').style.color = scoreColor(score);
  document.getElementById('gauge-risk-label').textContent = r.riskLevel + ' RESIDUAL RISK';

  // Risk strip
  const segs = ['seg-0','seg-1','seg-2','seg-3'];
  const thresholds = [25,50,75,100];
  segs.forEach((id,i) => {
    document.getElementById(id).classList.toggle('inactive', score < (i === 0 ? 0 : thresholds[i-1]));
  });
  // Better: light up segment that contains the score
  segs.forEach((id,i) => {
    const lo = i === 0 ? 0 : thresholds[i-1];
    const hi = thresholds[i];
    document.getElementById(id).style.opacity = (score >= lo) ? '1' : '0.15';
  });

  // Score breakdown
  const breakdown = [
    ['Inherent Risk', r.inherentRiskScore ?? r.inherentRisk, '#dc2626'],
    ['Control Effectiveness', r.controlEffectivenessScore ?? 50, '#16a34a'],
    ['Residual Risk', score, scoreColor(score)]
  ];
  document.getElementById('score-breakdown').innerHTML = breakdown.map(([label, val, color]) => `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:0.65rem;letter-spacing:0.08em;color:var(--muted);width:160px;">${label}</span>
      <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
        <div style="width:${val}%;height:100%;background:${color};border-radius:3px;transition:width 1s;"></div>
      </div>
      <span style="font-family:Syne,sans-serif;font-weight:700;font-size:0.85rem;color:${color};width:36px;text-align:right;">${val}</span>
    </div>
  `).join('');

  // Domain dashboard
  const domainLabels = {
    useCaseCriticality: 'USE CASE',
    dataGovernance:     'DATA GOV',
    modelPerformance:   'MODEL',
    fairnessEthics:     'FAIRNESS',
    security:           'SECURITY',
    complianceGov:      'COMPLIANCE',
    monitoring:         'MONITORING'
  };
  const domainWeightsPct = { useCaseCriticality:15, dataGovernance:15, modelPerformance:15, fairnessEthics:15, security:20, complianceGov:10, monitoring:10 };

  document.getElementById('domain-dashboard').innerHTML = Object.entries(r.domains).map(([k, v]) => {
    const pct = Math.round(((v-1)/4)*100);
    const col = pct <= 30 ? '#16a34a' : pct <= 60 ? '#d97706' : '#dc2626';
    return `<div class="domain-score">
      <div class="ds-label">${domainLabels[k]}<br><span style="color:var(--accent);font-size:0.55rem;">${domainWeightsPct[k]}%</span></div>
      <div class="ds-num" style="color:${col}">${pct}</div>
      <div class="ds-bar"><div class="ds-bar-fill" style="width:${pct}%;background:${col};"></div></div>
    </div>`;
  }).join('');

  // Narrative
  document.getElementById('narrative-text').textContent = r.narrative;

  // Detail grid
  const grid = document.getElementById('detail-grid');
  grid.innerHTML = `
    <div class="detail-card">
      <div class="detail-card-header">🔍 KEY FINDINGS</div>
      <div class="detail-card-body">
        ${(r.keyFindings||[]).map(f => `
          <div class="finding-item finding-${f.type}">
            <div class="finding-icon"></div>
            <div>${f.text}</div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="detail-card">
      <div class="detail-card-header">✅ IDENTIFIED STRENGTHS</div>
      <div class="detail-card-body">
        ${(r.strengths||[]).map(s => `
          <div class="finding-item finding-ok">
            <div class="finding-icon"></div>
            <div>${s.text}</div>
          </div>
        `).join('')}
        <div class="section-divider" style="margin:1rem 0 0.5rem;">COMPLIANCE GAPS</div>
        ${(r.complianceGaps||[]).map(g => `
          <div class="finding-item finding-warning">
            <div class="finding-icon"></div>
            <div>${g}</div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="detail-card full">
      <div class="detail-card-header">🗂 DOMAIN-BY-DOMAIN ASSESSMENT</div>
      <div class="detail-card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          ${Object.entries(r.domainNarrative||{}).map(([k,v]) => `
            <div style="padding:10px 14px;background:var(--surface);border-radius:3px;border-left:3px solid ${domainColor(r.domains[k]||3)};">
              <div style="font-size:0.6rem;letter-spacing:0.1em;color:var(--muted);margin-bottom:4px;">${domainLabels[k]||k}</div>
              <div style="font-size:0.78rem;line-height:1.6;">${v}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Recommendations table
  const tbody = document.getElementById('rec-table-body');
  tbody.innerHTML = (r.recommendations||[]).map((rec, i) => `
    <tr>
      <td style="color:var(--muted);font-size:0.7rem;">${String(i+1).padStart(2,'0')}</td>
      <td>${rec.action}</td>
      <td><span class="tag">${rec.domain}</span></td>
      <td><span class="priority-${rec.priority.toLowerCase().replace(' ','')}">${rec.priority}</span></td>
      <td style="color:var(--muted);font-size:0.75rem;">${rec.timeline}</td>
    </tr>
  `).join('');
}

function scoreColor(s) {
  if (s <= 25) return '#16a34a';
  if (s <= 50) return '#d97706';
  if (s <= 75) return '#dc2626';
  return '#7c3aed';
}

function domainColor(v) {
  const pct = ((v-1)/4)*100;
  if (pct <= 30) return '#16a34a';
  if (pct <= 60) return '#d97706';
  return '#dc2626';
}

// ══════════════════════════════════════════════
//  PDF DOWNLOAD
// ══════════════════════════════════════════════
async function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const r = resultsData;
  const d = assessmentData;
  const score = r.adjustedResidualRisk ?? r.residualRisk;
  const W = 210;
  const margin = 18;
  let y = 0;

  // Color helpers
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1],16), parseInt(result[2],16), parseInt(result[3],16)] : [0,0,0];
  }
  function setColor(hex) { const [r,g,b] = hexToRgb(hex); doc.setTextColor(r,g,b); }
  function setFill(hex) { const [r,g,b] = hexToRgb(hex); doc.setFillColor(r,g,b); }
  function setDraw(hex) { const [r,g,b] = hexToRgb(hex); doc.setDrawColor(r,g,b); }

  const scoreCol = score<=25?'#16a34a':score<=50?'#d97706':score<=75?'#dc2626':'#7c3aed';

  // PAGE 1 — COVER
  setFill('#1a1a2e'); doc.rect(0,0,W,297,'F');
  setFill('#e8500a'); doc.rect(0,0,W,2,'F');

  setColor('#ffffff');
  doc.setFont('helvetica','bold');
  doc.setFontSize(9);
  doc.text('ARIA — AI RISK & INTELLIGENCE ASSESSMENT', margin, 22);

  setColor('#6060a0');
  doc.setFontSize(7.5);
  doc.text('CONFIDENTIAL ASSESSMENT REPORT', margin, 29);

  // Big name
  setColor('#ffffff');
  doc.setFont('helvetica','bold');
  doc.setFontSize(28);
  const appName = d.app_name || 'AI System';
  doc.text(appName, margin, 65);

  setColor('#a0a0b8');
  doc.setFontSize(10);
  doc.text(d.org_name || '', margin, 75);
  doc.text(`${d.ai_function} · ${d.model_type}`, margin, 83);

  // Score box
  const sc = hexToRgb(scoreCol);
  doc.setFillColor(sc[0],sc[1],sc[2],0.15);
  doc.roundedRect(margin, 100, 80, 50, 3, 3, 'F');
  setDraw(scoreCol);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, 100, 80, 50, 3, 3, 'S');
  setColor(scoreCol);
  doc.setFont('helvetica','bold');
  doc.setFontSize(40);
  doc.text(String(score), margin+40, 128, {align:'center'});
  doc.setFontSize(7);
  doc.text('RESIDUAL RISK SCORE / 100', margin+40, 136, {align:'center'});
  doc.setFontSize(10);
  doc.text(r.riskLevel?.toUpperCase()+' RISK', margin+40, 144, {align:'center'});

  // Verdict box
  doc.setFillColor(40,40,70);
  doc.roundedRect(margin+90, 100, 100, 50, 3, 3, 'F');
  setColor('#6060a0');
  doc.setFont('helvetica','normal');
  doc.setFontSize(7);
  doc.text('ASSESSMENT VERDICT', margin+140, 112, {align:'center'});
  setColor('#ffffff');
  doc.setFont('helvetica','bold');
  doc.setFontSize(11);
  const verdictLines = doc.splitTextToSize(r.verdict||'—', 85);
  doc.text(verdictLines, margin+140, 124, {align:'center'});

  // Meta info
  setColor('#6060a0');
  doc.setFont('helvetica','normal');
  doc.setFontSize(7.5);
  const metaItems = [
    ['DEPLOYMENT', d.deployment],
    ['JURISDICTION', d.jurisdiction],
    ['USER SCALE', d.user_scale],
    ['PHASE', d.deploy_phase],
    ['DATE', new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})],
    ['GENERATED BY', 'ARIA v2.0']
  ];
  metaItems.forEach(([label,val],i) => {
    const col = i < 3 ? margin : margin + 95;
    const row = 168 + (i%3)*10;
    setColor('#6060a0'); doc.text(label+':', col, row);
    setColor('#a0a0b8'); doc.text(val||'—', col+38, row);
  });

  // Footer
  setFill('#e8500a'); doc.rect(0,285,W,2,'F');
  setColor('#6060a0'); doc.setFontSize(7);
  doc.text('ARIA | AI Risk & Intelligence Assessment | Confidential', margin, 293);
  doc.text('1', W-margin, 293, {align:'right'});

  // PAGE 2 — DOMAIN SCORES
  doc.addPage();
  setFill('#f5f3ee'); doc.rect(0,0,W,297,'F');
  setFill('#1a1a2e'); doc.rect(0,0,W,18,'F');
  setColor('#ffffff'); doc.setFont('helvetica','bold'); doc.setFontSize(8);
  doc.text('DOMAIN RISK SCORES', margin, 12);
  setColor('#e8500a'); doc.text(`${d.app_name}`, W-margin, 12, {align:'right'});

  y = 30;
  setColor('#1a1a2e'); doc.setFont('helvetica','bold'); doc.setFontSize(14);
  doc.text('Domain Risk Analysis', margin, y); y += 8;
  setColor('#6b6b7a'); doc.setFont('helvetica','normal'); doc.setFontSize(8);
  doc.text('Each domain scored 0–100. Higher score = higher risk. Weight reflects contribution to overall residual risk.', margin, y); y += 12;

  const domainLabels2 = {
    useCaseCriticality:['USE CASE CRITICALITY','15%'],
    dataGovernance:['DATA GOVERNANCE','15%'],
    modelPerformance:['MODEL PERFORMANCE','15%'],
    fairnessEthics:['FAIRNESS & ETHICS','15%'],
    security:['SECURITY','20%'],
    complianceGov:['COMPLIANCE & GOVERNANCE','10%'],
    monitoring:['MONITORING & OPERATIONS','10%']
  };

  Object.entries(r.domains).forEach(([k,v]) => {
    const pct = Math.round(((v-1)/4)*100);
    const col = pct<=30?'#16a34a':pct<=60?'#d97706':'#dc2626';
    const [label,weight] = domainLabels2[k]||[k,'—'];
    const narrative = r.domainNarrative?.[k]||'';

    setFill('#ffffff'); doc.roundedRect(margin, y, W-margin*2, 22, 2, 2, 'F');
    setDraw('#d4d0c8'); doc.setLineWidth(0.3); doc.roundedRect(margin, y, W-margin*2, 22, 2, 2, 'S');

    setColor('#1a1a2e'); doc.setFont('helvetica','bold'); doc.setFontSize(8);
    doc.text(label, margin+4, y+7);
    setColor('#e8500a'); doc.setFontSize(7);
    doc.text(weight, margin+4, y+13);

    // Bar
    const barX = margin+55; const barW = 90; const barH = 4;
    setFill('#e5e7eb'); doc.roundedRect(barX, y+9, barW, barH, 1, 1, 'F');
    const filled = (pct/100)*barW;
    const fc = hexToRgb(col);
    doc.setFillColor(fc[0],fc[1],fc[2]);
    doc.roundedRect(barX, y+9, filled, barH, 1, 1, 'F');

    // Score
    setColor(col); doc.setFont('helvetica','bold'); doc.setFontSize(14);
    doc.text(String(pct), barX+barW+8, y+14);
    setColor('#6b6b7a'); doc.setFontSize(6); doc.setFont('helvetica','normal');
    doc.text('/100', barX+barW+16, y+14);

    // Narrative
    if (narrative) {
      setColor('#6b6b7a'); doc.setFontSize(6.5);
      const lines = doc.splitTextToSize(narrative, barW+35);
      doc.text(lines[0], barX, y+19);
    }

    y += 26;
  });

  // Scoring formula box
  y += 4;
  setFill('#1a1a2e'); doc.roundedRect(margin, y, W-margin*2, 28, 3, 3, 'F');
  setColor('#e8500a'); doc.setFont('helvetica','bold'); doc.setFontSize(7);
  doc.text('SCORING METHODOLOGY', margin+6, y+7);
  setColor('#a0a0b8'); doc.setFont('helvetica','normal'); doc.setFontSize(7);
  doc.text('Residual Risk = Inherent Risk x (1 - Control Effectiveness)', margin+6, y+14);
  doc.text(`Inherent Risk: ${r.inherentRiskScore??r.inherentRisk}/100   Control Effectiveness: ${r.controlEffectivenessScore??'—'}/100   Residual Risk: ${score}/100`, margin+6, y+21);

  // Footer
  setFill('#1a1a2e'); doc.rect(0,285,W,12,'F');
  setColor('#6060a0'); doc.setFontSize(7);
  doc.text('ARIA | Confidential Assessment Report', margin, 293);
  doc.text('2', W-margin, 293, {align:'right'});

  // PAGE 3 — NARRATIVE + FINDINGS
  doc.addPage();
  setFill('#f5f3ee'); doc.rect(0,0,W,297,'F');
  setFill('#1a1a2e'); doc.rect(0,0,W,18,'F');
  setColor('#ffffff'); doc.setFont('helvetica','bold'); doc.setFontSize(8);
  doc.text('ASSESSMENT NARRATIVE & KEY FINDINGS', margin, 12);
  setColor('#e8500a'); doc.text(`${d.app_name}`, W-margin, 12, {align:'right'});

  y = 28;
  // Narrative
  setFill('#fff8f5'); doc.roundedRect(margin,y,W-margin*2,40,3,3,'F');
  setDraw('#e8500a'); doc.setLineWidth(0.8); doc.line(margin, y, margin, y+40);
  setColor('#e8500a'); doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.text('◆ ARIA ASSESSMENT NARRATIVE', margin+4, y+7);
  setColor('#1a1a2e'); doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
  const narLines = doc.splitTextToSize(r.narrative||'', W-margin*2-8);
  doc.text(narLines.slice(0,6), margin+4, y+14);
  y += 48;

  // Key findings
  setColor('#1a1a2e'); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('Key Findings', margin, y); y += 8;

  (r.keyFindings||[]).forEach(f => {
    const col = f.type==='critical'?'#dc2626':f.type==='warning'?'#d97706':f.type==='ok'?'#16a34a':'#2563eb';
    const fc2 = hexToRgb(col);
    doc.setFillColor(fc2[0],fc2[1],fc2[2]);
    doc.circle(margin+3, y+1, 1.5, 'F');
    setColor('#1a1a2e'); doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(f.text, W-margin*2-12);
    doc.text(lines, margin+8, y+3);
    y += lines.length*5 + 4;
  });

  y += 4;
  setColor('#1a1a2e'); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('Identified Strengths', margin, y); y += 8;

  (r.strengths||[]).forEach(s => {
    const fc3 = hexToRgb('#16a34a');
    doc.setFillColor(fc3[0],fc3[1],fc3[2]);
    doc.circle(margin+3, y+1, 1.5, 'F');
    setColor('#1a1a2e'); doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(s.text, W-margin*2-12);
    doc.text(lines, margin+8, y+3);
    y += lines.length*5 + 4;
  });

  y += 4;
  setColor('#1a1a2e'); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('Compliance Gaps Identified', margin, y); y += 8;

  (r.complianceGaps||[]).forEach(g => {
    const fc4 = hexToRgb('#d97706');
    doc.setFillColor(fc4[0],fc4[1],fc4[2]);
    doc.circle(margin+3, y+1, 1.5, 'F');
    setColor('#1a1a2e'); doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(g, W-margin*2-12);
    doc.text(lines, margin+8, y+3);
    y += lines.length*5 + 4;
  });

  // Footer
  setFill('#1a1a2e'); doc.rect(0,285,W,12,'F');
  setColor('#6060a0'); doc.setFontSize(7);
  doc.text('ARIA | Confidential Assessment Report', margin, 293);
  doc.text('3', W-margin, 293, {align:'right'});

  // PAGE 4 — RECOMMENDATIONS
  doc.addPage();
  setFill('#f5f3ee'); doc.rect(0,0,W,297,'F');
  setFill('#1a1a2e'); doc.rect(0,0,W,18,'F');
  setColor('#ffffff'); doc.setFont('helvetica','bold'); doc.setFontSize(8);
  doc.text('PRIORITY REMEDIATION ACTIONS', margin, 12);
  setColor('#e8500a'); doc.text(`${d.app_name}`, W-margin, 12, {align:'right'});

  y = 28;
  setColor('#1a1a2e'); doc.setFont('helvetica','bold'); doc.setFontSize(13);
  doc.text('Remediation Roadmap', margin, y); y += 6;
  setColor('#6b6b7a'); doc.setFont('helvetica','normal'); doc.setFontSize(8);
  doc.text('Prioritized action plan for risk reduction and compliance readiness.', margin, y); y += 10;

  // Table header
  setFill('#1a1a2e'); doc.rect(margin, y, W-margin*2, 10, 'F');
  setColor('#ffffff'); doc.setFont('helvetica','bold'); doc.setFontSize(7);
  doc.text('#', margin+3, y+7);
  doc.text('ACTION', margin+12, y+7);
  doc.text('DOMAIN', margin+105, y+7);
  doc.text('PRIORITY', margin+138, y+7);
  doc.text('TIMELINE', margin+158, y+7);
  y += 14;

  (r.recommendations||[]).forEach((rec,i) => {
    const isEven = i%2===0;
    if (isEven) { setFill('#f9f8f5'); doc.rect(margin,y-4,W-margin*2,12,'F'); }
    setColor('#6b6b7a'); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    doc.text(String(i+1).padStart(2,'0'), margin+3, y+3);
    setColor('#1a1a2e'); doc.setFont('helvetica','normal'); doc.setFontSize(8);
    const actionLines = doc.splitTextToSize(rec.action, 88);
    doc.text(actionLines[0], margin+12, y+3);
    setColor('#6b6b7a'); doc.setFontSize(7);
    doc.text(rec.domain||'', margin+105, y+3);
    const pc = rec.priority==='Critical'?'#dc2626':rec.priority==='High'?'#d97706':rec.priority==='Medium'?'#2563eb':'#16a34a';
    setColor(pc); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    doc.text(rec.priority||'', margin+138, y+3);
    setColor('#6b6b7a'); doc.setFont('helvetica','normal'); doc.setFontSize(7);
    doc.text(rec.timeline||'', margin+158, y+3);
    y += 12;
  });

  // Threshold legend
  y += 10;
  // Increase height to avoid last-line overflow and slightly reduce text size
  setFill('#1a1a2e'); doc.roundedRect(margin, y, W-margin*2, 42, 3,3,'F');
  setColor('#e8500a'); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
  doc.text('RISK THRESHOLD REFERENCE', margin+6, y+8);
  const thresholds = [['0–25','LOW RESIDUAL RISK','Approve for deployment','#16a34a'],['26–50','MODERATE RISK','Approve with documented controls','#d97706'],['51–75','HIGH RISK','Remediation required before deployment','#dc2626'],['76–100','CRITICAL RISK','Reject or fundamental redesign required','#7c3aed']];
  thresholds.forEach(([range, level, action, col], i) => {
    const x = margin+6 + i*46;
    setColor(col); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    doc.text(range, x, y+17);
    doc.setFontSize(6.2);
    doc.text(level, x, y+23);
    setColor('#a0a0b8'); doc.setFont('helvetica','normal'); doc.setFontSize(5.8);
    const wrapped = doc.splitTextToSize(action, 40);
    doc.text(wrapped, x, y+29, { maxWidth: 40 });
  });

  // Final footer
  setFill('#1a1a2e'); doc.rect(0,285,W,12,'F');
  setColor('#6060a0'); doc.setFontSize(7);
  doc.text('ARIA | AI Risk & Intelligence Assessment | Confidential — For Internal Use Only', margin, 293);
  doc.text('4', W-margin, 293, {align:'right'});

  // Save
  const filename = `ARIA_Assessment_${(d.app_name||'report').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}

// ══════════════════════════════════════════════
//  RESET
// ══════════════════════════════════════════════
function resetAssessment() {
  document.getElementById('results-section').classList.remove('visible');
  document.getElementById('progress-track').style.display = 'flex';
  currentStep = 0;
  document.querySelectorAll('.track-step').forEach((el,i) => {
    el.className = 'track-step' + (i===0?' active':'');
  });
  document.getElementById('step-0').classList.add('visible');
  document.querySelectorAll('.analyze-step').forEach(el => {
    el.classList.remove('active','done');
  });
  window.scrollTo({ top: 0, behavior:'smooth' });
}

