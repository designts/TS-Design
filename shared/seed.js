// Sample library used to seed an empty database (same records as the reference prototype).
import { emptyProject } from './project.js';
import { generateCaseStudy } from './generate.js';

function project(id, createdAt, updatedAt, data) {
  const base = emptyProject();
  return {
    ...base, ...data,
    assets: (data.assets || []).map((a) => ({ ...a, id: `${id}-${a.id}` })),
    staffing: { ...base.staffing, ...(data.staffing || {}) },
    id, createdAt, updatedAt,
  };
}

export const SEED_PROJECTS = [
  project('prj-sliceal', '2026-06-02T09:00:00Z', '2026-10-14T11:20:00Z', {
    name: 'Sliceal — Real Estate Tokenization Platform', tagline: 'A platform that allows users to invest in real estate using tokens and sell their properties as well.',
    description: 'Sliceal lets retail investors buy fractional tokens of real estate assets in Dubai, track their holdings and sell properties through a single mobile experience backed by an admin portal.',
    type: 'project', domain: 'Real Estate', industry: 'PropTech', client: 'Sliceal', engagementPeriod: '2025 – 2026',
    services: ['UI/UX Design', 'Mobile App Development', 'Admin Portal', 'API Integration'], platforms: ['Mobile', 'Admin'], tags: ['tokenization', 'investment', 'uae-pass'],
    solutionSummary: 'Platform Development: delivered a comprehensive tokenization platform for users to invest in real estate.',
    modules: ['Order Management (My Orders)', 'Property Listing & Discovery', 'Risk Profile', 'Profile Management', 'Wallet Management - Fiat Wallet', 'Order & Enquiry Management', 'Investment Calculator', 'CNT/ALT Integration', 'UAE Pass Authentication', 'Wallet Management - Token Wallet (UI)', 'Token Buy Flow (Invest / Buy Tokens)', 'Notifications & Alerts'],
    technologies: [{ id: 't1', name: 'Node.js', category: 'backend' }, { id: 't2', name: 'React', category: 'frontend' }, { id: 't3', name: 'Vue.js', category: 'frontend' }, { id: 't4', name: 'UAE Pass', category: 'integrations' }],
    scope: ['Product strategy & UX', 'Engineering & integration'],
    contribution: 'Designed and built the investor mobile app and the admin portal, including the UAE Pass sign-in and token purchase flow.',
    assets: [{ id: 'a1', title: 'Investor home', caption: 'Home screen with calculator and live property listings', kind: 'screenshot' }, { id: 'a2', title: 'Property detail', caption: 'Asset detail screen used to start the token buy flow', kind: 'screenshot' }],
    status: 'completed',
  }),
  project('prj-lendbridge', '2026-03-11T10:00:00Z', '2026-10-18T15:05:00Z', {
    name: 'LendBridge P2P Lending Platform', tagline: 'Connecting retail lenders with verified SME borrowers through a regulated marketplace.',
    description: 'A peer-to-peer lending marketplace covering borrower applications, credit assessment, lender investment and repayment tracking, with an operations console for the credit team.',
    type: 'project', domain: 'Fintech', industry: 'Lending', client: 'A regional digital lending start-up', engagementPeriod: 'Mar 2025 – Feb 2026',
    services: ['UI/UX Design', 'Web App Development', 'Mobile App Development', 'Admin Portal', 'API Integration'], platforms: ['Web', 'Mobile', 'Admin'], tags: ['p2p-lending', 'credit', 'marketplace'],
    businessContext: 'The client ran loan origination on spreadsheets and email, which limited how many SME applications the credit team could assess each month.',
    businessFunctions: ['Loan origination', 'Credit assessment', 'Investor management', 'Collections'], stakeholders: ['SME borrowers', 'Retail lenders', 'Credit analysts', 'Operations team'],
    businessProcesses: ['Borrower application', 'Credit decision', 'Loan funding', 'Repayment tracking'],
    challenges: [
      { id: 'c1', area: 'Operations', title: 'Manual loan origination', description: 'Applications arrived by email and were re-keyed into spreadsheets.', implication: 'Slow turnaround and limited monthly application capacity.' },
      { id: 'c2', area: 'Investors', title: 'No self-service for lenders', description: 'Lenders had no view of available loans or their returns.', implication: 'Lender onboarding depended on the sales team.' },
    ],
    solutionSummary: 'Built a borrower web app, a lender mobile app and a credit operations console on a shared lending core with automated credit-bureau checks.',
    modules: ['Borrower application', 'Credit scoring workbench', 'Loan marketplace', 'Lender wallet', 'Repayment schedule', 'Collections dashboard'],
    capabilities: [
      { id: 'cap1', name: 'Digital loan origination', category: 'Core operations', description: 'Borrowers apply online and track their application status.', users: 'SME borrowers', features: ['Guided application', 'Document upload', 'Status tracking'] },
      { id: 'cap2', name: 'Lender marketplace', category: 'Finance & payments', description: 'Lenders browse funded-ready loans and invest from their wallet.', users: 'Retail lenders', features: ['Loan listings', 'Auto-invest rules', 'Portfolio view'] },
    ],
    workflows: [{
      id: 'w1', name: 'SME loan application to funding', purpose: 'Takes a borrower from application to a funded loan with a single audit trail.', trigger: 'Borrower submits an online application',
      steps: [
        { id: 's1', label: 'Submit application & documents', lane: 'user', kind: 'action' }, { id: 's2', label: 'Credit bureau check', lane: 'external', kind: 'integration' },
        { id: 's3', label: 'Analyst credit decision', lane: 'user', kind: 'decision' }, { id: 's4', label: 'List loan on marketplace', lane: 'system', kind: 'process' },
        { id: 's5', label: 'Lenders fund loan', lane: 'user', kind: 'action' },
      ],
      systems: 'Credit team · Lending core · Credit bureau API', output: 'A funded loan with a repayment schedule visible to borrower and lenders',
    }],
    technologies: [{ id: 't1', name: 'React', category: 'frontend' }, { id: 't2', name: 'Flutter', category: 'frontend' }, { id: 't3', name: 'Java Spring Boot', category: 'backend' }, { id: 't4', name: 'PostgreSQL', category: 'data' }, { id: 't5', name: 'AWS', category: 'cloud' }, { id: 't6', name: 'Credit bureau API', category: 'integrations' }],
    outcomes: [
      { id: 'o1', value: '3x', label: 'Monthly applications processed', evidence: 'measured', baseline: 'Spreadsheet process', period: 'First 6 months live', source: 'Client operations report' },
      { id: 'o2', value: '', label: 'Lenders onboard without sales involvement', evidence: 'qualitative', baseline: '', period: '', source: 'Client feedback' },
    ],
    beforeAfter: [{ id: 'b1', process: 'Loan origination', before: 'Email and spreadsheets', after: 'Online application with status tracking' }],
    technicalHighlights: ['Event-driven repayment engine', 'Role-based access for credit and operations teams'],
    scope: ['Product strategy & UX', 'Engineering & integration', 'QA, deployment & support'],
    contribution: 'End-to-end product design and engineering, credit bureau integration, QA and production rollout.',
    assets: [{ id: 'a1', title: 'Credit workbench', caption: 'Analyst view used to review and decide on applications', kind: 'screenshot' }, { id: 'a2', title: 'Lender marketplace', caption: 'Mobile listing of loans open for funding', kind: 'screenshot' }],
    status: 'completed',
  }),
  project('prj-kyc', '2026-05-20T08:30:00Z', '2026-10-09T12:40:00Z', {
    name: 'Digital KYC & Onboarding Module', tagline: 'Remote identity verification that gets new customers onboarded in one session.',
    description: 'A reusable onboarding module with document capture, OCR, liveness check and national digital ID sign-in, built for a lending platform and reused in a wealth product.',
    type: 'feature', domain: 'Fintech', industry: 'Lending', client: 'A regional digital lending start-up', engagementPeriod: 'May – Aug 2025',
    services: ['UI/UX Design', 'Mobile App Development', 'API Integration'], platforms: ['Mobile', 'Web'], tags: ['kyc', 'onboarding', 'identity'],
    businessContext: 'Customers had to visit a branch or email scanned documents before they could transact.',
    businessFunctions: ['Customer onboarding', 'Compliance'], stakeholders: ['New customers', 'Compliance officers'],
    challenges: [{ id: 'c1', area: 'Compliance', title: 'Paper-based identity checks', description: 'Compliance staff verified scanned documents by hand.', implication: 'Onboarding took days and drop-off was high.' }],
    features: [{
      id: 'f1', name: 'Remote eKYC with liveness', problem: 'Manual document review delayed account opening.',
      solution: 'In-app document capture with OCR, a liveness selfie and automatic matching, with exceptions routed to compliance.',
      functionality: ['Capture ID document', 'OCR extracts identity fields', 'Liveness selfie and face match', 'Exceptions queued for compliance review'],
      benefit: 'Most customers complete verification in a single session without staff involvement.', relatedFeatures: ['National digital ID sign-in', 'Risk profiling'],
    }],
    capabilities: [{ id: 'cap1', name: 'Remote identity verification', category: 'Core operations', description: 'Verifies customers without a branch visit.', users: 'New customers · Compliance', features: ['OCR', 'Liveness', 'Face match'] }],
    workflows: [{
      id: 'w1', name: 'Customer onboarding', purpose: 'Verifies identity and opens an account in one guided flow.', trigger: 'Customer downloads the app and starts sign-up',
      steps: [
        { id: 's1', label: 'Capture ID & selfie', lane: 'user', kind: 'action' }, { id: 's2', label: 'OCR & face match', lane: 'external', kind: 'integration' },
        { id: 's3', label: 'Match above threshold?', lane: 'system', kind: 'decision' }, { id: 's4', label: 'Create account', lane: 'system', kind: 'process' },
      ],
      systems: 'Compliance · Onboarding service · eKYC vendor', output: 'A verified customer account ready to transact',
    }],
    technologies: [{ id: 't1', name: 'Flutter', category: 'frontend' }, { id: 't2', name: 'Node.js', category: 'backend' }, { id: 't3', name: 'eKYC vendor SDK', category: 'integrations' }, { id: 't4', name: 'AES-256 encryption at rest', category: 'security' }],
    outcomes: [{ id: 'o1', value: '', label: 'Branch visits no longer needed for onboarding', evidence: 'qualitative', baseline: '', period: '', source: 'Client product team' }],
    beforeAfter: [{ id: 'b1', process: 'Identity verification', before: 'Manual review of scanned documents', after: 'Automated checks with exception queue' }],
    scope: ['Product strategy & UX', 'Engineering & integration'],
    contribution: 'Designed the onboarding journey and integrated the eKYC vendor into the mobile app and onboarding service.',
    assets: [{ id: 'a1', title: 'Document capture', caption: 'Guided ID capture with edge detection', kind: 'screenshot' }],
    status: 'completed',
  }),
  project('prj-recon', '2026-07-03T14:00:00Z', '2026-10-20T09:10:00Z', {
    name: 'Automated Payments Reconciliation', tagline: 'Daily matching of gateway settlements against the lending ledger.',
    description: 'A reconciliation feature that ingests payment gateway settlement files, matches them to ledger entries and surfaces breaks for the finance team.',
    type: 'feature', domain: 'Fintech', industry: 'Lending', client: 'A regional digital lending start-up', engagementPeriod: 'Jul – Sep 2025',
    services: ['Web App Development', 'API Integration'], platforms: ['Admin'], tags: ['reconciliation', 'finance-ops'],
    businessFunctions: ['Finance operations'], stakeholders: ['Finance team'],
    challenges: [{ id: 'c1', area: 'Finance', title: 'Manual reconciliation', description: 'Finance matched settlement files to the ledger in spreadsheets every day.', implication: 'Breaks were found late and month-end close was slow.' }],
    features: [{
      id: 'f1', name: 'Settlement auto-matching', problem: 'Daily reconciliation was manual and error-prone.', solution: 'Scheduled ingestion of settlement files with rule-based matching and a break-resolution queue.',
      functionality: ['Import settlement files', 'Match on reference and amount', 'Queue unmatched items', 'Export reconciliation report'],
      benefit: 'Finance reviews only exceptions instead of every transaction.', relatedFeatures: ['Ledger export', 'Repayment schedule'],
    }],
    technologies: [{ id: 't1', name: 'Python', category: 'backend' }, { id: 't2', name: 'PostgreSQL', category: 'data' }, { id: 't3', name: 'Payment gateway SFTP', category: 'integrations' }, { id: 't4', name: 'Airflow', category: 'automation' }],
    beforeAfter: [{ id: 'b1', process: 'Daily reconciliation', before: 'Spreadsheet matching of every transaction', after: 'Automatic matching; finance reviews exceptions' }],
    scope: ['Engineering & integration'], contribution: 'Built the ingestion pipeline, matching rules and exception queue.', status: 'draft',
  }),
  project('prj-logistics-team', '2026-02-15T09:00:00Z', '2026-10-16T16:30:00Z', {
    name: 'Dedicated Engineering Team — Logistics SaaS', tagline: 'Flexible engineering capacity for a fleet-management platform rebuild.',
    description: "A dedicated cross-functional team that scaled with the client's platform rebuild, covering engineering, QA and data roles.",
    type: 'staffing', domain: 'Staffing', industry: 'Logistics', client: 'A European fleet-management SaaS company', engagementPeriod: 'Jan – Jun 2026',
    services: ['Dedicated Team', 'QA & Testing', 'Data & AI'], tags: ['dedicated-team', 'scaling'],
    technologies: [{ id: 't1', name: 'React', category: 'frontend' }, { id: 't2', name: 'Go', category: 'backend' }, { id: 't3', name: 'Kubernetes', category: 'cloud' }, { id: 't4', name: 'BigQuery', category: 'data' }],
    staffing: {
      reportingPeriod: 'Jan 2026 – Jun 2026', challengeSummary: 'The client needed to rebuild its platform faster than it could hire.',
      challengePoints: ['Platform rebuild committed to customers with a fixed launch window.', 'In-house hiring could not fill backend and QA roles in time.', 'Demand peaked during migration, then dropped after launch.'],
      approachSummary: 'A dedicated team that scaled up for migration and back down after launch.',
      approachPoints: ["Started with a core backend and QA pod aligned to the client's sprints.", 'Added data engineers for the analytics migration.', 'Released specialists after launch while keeping a support core.'],
      initialTeamSize: '5', peakTeamSize: '9', finalTeamSize: '6', durationMonths: '6', roles: ['Backend', 'Frontend', 'QA', 'DevOps', 'Data / AI'],
      deployment: [
        { id: 'm1', month: 'Jan', engineering: 3, qa: 1, other: 1 }, { id: 'm2', month: 'Feb', engineering: 4, qa: 1, other: 1 }, { id: 'm3', month: 'Mar', engineering: 5, qa: 2, other: 1 },
        { id: 'm4', month: 'Apr', engineering: 6, qa: 2, other: 1 }, { id: 'm5', month: 'May', engineering: 5, qa: 2, other: 1 }, { id: 'm6', month: 'Jun', engineering: 4, qa: 1, other: 1 },
      ],
      outcomeSummary: 'The team absorbed the migration peak and handed over a stable platform with a smaller support core.',
    },
    outcomes: [{ id: 'o1', value: '100%', label: 'Launch milestones delivered on schedule', evidence: 'measured', baseline: '', period: 'Jan – Jun 2026', source: 'Client delivery tracker' }],
    scope: ['Resource augmentation', 'Team management'], contribution: "Recruited, onboarded and managed the dedicated team inside the client's delivery process.", status: 'completed',
  }),
  project('prj-insurance-qa', '2026-08-01T09:00:00Z', '2026-10-12T10:00:00Z', {
    name: 'QA & DevOps Augmentation — Insurance Carrier', tagline: 'Specialist QA and DevOps capacity for a policy administration upgrade.',
    description: "Test automation and release engineering specialists embedded with the client's policy platform team.",
    type: 'staffing', domain: 'Staffing', industry: 'Insurance', client: 'A mid-sized general insurance carrier', engagementPeriod: 'Aug 2026 – ongoing',
    services: ['QA & Testing', 'DevOps'], tags: ['qa', 'devops', 'augmentation'],
    technologies: [{ id: 't1', name: 'Playwright', category: 'automation' }, { id: 't2', name: 'Azure DevOps', category: 'cloud' }],
    staffing: {
      reportingPeriod: 'Aug 2026 – Oct 2026', challengeSummary: 'Manual regression testing was blocking release frequency.',
      challengePoints: ['Regression cycles took most of each release window.', 'No in-house release engineering capacity.'],
      approachSummary: 'Embedded QA automation and DevOps specialists in the platform team.',
      approachPoints: ['Automated the highest-risk regression suites first.', 'Introduced pipeline-based releases.'],
      initialTeamSize: '2', peakTeamSize: '4', finalTeamSize: '4', durationMonths: '3', roles: ['QA', 'DevOps'],
      deployment: [{ id: 'm1', month: 'Aug', engineering: 0, qa: 2, other: 0 }, { id: 'm2', month: 'Sep', engineering: 0, qa: 3, other: 1 }, { id: 'm3', month: 'Oct', engineering: 0, qa: 3, other: 1 }],
      outcomeSummary: '',
    },
    scope: ['Resource augmentation'], status: 'draft',
  }),
  project('prj-wealth', '2026-09-05T11:00:00Z', '2026-10-21T13:45:00Z', {
    name: 'Wealth Advisory Portal', tagline: 'A single workspace for relationship managers and their clients.',
    description: 'Advisor and client portal for portfolio reviews, proposals and secure messaging, reusing the onboarding module.',
    type: 'project', domain: 'Fintech', industry: 'Wealth Management', client: 'A boutique wealth management firm', engagementPeriod: 'Sep 2026 – ongoing',
    services: ['UI/UX Design', 'Web App Development'], platforms: ['Web'], tags: ['wealth', 'advisory'],
    challenges: [{ id: 'c1', area: 'Advisors', title: 'Portfolio reviews prepared by hand', description: 'Advisors assembled review packs from several systems.', implication: 'Fewer client reviews per advisor each quarter.' }],
    modules: ['Portfolio overview', 'Proposal builder', 'Secure messaging'],
    technologies: [{ id: 't1', name: 'Next.js', category: 'frontend' }, { id: 't2', name: 'Node.js', category: 'backend' }],
    scope: ['Product strategy & UX'], status: 'draft',
  }),
];

function seedCaseStudy(id, type, projectIds, focus, status, date) {
  let n = 0;
  const projects = SEED_PROJECTS.filter((p) => projectIds.includes(p.id));
  return { ...generateCaseStudy(type, projects, focus, () => `${id}-${++n}`), id, status, createdAt: date, updatedAt: date };
}

export const SEED_CASE_STUDIES = [
  seedCaseStudy('cs-fintech-lending', 'feature', ['prj-lendbridge', 'prj-kyc', 'prj-recon'], 'Lending', 'completed', '2026-10-19T10:00:00Z'),
  seedCaseStudy('cs-sliceal', 'project', ['prj-sliceal'], '', 'completed', '2026-10-15T09:30:00Z'),
  seedCaseStudy('cs-staffing', 'staffing', ['prj-logistics-team', 'prj-insurance-qa'], '', 'draft', '2026-10-17T14:00:00Z'),
  seedCaseStudy('cs-lendbridge', 'project', ['prj-lendbridge'], '', 'draft', '2026-10-20T16:00:00Z'),
];
