import { ProjectRecord, SiteAnalysis, UserSession } from "@/lib/types";

const SESSION_KEY = "radar-one-session";
const PROJECTS_KEY = "radar-one-projects";

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadSession(): UserSession | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export function saveSession(session: UserSession) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
}

export function loadProjects() {
  if (!isBrowser()) {
    return [] as ProjectRecord[];
  }

  const raw = window.localStorage.getItem(PROJECTS_KEY);
  if (!raw) {
    return [] as ProjectRecord[];
  }

  try {
    return JSON.parse(raw) as ProjectRecord[];
  } catch {
    return [] as ProjectRecord[];
  }
}

export function saveProjects(projects: ProjectRecord[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function upsertProject(project: ProjectRecord) {
  const projects = loadProjects();
  const next = [project, ...projects.filter((item) => item.id !== project.id)];
  saveProjects(next);
}

export function updateProjectAnalysis(projectId: string, analysis: SiteAnalysis) {
  const projects = loadProjects();
  const next = projects.map((project) =>
    project.id === projectId
      ? {
          ...project,
          updatedAt: new Date().toISOString(),
          currentAnalysis: analysis
        }
      : project
  );

  saveProjects(next);
}

export function getProjectById(projectId: string) {
  return loadProjects().find((project) => project.id === projectId) ?? null;
}
