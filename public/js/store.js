// Client-side store backed by the server API.
export const store = { projects: [], caseStudies: [], brandBase: '', loaded: false };

async function api(method, url, body) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  if (!res.ok) { const e = new Error((data && data.error) || `Request failed (${res.status})`); e.data = data; throw e; }
  return data;
}

export async function load() {
  const [state, config] = await Promise.all([api('GET', '/api/state'), api('GET', '/api/config')]);
  store.projects = state.projects;
  store.caseStudies = state.caseStudies;
  store.brandBase = config.brandBase;
  store.maxUploadBytes = config.maxUploadBytes || 8 * 1024 * 1024;
  store.loaded = true;
}
export const brand = (file) => `${store.brandBase}/${file}`;

export const getProject = (id) => store.projects.find((p) => p.id === id);
export const getCaseStudy = (id) => store.caseStudies.find((c) => c.id === id);
export const caseStudiesUsingProject = (id) => store.caseStudies.filter((c) => c.sourceProjectIds.includes(id));

const upsert = (list, item) => { const i = list.findIndex((x) => x.id === item.id); if (i >= 0) list[i] = item; else list.unshift(item); return item; };

export const createProject = async (project) => upsert(store.projects, await api('POST', '/api/projects', { project }));
export const updateProject = async (id, project) => upsert(store.projects, await api('PUT', `/api/projects/${id}`, { project }));
export const duplicateProject = async (id) => upsert(store.projects, await api('POST', `/api/projects/${id}/duplicate`));
export async function deleteProject(id) { await api('DELETE', `/api/projects/${id}`); store.projects = store.projects.filter((p) => p.id !== id); }

export const generateCaseStudy = async (type, projectIds, focus) => upsert(store.caseStudies, await api('POST', '/api/case-studies/generate', { type, projectIds, focus }));
export const saveCaseStudy = async (cs) => upsert(store.caseStudies, await api('PUT', `/api/case-studies/${cs.id}`, { caseStudy: cs }));
export const duplicateCaseStudy = async (id) => upsert(store.caseStudies, await api('POST', `/api/case-studies/${id}/duplicate`));
export async function deleteCaseStudy(id) { await api('DELETE', `/api/case-studies/${id}`); store.caseStudies = store.caseStudies.filter((c) => c.id !== id); }

export async function uploadImage(filename, dataUrl) {
  const bytes = Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
  if (bytes > store.maxUploadBytes) throw new Error(`Images must be ${Math.round(store.maxUploadBytes / 1024 / 1024)} MB or smaller`);
  return api('POST', '/api/uploads', { filename, data: dataUrl });
}
