"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

import { useAuth } from "@/components/app-providers";
import { getStoreTypeLabel } from "@/lib/store-config";
import { loadProjects } from "@/lib/storage";
import { AnalysisStatus, ProjectRecord } from "@/lib/types";
import {
  cn,
  formatAnalysisStatus,
  formatDateTime,
  formatPreferredAreaType,
  formatProviderName
} from "@/lib/utils";

const statusFilters: Array<{ value: "all" | AnalysisStatus; label: string }> = [
  { value: "all", label: "全部" },
  { value: "complete", label: "已完成" },
  { value: "running", label: "分析中" },
  { value: "failed", label: "失败" },
  { value: "draft", label: "待分析" }
];

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AnalysisStatus>("all");
  const { session, hydrated } = useAuth();
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!session?.id) {
      setProjects(loadProjects());
      setLoading(false);
      return;
    }

    fetch("/api/projects")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("项目拉取失败");
        }

        const payload = (await response.json()) as { projects: ProjectRecord[] };
        setProjects(payload.projects);
      })
      .catch(() => {
        setProjects(loadProjects());
      })
      .finally(() => {
        setLoading(false);
      });
  }, [hydrated, session?.id]);

  if (loading) {
    return <div className="empty-state">正在加载项目数据...</div>;
  }

  if (projects.length === 0) {
    return (
      <div className="empty-state">
        还没有保存的分析项目。创建第一个项目后，这里会显示历史分析、推荐结果和更新时间。
      </div>
    );
  }

  const normalizedKeyword = deferredSearchTerm.trim().toLowerCase();
  const sortedProjects = [...projects].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
  const visibleProjects = sortedProjects.filter((project) => {
    const status = project.currentAnalysis?.status ?? "draft";
    if (statusFilter !== "all" && status !== statusFilter) {
      return false;
    }

    if (!normalizedKeyword) {
      return true;
    }

    const searchable = [
      project.input.projectName,
      project.input.targetAddress,
      project.input.cuisineFocus,
      getStoreTypeLabel(project.input.businessType),
      project.input.targetAudience
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(normalizedKeyword);
  });

  const completeCount = projects.filter((project) => project.currentAnalysis?.status === "complete").length;
  const runningCount = projects.filter((project) => project.currentAnalysis?.status === "running").length;
  const failedCount = projects.filter((project) => project.currentAnalysis?.status === "failed").length;

  return (
    <div className="stack">
      <div className="dashboard-tools">
        <div className="search-field">
          <label htmlFor="project-search">搜索项目</label>
          <input
            id="project-search"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="按项目名、地址、店型或客群搜索"
            value={searchTerm}
          />
        </div>
        <div className="toolbar-block">
          <span className="toolbar-label">状态筛选</span>
          <div className="segmented">
            {statusFilters.map((filter) => (
              <button
                className={statusFilter === filter.value ? "active" : ""}
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mini-stat-grid">
        <article className="soft-panel mini-stat">
          <span className="eyebrow">Projects</span>
          <strong>{projects.length}</strong>
          <span>当前已保存项目</span>
        </article>
        <article className="soft-panel mini-stat">
          <span className="eyebrow">Completed</span>
          <strong>{completeCount}</strong>
          <span>已拿到结果</span>
        </article>
        <article className="soft-panel mini-stat">
          <span className="eyebrow">Running</span>
          <strong>{runningCount}</strong>
          <span>仍在计算中</span>
        </article>
        <article className="soft-panel mini-stat">
          <span className="eyebrow">Needs Review</span>
          <strong>{failedCount}</strong>
          <span>需要重跑或调整输入</span>
        </article>
      </div>

      <div className="toolbar-meta">
        <span>共 {visibleProjects.length} 个符合当前筛选条件的项目</span>
        {normalizedKeyword ? <span>关键词: {deferredSearchTerm}</span> : null}
      </div>

      {visibleProjects.length === 0 ? (
        <div className="empty-state">
          当前筛选条件下没有找到项目。可以换个关键词，或者直接新建一轮分析。
        </div>
      ) : null}

      <div className="project-list">
      {visibleProjects.map((project) => {
        const status = project.currentAnalysis?.status ?? "draft";

        return (
          <article className="project-row" key={project.id}>
            <div>
              <h3>{project.input.projectName}</h3>
              <p>
                {getStoreTypeLabel(project.input.businessType)} / {project.input.cuisineFocus} /{" "}
                {project.input.targetAddress}
              </p>
              <div className="meta-line">
                <span>最近更新 {formatDateTime(project.updatedAt)}</span>
                <span>覆盖半径 {project.input.coverageRadiusMeters}m</span>
                <span>预算 {project.input.budgetRange}</span>
                <span>偏好 {formatPreferredAreaType(project.input.preferredAreaType)}</span>
                {project.currentAnalysis?.costEstimate ? (
                  <span>
                    预估成本 ${project.currentAnalysis.costEstimate.estimatedUsd.toFixed(4)}
                  </span>
                ) : null}
              </div>
              {project.currentAnalysis?.summary ? (
                <p className="helper-text" style={{ marginTop: 12 }}>
                  {project.currentAnalysis.summary}
                </p>
              ) : null}
            </div>

            <div className="stack" style={{ justifyItems: "end" }}>
              <span
                className={cn(
                  "status-badge",
                  status === "complete" && "status-complete",
                  status === "running" && "status-running",
                  status === "failed" && "status-failed"
                )}
              >
                {formatAnalysisStatus(status)}
              </span>
              {project.currentAnalysis?.costEstimate ? (
                <span className="helper-text">
                  数据源 {formatProviderName(project.currentAnalysis.costEstimate.provider)}
                </span>
              ) : null}
              <Link className="ghost-button" href={`/projects/${project.id}`}>
                打开详情
              </Link>
            </div>
          </article>
        );
      })}
      </div>
    </div>
  );
}
