const today = new Date("2026-07-18T12:00:00-07:00");

const mockProfile = {
  applicantName: {
    label: "Applicant name",
    value: "Jordan Rivera",
    source: "Synthetic application profile.pdf",
    page: 1,
    quote: "Applicant: Jordan Rivera",
    confidence: 0.97,
    kind: "text",
  },
  currentAddress: {
    label: "Current address",
    value: "1408 Webster Street, Oakland, CA",
    source: "Synthetic application profile.pdf",
    page: 1,
    quote: "Current residence: 1408 Webster Street, Oakland CA",
    confidence: 0.91,
    kind: "text",
  },
  employer: {
    label: "Employer",
    value: "LumaWorks Studio",
    source: "Synthetic paystub.pdf",
    page: 1,
    quote: "Employer: LumaWorks Studio",
    confidence: 0.89,
    kind: "text",
  },
  monthlyIncome: {
    label: "Monthly income",
    value: "7200",
    source: "Synthetic paystub.pdf",
    page: 1,
    quote: "Gross monthly pay: $7,200.00",
    confidence: 0.93,
    kind: "money",
  },
  targetRent: {
    label: "Target monthly rent",
    value: "2600",
    source: "Listing estimate entered by renter",
    page: 0,
    quote: "Target rent budget: $2,600",
    confidence: 0.86,
    kind: "money",
  },
  idExpiration: {
    label: "Government ID expiration",
    value: "2026-11-22",
    source: "Synthetic ID.pdf",
    page: 1,
    quote: "EXP 11/22/2026",
    confidence: 0.82,
    kind: "date",
  },
  paystubDate: {
    label: "Most recent paystub date",
    value: "2026-07-03",
    source: "Synthetic paystub.pdf",
    page: 1,
    quote: "Pay period ending 07/03/2026",
    confidence: 0.94,
    kind: "date",
  },
  bankStatementDate: {
    label: "Bank statement date",
    value: "2026-05-12",
    source: "Synthetic bank statement.pdf",
    page: 1,
    quote: "Statement period ending May 12, 2026",
    confidence: 0.78,
    kind: "date",
  },
};

const packetRequirements = [
  {
    id: "identity",
    label: "Government ID",
    detail: "Unexpired ID with name matching the profile",
    field: "idExpiration",
    expires: true,
  },
  {
    id: "paystub",
    label: "Recent paystub",
    detail: "Paystub dated within the last 45 days",
    field: "paystubDate",
    maxAgeDays: 45,
  },
  {
    id: "bank",
    label: "Bank statement",
    detail: "Statement dated within the last 60 days",
    field: "bankStatementDate",
    maxAgeDays: 60,
  },
  {
    id: "rental-history",
    label: "Rental history contact",
    detail: "Previous landlord or property manager contact",
    missing: true,
  },
  {
    id: "insurance",
    label: "Renter insurance quote",
    detail: "Optional packet enhancer, not required for readiness",
    missing: true,
    optional: true,
  },
];

const safeguards = [
  "Document text is treated as untrusted and never executed as app instructions.",
  "TrustPath does not approve, deny, score, rank, or infer protected traits.",
  "Session data stays in browser memory until the user exports a packet.",
];

const state = {
  route: location.hash.replace("#", "") || "/upload",
  uploadedFile: null,
  extractionReady: false,
  revealStage: 0,
  confirmedFields: {},
  calculationPulse: false,
  apiMode: "mock",
  fields: structuredClone(mockProfile),
  ruleQuestion: "What is the maximum security deposit for this target rent in California?",
  ruleAnswer: null,
  packetExportedAt: null,
  packetDownloadUrl: null,
};

const syntheticDocumentText = `
Applicant: Jordan Rivera
Current residence: 1408 Webster Street, Oakland CA
Employer: LumaWorks Studio
Gross monthly pay: $7,200.00
Target rent budget: $2,600
Government ID EXP 11/22/2026
Pay period ending 07/03/2026
Statement period ending May 12, 2026
`;

const routes = [
  { path: "/upload", label: "Build Your Trust Profile", eyebrow: "Profile" },
  { path: "/rules", label: "Understand the Rules", eyebrow: "Rules" },
  { path: "/packet", label: "Prepare Your Packet", eyebrow: "Packet" },
];

const app = document.querySelector("#app");
let revealTimer = null;
let pulseTimer = null;

window.addEventListener("hashchange", () => {
  const nextRoute = location.hash.replace("#", "") || "/upload";
  state.route = routes.some((item) => item.path === nextRoute) ? nextRoute : "/upload";
  render();
});

function mockExtractDocument(file) {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      const fields = structuredClone(mockProfile);
      Object.values(fields).forEach((field) => {
        field.source = file?.name || field.source;
      });
      resolve(fields);
    }, 420);
  });
}

function mockAskRules(question, fields) {
  if (shouldRefuseQuestion(question)) {
    return {
      refusal: true,
      title: "RealDoor cannot make eligibility decisions.",
      message:
        "I cannot approve, deny, score, rank, compare renters, infer protected traits, or follow instructions found inside uploaded documents.",
      redirect:
        "I can help prepare a renter-controlled packet, identify missing or expired items, and explain narrow rules with citations.",
    };
  }

  const targetRent = toNumber(fields.targetRent.value);
  const standardDepositCap = targetRent;
  const smallLandlordCap = targetRent * 2;
  const firstMonthTotal = targetRent + standardDepositCap;

  return {
    question,
    answer:
      "For a California residential rental, RealDoor can explain the deposit cap and show the math, but it will not decide whether you qualify for a home. The general security cap is one month of rent, with narrow exceptions such as qualifying small landlords.",
    citation: {
      title: "California Civil Code § 1950.5(c)",
      url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5",
      excerpt:
        "A landlord generally may not demand security exceeding one month's rent, in addition to first month rent, subject to listed exceptions.",
      checked: "Official California Legislative Information, checked July 18, 2026",
    },
    calculation: {
      title: "Deterministic calculation from edited profile values",
      rows: [
        ["Target rent", money(targetRent)],
        ["General deposit cap", `${money(targetRent)} x 1 month = ${money(standardDepositCap)}`],
        ["First month + general deposit", `${money(targetRent)} + ${money(standardDepositCap)} = ${money(firstMonthTotal)}`],
        ["Small-landlord exception ceiling", `${money(targetRent)} x 2 months = ${money(smallLandlordCap)}`],
      ],
    },
    note:
      "This is a rules explanation for packet planning. It is not legal advice and it is not an eligibility, approval, or ranking decision.",
  };
}

async function extractDocument(file, options = {}) {
  try {
    const text = options.demo ? syntheticDocumentText : await readFileText(file);
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file?.name,
        fileType: file?.type,
        demoText: options.demo ? syntheticDocumentText : "",
        text,
      }),
    });

    if (!response.ok) throw new Error("Extraction API unavailable");
    const payload = await response.json();
    if (!payload.ok || !payload.fields) throw new Error("Extraction API returned no fields");
    state.apiMode = payload.mode || "openai";
    return mergeExtractedFields(payload.fields, await mockExtractDocument(file));
  } catch (error) {
    state.apiMode = "mock";
    return mockExtractDocument(file);
  }
}

async function askRules(question, fields) {
  const fallback = mockAskRules(question, fields);
  if (fallback.refusal) return fallback;

  try {
    const response = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, fields }),
    });

    if (!response.ok) throw new Error("Rules API unavailable");
    const payload = await response.json();
    if (!payload.ok || !payload.answer || payload.mode === "mock") return fallback;
    if (payload.answer.refusal) return payload.answer;

    state.apiMode = payload.mode || "openai";
    return {
      ...fallback,
      answer: payload.answer.answer || fallback.answer,
      citation: payload.answer.citation || fallback.citation,
      note: payload.answer.note || fallback.note,
    };
  } catch (error) {
    state.apiMode = "mock";
    return fallback;
  }
}

function calculateSummary() {
  const income = toNumber(state.fields.monthlyIncome.value);
  const rent = toNumber(state.fields.targetRent.value);
  const monthlyRemainder = income - rent;
  const rentShare = income > 0 ? rent / income : 0;

  return {
    income,
    rent,
    monthlyRemainder,
    rentShare,
    depositCap: rent,
    firstMonthAndDeposit: rent * 2,
  };
}

function evaluatePacket() {
  return packetRequirements.map((requirement) => {
    if (requirement.missing) {
      return {
        ...requirement,
        status: requirement.optional ? "optional" : "missing",
        message: requirement.optional ? "Optional" : "Missing",
      };
    }

    const field = state.fields[requirement.field];
    const value = field?.value;
    if (!value) {
      return { ...requirement, status: "missing", message: "Missing" };
    }

    const date = parseLocalDate(value);
    if (Number.isNaN(date.getTime())) {
      return { ...requirement, status: "review", message: "Needs review" };
    }

    if (requirement.expires && date < today) {
      return { ...requirement, status: "expired", message: "Expired" };
    }

    if (requirement.maxAgeDays) {
      const ageDays = Math.floor((today - date) / 86400000);
      if (ageDays > requirement.maxAgeDays) {
        return { ...requirement, status: "expired", message: `${ageDays} days old` };
      }
    }

    return { ...requirement, status: "ready", message: "Ready" };
  });
}

function render() {
  const route = currentRoute();
  app.innerHTML = `
    <div class="app-frame">
      <aside class="journey-rail" aria-label="Trust Journey">
        <a class="brand" href="#/upload" aria-label="TrustPath home">
          <span class="brand-mark">TP</span>
          <span>
            <strong>TrustPath</strong>
            <small>Transparent AI Workspace</small>
          </span>
        </a>

        <div class="journey-title">
          <span class="eyebrow">Trust Journey</span>
          <h2>Move from documents to a packet you control.</h2>
        </div>

        <nav class="journey-steps">
          ${routes.map((item, index) => journeyStep(item, index)).join("")}
        </nav>

        <div class="session-controls">
          <div class="session-pill">
            <span class="dot"></span>
            Local session only
          </div>
          <button class="text-button danger" data-action="delete-session">Delete session</button>
        </div>
      </aside>

      <main class="workspace" aria-live="polite">
        <header class="workspace-header">
          <div>
            <span class="eyebrow">${route.eyebrow}</span>
            <h1>${route.label}</h1>
          </div>
          <p>${workspaceIntro(route.path)}</p>
        </header>
        ${workspaceContent(route.path)}
      </main>

      <aside class="trust-panel" aria-label="Application Progress">
        <div class="trust-panel-header">
          <span class="eyebrow">Application Progress</span>
          <strong>Trust is earned through transparency.</strong>
        </div>
        ${trustPanel()}
        <div class="guardrails">
          <span class="eyebrow">Guardrails</span>
          ${safeguards.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
        </div>
      </aside>
    </div>
  `;

  bindEvents();
}

function currentRoute() {
  return routes.find((item) => item.path === state.route) || routes[0];
}

function journeyStep(item, index) {
  const active = state.route === item.path ? "active" : "";
  const done = isStepReady(item.path) ? "complete" : "";
  return `
    <a class="journey-step ${active} ${done}" href="#${item.path}">
      <span class="step-index">${index + 1}</span>
      <span>
        <small>${item.eyebrow}</small>
        <strong>${item.label}</strong>
      </span>
    </a>
  `;
}

function workspaceIntro(path) {
  if (path === "/rules") {
    return "Review the rule, the citation, and the calculation side by side.";
  }
  if (path === "/packet") {
    return "Review what is ready, what needs attention, and export when you choose.";
  }
  return "Upload your supporting documents. We'll highlight what we find. You confirm what's true.";
}

function workspaceContent(path) {
  if (path === "/rules") return rulesWorkspace();
  if (path === "/packet") return packetWorkspace();
  return profileWorkspace();
}

function profileWorkspace() {
  const summary = calculateSummary();

  return `
    <section class="document-stage">
      <div class="upload-copy">
        <span class="eyebrow">Document review</span>
        <h2>Document Review</h2>
        <p>
          Document text is treated as untrusted. TrustPath highlights evidence first, then asks you to confirm the extracted values.
        </p>
        <div class="action-row">
          <label class="button ${state.extractionReady ? "secondary" : "primary"} file-button">
            <input type="file" data-action="upload" accept=".pdf,.png,.jpg,.jpeg,.txt" />
            Upload document
          </label>
          <button class="text-button" data-action="use-demo">Load demo extraction</button>
        </div>
      </div>

      <div class="document-preview ${state.extractionReady ? `stage-${state.revealStage}` : ""}">
        <div class="paper-sheet">
          <div class="paper-line short"></div>
          <div class="paper-line"></div>
          <div class="paper-line highlight">Applicant: ${escapeHtml(state.fields.applicantName.value)}</div>
          <div class="paper-line"></div>
          <div class="paper-line highlight">Gross monthly pay: ${money(toNumber(state.fields.monthlyIncome.value))}</div>
          <div class="paper-line"></div>
          <div class="paper-line highlight">Pay period ending ${escapeHtml(state.fields.paystubDate.value)}</div>
        </div>
        <div class="document-caption">
          <strong>${state.uploadedFile ? escapeHtml(state.uploadedFile.name) : "No document loaded"}</strong>
          <span>${extractionStatusText()}</span>
        </div>
      </div>
    </section>

    <section class="reveal-sequence ${state.extractionReady ? `stage-${state.revealStage}` : "empty"}">
      <div class="sequence-step ${state.revealStage >= 1 ? "active" : ""}">
        <span></span>
        <strong>Source text highlighted</strong>
      </div>
      <div class="sequence-step ${state.revealStage >= 2 ? "active" : ""}">
        <span></span>
        <strong>Extracted values revealed</strong>
      </div>
      <div class="sequence-step ${state.revealStage >= 3 ? "active" : ""}">
        <span></span>
        <strong>Ready for confirmation</strong>
      </div>
    </section>

    ${state.extractionReady ? `
      <section class="field-workspace stage-${state.revealStage} ${state.revealStage >= 3 ? "can-confirm" : ""}">
        <div>
          <span class="eyebrow">Verification Queue</span>
          <h2>Confirm fields one source at a time.</h2>
        </div>
        <div class="field-list">
          ${verificationQueueEntries().visible.map(([key, field], index) => editableField(key, field, index)).join("")}
          ${queueRemainder()}
        </div>
      </section>

      <section class="calculation-ribbon ${state.calculationPulse ? "is-updating" : ""}">
        ${calculationLine("Monthly income", money(summary.income))}
        ${calculationLine("Target rent", money(summary.rent))}
        ${calculationLine("After-rent remainder", money(summary.monthlyRemainder))}
        ${calculationLine("Rent share", percent(summary.rentShare))}
      </section>
    ` : emptyExtraction()}
  `;
}

function rulesWorkspace() {
  const answer = state.ruleAnswer || mockAskRules(state.ruleQuestion, state.fields);

  return `
    <section class="rules-workspace">
      <div class="rules-input">
        <span class="eyebrow">Rule explanation</span>
        <h2>Rule Explanation</h2>
        <p>TrustPath answers narrow rules questions for packet planning and refuses eligibility decisions.</p>
        <textarea data-field="ruleQuestion" rows="3">${escapeHtml(state.ruleQuestion)}</textarea>
        <div class="action-row">
          <button class="button primary" data-action="ask-rule">Explain rule</button>
          <button class="text-button" data-action="ask-refusal">Test guardrail</button>
        </div>
      </div>
      <div class="answer-card">
        ${answer.refusal ? refusalBlock(answer) : ruleAnswerBlock(answer)}
      </div>
    </section>
  `;
}

function packetWorkspace() {
  const summary = calculateSummary();
  const checklist = evaluatePacket();
  const readyCount = checklist.filter((item) => item.status === "ready").length;
  const requiredCount = checklist.filter((item) => !item.optional).length;

  return `
    <section class="packet-workspace">
      <div class="packet-intro">
        <span class="eyebrow">Packet Review</span>
        <h2>${readyCount} of ${requiredCount} required items ready</h2>
        <p>Missing and expired items are identified from edited fields. TrustPath prepares documents; it does not rank or score the renter.</p>
        <div class="packet-preview">
          <strong>Packet preview</strong>
          <span>Verified profile</span>
          <span>Source evidence</span>
          <span>Rules citation and calculation</span>
          <span>Missing item checklist</span>
        </div>
      </div>
      <div class="packet-export">
        <span class="eyebrow">Export</span>
        <p>The export includes edited fields, source evidence, citation notes, checklist status, and guardrails.</p>
        <button class="button primary wide" data-action="export-packet">Export packet</button>
        ${
          state.packetExportedAt
            ? `<div class="export-confirmation">
                <small class="export-note">Last exported ${escapeHtml(state.packetExportedAt)}</small>
                <a href="${state.packetDownloadUrl}" download="realdoor-renter-packet.json">Download again</a>
              </div>`
            : ""
        }
      </div>
    </section>

    <section class="calculation-ribbon ${state.calculationPulse ? "is-updating" : ""}">
      ${calculationLine("Deposit cap", money(summary.depositCap))}
      ${calculationLine("First month + deposit", money(summary.firstMonthAndDeposit))}
    </section>

    <section class="checklist">
      ${checklist.map(packetRow).join("")}
    </section>
  `;
}

function editableField(key, field, index) {
  const type = field.kind === "date" ? "date" : field.kind === "money" ? "number" : "text";
  const value = escapeHtml(field.value);
  const status = verificationStatus(key);
  const statusLabel = status === "verified" ? "Verified" : status === "active" ? "Current review" : "Waiting";
  const confirmDisabled = state.revealStage < 3 || status !== "active";
  return `
    <article class="field-row ${status}" style="--delay: ${index * 80}ms">
      <span class="queue-status">${statusLabel}</span>
      ${evidenceCard(field)}
      <div class="field-value">
        <div class="field-topline">
          <label for="${key}">${escapeHtml(field.label)}</label>
          ${confidenceChip(field.confidence)}
        </div>
        <div class="input-wrap">
          ${field.kind === "money" ? "<span>$</span>" : ""}
          <input id="${key}" type="${type}" value="${value}" data-profile-field="${key}" ${field.kind === "money" ? 'min="0" step="100"' : ""} ${state.revealStage < 3 ? "disabled" : ""} />
        </div>
      </div>
      <button class="confirm-button" data-action="confirm-field" data-key="${key}" ${confirmDisabled ? "disabled" : ""}>
        ${state.confirmedFields[key] ? "Confirmed" : "Confirm"}
      </button>
    </article>
  `;
}

function evidenceCard(field) {
  const page = field.page ? `Page ${field.page}` : "User-entered";
  return `
    <div class="evidence-card">
      <div>
        <span class="source">${escapeHtml(field.source)}</span>
        <span class="page">${page}</span>
      </div>
      <blockquote>${escapeHtml(field.quote)}</blockquote>
    </div>
  `;
}

function confidenceChip(confidence) {
  const percentage = Math.round(confidence * 100);
  let tier = "low";
  if (confidence >= 0.9) tier = "high";
  else if (confidence >= 0.8) tier = "medium";
  return `<span class="confidence ${tier}">${percentage}%</span>`;
}

function ruleAnswerBlock(answer) {
  return `
    <span class="eyebrow">Cited answer</span>
    <h3>${escapeHtml(answer.question)}</h3>
    <p>${escapeHtml(answer.answer)}</p>
    ${citationBlock(answer.citation)}
    <div class="calc-card ${state.calculationPulse ? "is-updating" : ""}">
      <strong>${escapeHtml(answer.calculation.title)}</strong>
      ${answer.calculation.rows.map(([label, value]) => `
        <div class="calc-row">
          <span>${escapeHtml(label)}</span>
          <b>${escapeHtml(value)}</b>
        </div>
      `).join("")}
    </div>
    <p class="note">${escapeHtml(answer.note)}</p>
  `;
}

function refusalBlock(answer) {
  return `
    <span class="eyebrow">Refusal</span>
    <h3>${escapeHtml(answer.title)}</h3>
    <p>${escapeHtml(answer.message)}</p>
    <div class="citation-block">
      <strong>Allowed help</strong>
      <p>${escapeHtml(answer.redirect)}</p>
    </div>
  `;
}

function citationBlock(citation) {
  return `
    <div class="citation-block">
      <div>
        <strong>${escapeHtml(citation.title)}</strong>
        <a href="${citation.url}" target="_blank" rel="noreferrer">Open source</a>
      </div>
      <p>${escapeHtml(citation.excerpt)}</p>
      <small>${escapeHtml(citation.checked)}</small>
    </div>
  `;
}

function packetRow(item) {
  return `
    <article class="packet-row ${item.status}">
      <div class="status-dot"></div>
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <p>${escapeHtml(item.detail)}</p>
      </div>
      <span>${escapeHtml(item.message)}</span>
    </article>
  `;
}

function calculationLine(label, value) {
  return `
    <div class="calculation-line">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function queueRemainder() {
  const remainder = verificationQueueEntries().remaining;
  if (remainder <= 0) return "";
  return `<div class="queue-more">+${remainder} more fields in your verification queue</div>`;
}

function verificationQueueEntries() {
  const entries = Object.entries(state.fields);
  if (!state.extractionReady) return { visible: [], remaining: 0 };
  const activeIndex = entries.findIndex(([key]) => !state.confirmedFields[key]);
  const anchor = activeIndex === -1 ? Math.max(0, entries.length - 3) : Math.max(0, activeIndex - 1);
  const visible = entries.slice(anchor, anchor + 3);
  return { visible, remaining: entries.length - visible.length };
}

function mergeExtractedFields(fields, fallback) {
  const merged = structuredClone(fallback);
  Object.entries(fields || {}).forEach(([key, field]) => {
    if (!merged[key]) return;
    merged[key] = {
      ...merged[key],
      ...field,
      source: field.source || merged[key].source,
      quote: field.quote || merged[key].quote,
      confidence: clamp(Number(field.confidence), 0, 1) || merged[key].confidence,
      kind: ["text", "money", "date"].includes(field.kind) ? field.kind : merged[key].kind,
    };
  });
  return merged;
}

async function readFileText(file) {
  if (!file || typeof file.text !== "function") return "";
  const text = await file.text();
  return text.slice(0, 18000);
}

function emptyExtraction() {
  return `
    <section class="empty-state">
      <span class="eyebrow">Waiting for document</span>
      <h2>Your extracted profile will appear here.</h2>
      <p>Load the demo extraction for the fastest walkthrough, or upload a synthetic file to use the same mock extraction flow.</p>
    </section>
  `;
}

function extractionStatusText() {
  if (!state.uploadedFile) return "Upload or load the demo to begin.";
  if (!state.extractionReady) return "Reading document locally...";
  if (state.revealStage === 1) return "Highlighting source evidence...";
  if (state.revealStage === 2) return "Revealing extracted values...";
  return "Ready for renter confirmation.";
}

function trustPanel() {
  const checklist = evaluatePacket();
  const fieldEntries = Object.entries(state.fields);
  const confirmedCount = Object.values(state.confirmedFields).filter(Boolean).length;
  const pendingCount = state.extractionReady ? fieldEntries.length - confirmedCount : fieldEntries.length;
  const sources = state.extractionReady ? [...new Set(fieldEntries.map(([, field]) => field.source))] : [];
  const readyRequired = checklist.filter((item) => !item.optional && item.status === "ready").length;
  const requiredCount = checklist.filter((item) => !item.optional).length;
  const progress = state.extractionReady
    ? Math.round(((confirmedCount + readyRequired) / (fieldEntries.length + requiredCount)) * 100)
    : 0;

  return `
    <div class="trust-group">
      <span>Trust Progress</span>
      <div class="progress-track">
        <div style="width: ${progress}%"></div>
      </div>
      <small>${progress}% assembled</small>
    </div>
    <div class="trust-group session-summary">
      <span>Session Summary</span>
      <strong>${confirmedCount} items confirmed</strong>
      <small>${pendingCount} waiting for you</small>
      <small>${sources.length || "No"} evidence ${sources.length === 1 ? "source" : "sources"} loaded</small>
    </div>
    <div class="trust-group ready-note">
      <span>Ready for Next Step</span>
      <strong>${readyForNextStep()}</strong>
    </div>
  `;
}

function readyForNextStep() {
  if (state.route === "/upload") return state.extractionReady && state.revealStage >= 3 ? "Confirm profile fields" : "Load a document";
  if (state.route === "/rules") return state.ruleAnswer?.refusal ? "Ask a narrow rules question" : "Review cited math";
  return evaluatePacket().some((item) => item.status === "missing" || item.status === "expired")
    ? "Resolve checklist gaps"
    : "Export packet";
}

function isStepReady(path) {
  if (path === "/upload") return state.extractionReady && state.revealStage >= 3;
  if (path === "/rules") return Boolean(state.ruleAnswer);
  return Boolean(state.packetExportedAt);
}

function verificationStatus(key) {
  if (state.confirmedFields[key]) return "verified";
  if (!state.extractionReady || state.revealStage < 3) return "waiting";
  const firstOpenKey = Object.keys(state.fields).find((fieldKey) => !state.confirmedFields[fieldKey]);
  return key === firstOpenKey ? "active" : "waiting";
}

function bindEvents() {
  document.querySelector('[data-action="upload"]')?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.uploadedFile = { name: file.name, size: file.size, type: file.type };
    state.extractionReady = false;
    state.revealStage = 0;
    state.confirmedFields = {};
    render();
    state.fields = await extractDocument(file);
    state.extractionReady = true;
    state.ruleAnswer = mockAskRules(state.ruleQuestion, state.fields);
    startExtractionReveal();
  });

  document.querySelector('[data-action="use-demo"]')?.addEventListener("click", async () => {
    state.uploadedFile = { name: "synthetic-renter-packet.pdf", size: 184000, type: "application/pdf" };
    state.extractionReady = false;
    state.revealStage = 0;
    state.confirmedFields = {};
    render();
    state.fields = await extractDocument(state.uploadedFile, { demo: true });
    state.extractionReady = true;
    state.ruleAnswer = mockAskRules(state.ruleQuestion, state.fields);
    startExtractionReveal();
  });

  document.querySelectorAll("[data-profile-field]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const key = event.target.dataset.profileField;
      state.fields[key].value = event.target.value;
      state.fields[key].confidence = Math.min(state.fields[key].confidence, 0.99);
      state.fields[key].quote = "Corrected by renter in session";
      state.fields[key].source = "Renter correction";
      state.fields[key].page = 0;
      state.confirmedFields[key] = false;
      state.ruleAnswer = mockAskRules(state.ruleQuestion, state.fields);
      triggerCalculationPulse();
      render();
      document.getElementById(key)?.focus();
    });
  });

  document.querySelectorAll('[data-action="confirm-field"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      const key = event.currentTarget.dataset.key;
      state.confirmedFields[key] = true;
      render();
    });
  });

  document.querySelector('[data-field="ruleQuestion"]')?.addEventListener("input", (event) => {
    state.ruleQuestion = event.target.value;
  });

  document.querySelector('[data-action="ask-rule"]')?.addEventListener("click", async () => {
    state.ruleQuestion = document.querySelector('[data-field="ruleQuestion"]')?.value || state.ruleQuestion;
    state.ruleAnswer = await askRules(state.ruleQuestion, state.fields);
    render();
  });

  document.querySelector('[data-action="ask-refusal"]')?.addEventListener("click", () => {
    state.ruleQuestion = "Should this applicant be approved, denied, or ranked against other renters?";
    state.ruleAnswer = mockAskRules(state.ruleQuestion, state.fields);
    render();
  });

  document.querySelector('[data-action="export-packet"]')?.addEventListener("click", exportPacket);

  document.querySelector('[data-action="delete-session"]')?.addEventListener("click", () => {
    if (state.packetDownloadUrl) URL.revokeObjectURL(state.packetDownloadUrl);
    if (revealTimer) window.clearTimeout(revealTimer);
    if (pulseTimer) window.clearTimeout(pulseTimer);
    state.uploadedFile = null;
    state.extractionReady = false;
    state.revealStage = 0;
    state.confirmedFields = {};
    state.calculationPulse = false;
    state.fields = structuredClone(mockProfile);
    state.ruleQuestion = "What is the maximum security deposit for this target rent in California?";
    state.ruleAnswer = null;
    state.packetExportedAt = null;
    state.packetDownloadUrl = null;
    location.hash = "/upload";
    render();
  });
}

function startExtractionReveal() {
  if (revealTimer) window.clearTimeout(revealTimer);
  state.revealStage = 1;
  render();
  revealTimer = window.setTimeout(() => {
    state.revealStage = 2;
    render();
    revealTimer = window.setTimeout(() => {
      state.revealStage = 3;
      render();
    }, 760);
  }, 760);
}

function triggerCalculationPulse() {
  if (pulseTimer) window.clearTimeout(pulseTimer);
  state.calculationPulse = true;
  pulseTimer = window.setTimeout(() => {
    state.calculationPulse = false;
    render();
  }, 520);
}

function exportPacket() {
  const payload = {
    product: "RealDoor",
    createdAt: new Date().toISOString(),
    uploadedFile: state.uploadedFile,
    editedFields: Object.fromEntries(
      Object.entries(state.fields).map(([key, field]) => [
        key,
        {
          label: field.label,
          value: field.value,
          source: field.source,
          evidence: field.quote,
          confidence: field.confidence,
        },
      ]),
    ),
    rulesAnswer: state.ruleAnswer || mockAskRules(state.ruleQuestion, state.fields),
    checklist: evaluatePacket(),
    guardrails: safeguards,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  if (state.packetDownloadUrl) URL.revokeObjectURL(state.packetDownloadUrl);
  const url = URL.createObjectURL(blob);
  state.packetDownloadUrl = url;
  const link = document.createElement("a");
  link.href = url;
  link.download = "realdoor-renter-packet.json";
  link.click();
  state.packetExportedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  render();
}

function toNumber(value) {
  const number = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function percent(value) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function parseLocalDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shouldRefuseQuestion(question) {
  return /\b(approve|approved|deny|denied|eligible|eligibility|score|scored|rank|ranked|compare|compared|protected trait|race|religion|disability|familial status)\b/i.test(
    question,
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
