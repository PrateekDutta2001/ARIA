## ARIA — AI Risk & Intelligence Assessment (Enterprise Grid)

### What is ARIA?
ARIA is a browser‑based framework to assess AI systems across eight dimensions and generate an audit‑ready PDF report. It uses a structured, three‑layer scoring model: inherent risk, control effectiveness, and residual risk. The UI is single‑page, responsive, and works fully offline once loaded (except for optional AI summarization if you later connect an API).

### Key capabilities
- Structured 8‑domain assessment with 1–5 scoring
- Weighted aggregation and clear decision thresholds
- Auto‑generated PDF report with scores, findings, and recommendations
- Light/Dark theme with system‑preference default and user toggle
- Robust selection UX (multiple select checkboxes and MCQs)
- Mobile‑first responsive layout and high‑contrast, eye‑comfort palettes
- Separate HTML, CSS, and JS for maintainability

## Project structure
- `ai-assessment-framework.html` — main assessment application
- `framework-overview.html` — explainer page: method, formulas, and domains
- `assets/style.css` — theming, layout, and component styles (light/dark)
- `assets/app.js` — app logic, scoring, rendering, PDF export, theme toggle

## Quick start
1) Open `ai-assessment-framework.html` in your browser.
2) Fill out the profile and answer domain questions.
3) Click “Run Assessment” (when visible) and review the results.
4) Download the audit‑ready PDF report from the results action bar.
5) Use the header “☀︎ / ☾” toggle to switch light/dark themes. Your choice persists.
6) See the “FRAMEWORK” link in the header for a full methodology overview.

Tip (Windows): Right‑click the file → Open With → your preferred browser. Or drag the file into an open browser window.

## How ARIA evaluates risk

### Three‑layer scoring model
- Layer 1: Inherent Risk — impact and likelihood before safeguards.
- Layer 2: Control Effectiveness — maturity and coverage of safeguards.
- Layer 3: Residual Risk & Compliance — what remains after mitigation.

Formulas:
- Residual Risk = Inherent Risk × (1 − Control Effectiveness)
- Compliance Score = Σ(Requirement Weight × Control Pass Rate)

### Rule domains and suggested weights
- Use‑case criticality — 15%
- Data governance — 15%
- Model performance — 15%
- Fairness & ethics — 15%
- Security — 20%
- Compliance & governance — 10%
- Monitoring & operations — 10%

### Metric scale (1–5)
- 1 = Low risk / strong control / fully compliant
- 3 = Medium risk / partially controlled
- 5 = High risk / weak or missing control

### Decision thresholds
- 0–25: Low residual risk — Approve
- 26–50: Moderate — Approve with documented controls
- 51–75: High — Remediation required before deployment
- 76–100: Critical — Reject or redesign

## UI and usage details

### Inventory and scope
The “Application Profile” step captures the assessment boundary: app name, model type, deployment, jurisdiction, users/scale, and phase. These context elements are used by the scoring and the PDF.

### Inputs and interactions
- MCQs (single choice): Click option cards. Keyboard: Enter/Space on focused option.
- Checklists (multi‑select): Click to toggle on/off; supports keyboard Enter/Space.
- Selects and sliders: Provide structured numeric inputs for scoring.
- All interactions are resilient; delegated handlers keep UI in sync with native inputs.

### Results
- A gauge and risk strip visualize the overall residual risk.
- Domain dashboard shows normalized domain scores and weights.
- Narrative, key findings, strengths, and compliance gaps are displayed.
- Recommendations are presented as a table and included in the PDF.

### PDF export
- Uses `jsPDF` (CDN) to generate a multi‑page report with consistent branding.
- Dynamic content: app metadata, residual risk, domain analysis, and recommendations.
- Legend panel auto‑wraps to avoid text overflow on smaller phrases.

## Theming and accessibility

### Light/Dark theme
- Theme variables are defined in `:root` and `[data-theme="dark"]`.
- The UI respects system preference by default and persists user toggles in `localStorage`.
- Toggle button: header “☀︎ / ☾” (`id="theme-toggle"`).

### Fonts
- Headings and UI accents: Sora (strong, modern display)
- Body and data: Inter (high readability)
You can change families in the two HTML files (Google Fonts link) and update references in `assets/style.css`.

### Contrast and readability
- Colors are chosen for eye comfort and WCAG‑friendly contrast.
- Containers and cards use `overflow-wrap: anywhere` to prevent clipping.

## Implementation notes

### Separation of concerns
- All styling lives in `assets/style.css`. No overriding inline blocks remain.
- App logic lives in `assets/app.js`; the HTML is mostly semantic structure.

### Robust selection handling
- Event delegation is used to handle clicks/keys reliably even when content is
  hidden, dynamically inserted, or re‑rendered.

### Optional AI integration
- The current code includes scaffolding for calling an AI endpoint (commented/guarded parts).
- Keep the local fallback scoring model as a safe default.

## Customization

### Change domain weights
In `assets/app.js`, adjust the `weights` object in `computeLocalScores(...)` to match your governance policy.

### Add/modify questions
- Duplicate an MCQ or checklist block in `ai-assessment-framework.html`.
- Give the inputs predictable `name`/`value` pairs.
- Map new fields into the relevant domains inside `computeLocalScores(...)`.

### Adjust color palettes
Update CSS variables in `:root` (light) and `[data-theme=dark]` (dark). Keep adequate contrast for readability.

## Deployment

### Static hosting
- Works on any static host (S3/CloudFront, GitHub Pages, Netlify, Vercel, Azure Static Web Apps).
- Ensure `assets/` is published and relative paths remain intact.

### GitHub Pages quick start
1) Commit this repo with the following structure at the root:
   - `index.html` (redirects to `ai-assessment-framework.html` so Pages serves the app)
   - `ai-assessment-framework.html`
   - `framework-overview.html`
   - `assets/` (styles, js, favicon)
2) In GitHub: Settings → Pages → Build and deployment:
   - Source: “Deploy from a branch”
   - Branch: `main` (or `master`) / Root (`/`)
3) Wait for the Pages workflow to finish. Visit the given URL. If caching shows the README, hard refresh; Pages will serve `index.html`.

Note: Pages serves `index.html` by default. Without it, GitHub shows `README.md`. The included `index.html` simply redirects to the main app HTML.

### Browser support
- Modern Chromium, Firefox, Safari, and Edge. PDF rendering is via `jsPDF`.

## Security, privacy, and disclaimers
- The assessment collects textual business context and scoring choices to compute risk. No information is transmitted unless you integrate an external AI API.
- The report is for internal risk guidance only and not legal advice. Validate with legal, compliance, and security experts before regulatory filings.

## Troubleshooting

### Theme toggle not switching
- Ensure the inline `<style>` block is not re‑introduced in HTML. Only `assets/style.css` should define variables.

### Multi‑select not toggling
- Delegated handlers are in `assets/app.js`. Verify elements have the `check-option` wrapper and an included `<input type="checkbox">`.

### PDF text overflow
- We adjusted legend height and font sizes. If you add longer labels, widen the columns or reduce `setFontSize` values in `downloadPDF()`.

## Contributing
- Keep HTML semantic and minimal; prefer CSS variables and utility sections for layout.
- Keep JS high‑readability: descriptive names, early returns, minimal nesting, and meaningful error handling.
- Avoid adding inline styles/scripts; update `assets/style.css` and `assets/app.js`.

## License
Provide your organization’s preferred license here.

