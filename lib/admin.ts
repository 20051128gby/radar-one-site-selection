import { ProjectRecord } from "@/lib/types";

export type AdminUserRow = {
  email: string;
  role: "admin" | "operator" | "viewer";
  projectCount: number;
  analysisCount: number;
  successfulAnalyses: number;
  totalSpendUsd: number;
  lastActiveAt: string;
};

export type AdminSummary = {
  totalProjects: number;
  totalAnalyses: number;
  successfulAnalyses: number;
  totalSpendUsd: number;
  totalSpendCny: number;
  monthlyBudgetUsd: number;
  remainingBudgetUsd: number;
  averageCostUsd: number;
  activeUsers: number;
};

export type AdminFeedItem = {
  projectId: string;
  projectName: string;
  ownerEmail: string;
  status: string;
  provider: string;
  estimatedUsd: number;
  createdAt: string;
  summary: string;
};

export function buildAdminSummary(projects: ProjectRecord[]) {
  const analyses = projects
    .map((project) => project.currentAnalysis)
    .filter(Boolean);
  const totalSpendUsd = analyses.reduce(
    (sum, analysis) => sum + (analysis?.costEstimate?.estimatedUsd ?? 0),
    0
  );
  const monthlyBudgetUsd = Number(process.env.MONTHLY_BUDGET_USD ?? 500);
  const successfulAnalyses = analyses.filter(
    (analysis) => analysis?.status === "complete"
  ).length;

  const summary: AdminSummary = {
    totalProjects: projects.length,
    totalAnalyses: analyses.length,
    successfulAnalyses,
    totalSpendUsd: Number(totalSpendUsd.toFixed(4)),
    totalSpendCny: Number((totalSpendUsd * 7.24).toFixed(2)),
    monthlyBudgetUsd,
    remainingBudgetUsd: Number(Math.max(monthlyBudgetUsd - totalSpendUsd, 0).toFixed(4)),
    averageCostUsd:
      analyses.length > 0 ? Number((totalSpendUsd / analyses.length).toFixed(4)) : 0,
    activeUsers: new Set(projects.map((project) => project.ownerEmail)).size
  };

  return summary;
}

export function buildAdminUsers(projects: ProjectRecord[]) {
  const map = new Map<string, AdminUserRow>();

  for (const project of projects) {
    const existing = map.get(project.ownerEmail);
    const analysis = project.currentAnalysis;
    const lastActiveAt = analysis?.createdAt ?? project.updatedAt;

    if (!existing) {
      map.set(project.ownerEmail, {
        email: project.ownerEmail,
        role: project.ownerEmail.includes("admin") ? "admin" : "operator",
        projectCount: 1,
        analysisCount: analysis ? 1 : 0,
        successfulAnalyses: analysis?.status === "complete" ? 1 : 0,
        totalSpendUsd: analysis?.costEstimate?.estimatedUsd ?? 0,
        lastActiveAt
      });
      continue;
    }

    existing.projectCount += 1;
    existing.analysisCount += analysis ? 1 : 0;
    existing.successfulAnalyses += analysis?.status === "complete" ? 1 : 0;
    existing.totalSpendUsd += analysis?.costEstimate?.estimatedUsd ?? 0;
    existing.lastActiveAt =
      new Date(lastActiveAt).getTime() > new Date(existing.lastActiveAt).getTime()
        ? lastActiveAt
        : existing.lastActiveAt;
  }

  return Array.from(map.values())
    .map((user) => ({
      ...user,
      totalSpendUsd: Number(user.totalSpendUsd.toFixed(4))
    }))
    .sort((left, right) => right.totalSpendUsd - left.totalSpendUsd);
}

export function buildAdminFeed(projects: ProjectRecord[]) {
  const items: AdminFeedItem[] = projects
    .filter((project) => project.currentAnalysis)
    .map((project) => ({
      projectId: project.id,
      projectName: project.input.projectName,
      ownerEmail: project.ownerEmail,
      status: project.currentAnalysis?.status ?? "draft",
      provider: project.currentAnalysis?.costEstimate?.provider ?? "mock",
      estimatedUsd: project.currentAnalysis?.costEstimate?.estimatedUsd ?? 0,
      createdAt: project.currentAnalysis?.createdAt ?? project.createdAt,
      summary: project.currentAnalysis?.summary ?? "暂无分析摘要"
    }))
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );

  return items;
}
