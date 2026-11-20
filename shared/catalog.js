// Option lists, labels and the fixed TechStalwarts company profile.
// Shared by the server (generator, seed) and the browser (forms, renderer).

export const ORG = 'TechStalwarts';

export const INDUSTRIES_BY_DOMAIN = {
  Fintech: ['Lending', 'Payments', 'Wealth Management', 'Banking', 'Insurance Tech', 'Capital Markets'],
  'Real Estate': ['PropTech', 'Construction', 'Facility Management', 'REIT & Fractional Investment'],
  Staffing: ['Logistics', 'Insurance', 'Retail', 'Healthcare', 'Fintech', 'Technology'],
  Healthcare: ['Hospitals', 'Telemedicine', 'Pharma', 'Health Insurance'],
  Logistics: ['Fleet Management', 'Last-mile Delivery', 'Warehousing', 'Freight'],
  Insurance: ['General Insurance', 'Life Insurance', 'Claims', 'Brokerage'],
  Retail: ['E-commerce', 'Point of Sale', 'Grocery', 'Marketplace'],
  Education: ['EdTech', 'Higher Education', 'K-12', 'Corporate Training'],
  Travel: ['Attractions & Ticketing', 'Hospitality', 'Online Travel Agency', 'Mobility'],
  Government: ['Public Services', 'Policing', 'Agriculture', 'Municipal'],
};
export const ALL_INDUSTRIES = [...new Set(Object.values(INDUSTRIES_BY_DOMAIN).flat())].sort();
export const DOMAINS = ['Fintech', 'Real Estate', 'Staffing', 'Healthcare', 'Logistics', 'Insurance', 'Retail', 'Education', 'Travel', 'Government'];
export const PLATFORMS = ['Web', 'Mobile', 'Admin', 'API', 'Desktop'];
export const SCOPES = ['Product strategy & UX', 'Engineering & integration', 'QA, deployment & support', 'Resource augmentation', 'Team management'];
export const SERVICES = ['UI/UX Design', 'Web App Development', 'Mobile App Development', 'Admin Portal', 'API Integration', 'QA & Testing', 'DevOps', 'Data & AI', 'Dedicated Team'];
export const ROLES = ['Frontend', 'Backend', 'QA', 'DevOps', 'Data / AI', 'Project manager', 'Business analyst'];

export const PROJECT_TYPES = [
  { value: 'feature', label: 'Feature-specific within a domain', short: 'Feature-specific', description: 'A feature or capability we built inside a domain: the problem it solves, how it works and the benefit it delivers.' },
  { value: 'project', label: 'Project-specific', short: 'Project-specific', description: 'A single product or engagement end to end: context, challenges, the solution and modules delivered, and outcomes.' },
  { value: 'staffing', label: 'Staffing and recruitment', short: 'Staffing', description: 'A resource engagement: the capability gap, team structure, how the team scaled, and the impact on delivery.' },
];
export const CASE_STUDY_TYPES = [
  { value: 'feature', label: 'Feature-specific within a domain', short: 'Domain / feature', description: 'Showcases a domain or a specific capability across several projects: challenges, capabilities, feature showcases, workflows, technology and impact.', selection: 'Select one or more projects from the same domain.' },
  { value: 'project', label: 'Project-specific', short: 'Project-specific', description: 'Tells the story of one project: what the client needed, what we built, the modules delivered and the results.', selection: 'Select one project.' },
  { value: 'staffing', label: 'Staffing and recruitment', short: 'Staffing', description: 'Consolidates staffing engagements into a view of our resourcing capability: team strategy, scaling and business impact.', selection: 'Select one or more Staffing projects.' },
];
export const caseStudyTypeShort = (v) => CASE_STUDY_TYPES.find((t) => t.value === v).short;
export const projectTypeShort = (v) => PROJECT_TYPES.find((t) => t.value === v).short;

export const ASSET_KINDS = { screenshot: 'Screenshot', diagram: 'Diagram', logo: 'Logo', document: 'Document' };
export const EVIDENCE = { measured: 'Measured', qualitative: 'Qualitative', expected: 'Expected' };
export const LANES = { user: 'User / role', system: 'Platform / system', external: 'External service' };
export const STEP_KINDS = { action: 'User action', process: 'System process', decision: 'Decision / approval', integration: 'External integration' };
export const STATUS_LABELS = { draft: 'Draft', completed: 'Completed' };
export const TECH_CATEGORIES = [
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'data', label: 'Data & storage' },
  { value: 'cloud', label: 'Cloud & DevOps' },
  { value: 'integrations', label: 'Integrations & APIs' },
  { value: 'automation', label: 'Automation' },
  { value: 'security', label: 'Security & compliance' },
];

// ---------------------------------------------------------------------------
// Fixed company profile shown in every case study (TechStalwarts content).
export const BRAND_COLORS = { red: '#C62727', redDark: '#8D1C1C', slate: '#3A424F', ink: '#101828', text: '#3A424F' };
export const BRAND_FILES = {
  logoDark: 'techstalwarts-logo-dark.svg',
  logoFullDark: 'techstalwarts-logo-full-dark.svg',
  logoLight: 'techstalwarts-logo-light.svg',
  logoFullWhite: 'techstalwarts-logo-full-white.svg',
  marker: 'marker.svg',
  heroBackground: 'photos/hero-bg.jpg',
};
export const COMPANY = {
  name: 'TechStalwarts',
  tagline: 'We Transform Ideas into Powerful Digital Experiences.',
  about: {
    heading: 'About Us',
    pillars: [
      { accent: 'Innovative', rest: ' Solutions Offered' },
      { lead: 'Diverse ', accent: 'Specialist', rest: ' Team' },
      { accent: 'Optimal', rest: ' Results Delivered' },
      { accent: 'Forward', rest: '-Thinking Approach' },
    ],
    body: "Techstalwarts is committed to staying at the forefront of technology and delivering innovative solutions to our customers. With generative AI, we're revolutionising the mobile and web app development landscape, unlocking endless possibilities and taking user experiences to new heights.",
    photo: 'photos/team.jpg',
    stats: [
      { value: '$50M+', label: 'Value established with start-ups' },
      { value: '200+', label: 'Clients Served' },
      { value: '150+', label: 'Solutions built' },
      { value: '25+', label: 'Start-ups supported' },
      { value: '150+', label: 'Employees' },
      { value: '03', label: 'Offices' },
    ],
    presence: [{ flag: 'flags/india.png', label: 'Mumbai | Bhopal' }, { flag: 'flags/uae.png', label: 'Dubai' }],
  },
  workWith: {
    heading: 'We Work With',
    columns: [
      { card: { tone: 'red', title: 'Government', body: [{ text: 'We deliver secure, compliant digital solutions for ' }, { text: 'Indian', strong: true }, { text: ' and ' }, { text: 'Dubai', strong: true }, { text: ' government bodies, enabling efficient governance, transparency, and scalable public service platforms.' }], note: '' }, photo: 'photos/work-government.jpg', photoFirst: false },
      { card: { tone: 'slate', title: 'Startups', body: [{ text: "We've partnered global tech start-ups to address their web, cloud, mobile, and IoT requirements." }], note: "We provide start-ups with our digital expertise and experience at every stage, whether you're in the seed stage or the expansion stage." }, photo: 'photos/work-startups.jpg', photoFirst: true },
      { card: { tone: 'red', title: 'Sub-Contractors', body: [{ text: 'We provide specialized expertise and augmentation of technical capabilities for the primary contractor.' }], note: 'Effective collaboration with sub-contractors is crucial for delivering high-quality and timely results in the dynamic field of IT.' }, photo: 'photos/work-subcontractors.jpg', photoFirst: false },
      { card: { tone: 'slate', title: 'Enterprises', body: [{ text: 'Engaging with both large enterprises and small to medium-sized enterprises (SMEs).' }], note: 'In the digital age, we revolutionize the way businesses of all sizes engage with their customers, clients, suppliers, partners, and employees.' }, photo: 'photos/work-enterprises.jpg', photoFirst: true },
    ],
  },
  expertise: {
    heading: 'Our Expertise',
    body: 'Our team brings deep expertise in both real estate and technology, allowing us to deliver solutions that address the evolving needs of developers, asset owners and infrastructure teams. With a combination of property domain knowledge, technical proficiency, and an investor-first approach.',
    items: [
      { icon: 'icon-property-listing', label: 'Property Listing and Discovery' },
      { icon: 'icon-construction', label: 'Project and Construction Management' },
      { icon: 'icon-fractional', label: 'Fractional and REIT Investments' },
      { icon: 'icon-facility', label: 'Facility and Asset Management' },
      { icon: 'icon-lease', label: 'Lease and Tenant Management' },
      { icon: 'icon-site-planning', label: 'Site Planning and BIM Integration' },
      { icon: 'icon-smart-building', label: 'Smart Building and IoT Monitoring' },
      { icon: 'icon-portfolio-analytics', label: 'Portfolio Analytics and Valuation' },
    ],
  },
  clients: {
    heading: '200+ Happy Clients',
    basedIn: [{ flag: 'flags/usa.png', label: 'USA' }, { flag: 'flags/australia.png', label: 'Australia' }, { flag: 'flags/uae.png', label: 'UAE' }, { flag: 'flags/india.png', label: 'India' }],
    government: [
      { logo: 'pune-municipal-corporation', name: 'Pune Municipal Corporation' },
      { logo: 'maharashtra-police', name: 'Maharashtra Police' },
      { logo: 'madhya-pradesh-police', name: 'Madhya Pradesh Police' },
      { logo: 'services-export-promotion-council', name: 'Services Export Promotion Council' },
      { logo: 'ministry-of-agriculture', name: 'Ministry of Agriculture and Farmers Welfare' },
      { logo: 'madhya-pradesh-board', name: 'Madhya Pradesh Board' },
      { logo: 'madhya-pradesh-transport', name: 'Madhya Pradesh Transport Department' },
      { logo: 'pimpri-chinchwad-municipal-corporation', name: 'Pimpri-Chinchwad Municipal Corporation' },
    ],
    private: [
      { logo: 'icici-prudential', name: 'ICICI Prudential Mutual Fund' },
      { logo: 'future-generali', name: 'Future Generali' },
      { logo: 'birla-estates', name: 'Birla Estates' },
      { logo: 'shipcom', name: 'Shipcom' },
      { logo: 'lenden-club', name: 'LenDenClub' },
      { logo: 'centrum-galaxc', name: 'Centrum Galaxc' },
      { logo: 'tickets-to-do', name: 'Tickets To Do' },
      { logo: 'bajaj-electricals', name: 'Bajaj Electricals' },
      { logo: 'aditya-birla-capital', name: 'Aditya Birla Capital' },
      { logo: 'storemaster', name: 'StoreMaster' },
    ],
  },
  footer: {
    heading: 'Thank You',
    internationalOffices: { label: 'International Product Offices', items: [{ flag: 'flags/uae.png', label: 'Dubai' }, { flag: 'flags/saudi-arabia.png', label: 'Saudi Arabia' }, { flag: 'flags/australia.png', label: 'Australia' }] },
    offices: [
      { icon: 'icon-office', label: 'Headquarter', address: 'TechStalwarts, 7th floor, Dheeraj Kawal, LBS Road, Vikhroli, Mumbai, Maharashtra 400070' },
      { icon: 'icon-office-building', label: 'Regional Office', address: 'TechStalwarts, 1st Floor, 96 Gargi Rani Complex, Zone II, MP Nagar Bhopal - 462011, Bhopal,Madhya Pradesh 462011' },
      { icon: 'icon-international', label: 'International Office', address: 'Unit GA-00-SZ-L1-RT-208, Level 1, Gate Avenue - South Zone, Dubai International Financial Centre, Dubai, UAE, 462045' },
    ],
    contacts: [
      { icon: 'icon-call', lines: ['+91 9930602530', '+91 7304146199'] },
      { icon: 'icon-mail', lines: ['business@techstalwarts.com', 'gauri.borkar@techstalwarts.com'] },
      { icon: 'icon-web', lines: ['techstalwarts.com'] },
    ],
    map: 'world-map.png',
  },
};
