"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/app-providers";
import { buildAdminFeed, buildAdminSummary, buildAdminUsers } from "@/lib/admin";
import { loadProjects } from "@/lib/storage";
import { ProjectRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type ConfigPayload = {
  config: {
    googleMapsConfigured: boolean;
    geoapifyConfigured: boolean;
    billingAccountConfigured: boolean;
    bigQueryDatasetConfigured: boolean;
    bigQueryApiKeyConfigured: boolean;
    supabaseSecretConfigured: boolean;
    supabaseUrlConfigured: boolean;
    supabaseAnonConfigured: boolean;
    stripeConfigured: boolean;
    liveBillingEnabled: boolean;
    guestMonthlyLimit: number;
    freeBasicLimit: number;
    sharePremiumRewardCredits: number;
  };
  notes: string[];
};

type OverviewProfile = {
  id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "operator" | "viewer";
  plan_id: string;
  is_disabled: boolean;
  disabled_at: string | null;
  updated_at: string;
};

type AdminOverviewPayload = {
  overview: {
    profiles: OverviewProfile[];
    projects: Array<{
      id: string;
      owner_id: string | null;
      name: string;
      updated_at: string;
      created_at: string;
    }>;
    analyses: Array<{
      id: string;
      project_id: string;
      status: string;
      summary: string;
      provider: string | null;
      cost_estimate_json: { estimatedUsd?: number; provider?: string } | null;
      created_at: string;
      updated_at: string;
    }>;
    events: Array<{
      id: string;
      project_id: string | null;
      actor_key: string;
      provider: string;
      status: string;
      estimated_usd: number;
      created_at: string;
    }>;
    usageBalances: Array<{
      userId: string;
      planId: string;
      basicIncluded: number;
      basicBonus: number;
      basicUsed: number;
      basicRemaining: number;
      premiumIncluded: number;
      premiumBonus: number;
      premiumUsed: number;
      premiumRemaining: number;
      createdAt: string;
      updatedAt: string;
    }>;
    shareRewards: Array<{
      id: string;
      userId: string;
      premiumCreditsAwarded: number;
      status: string;
      createdAt: string;
    }>;
  } | null;
};

export function AdminDashboard() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [config, setConfig] = useState<ConfigPayload | null>(null);
  const [overview, setOverview] = useState<AdminOverviewPayload["overview"] | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const { session } = useAuth();

  async function loadOverview() {
    if (session?.role !== "admin") {
      return;
    }

    try {
      const response = await fetch("/api/admin/overview");
      if (!response.ok) {
        throw new Error("overview load failed");
      }

      const payload = (await response.json()) as AdminOverviewPayload;
      setOverview(payload.overview);
    } catch {
      setOverview(null);
    }
  }

  useEffect(() => {
    setProjects(loadProjects());

    fetch("/api/admin/config")
      .then((response) => response.json())
      .then((payload: ConfigPayload) => setConfig(payload))
      .catch(() => {
        setConfig(null);
      });

    void loadOverview();
  }, [session?.role]);

  function handleUserAction(userId: string, action: "disable" | "enable" | "delete") {
    setFeedback(null);
    const actionKey = `${action}:${userId}`;
    setPendingActionKey(actionKey);

    void (async () => {
      const previousOverview = overview;
      if (overview) {
        if (action === "delete") {
          setOverview({
            ...overview,
            profiles: overview.profiles.filter((profile) => profile.id !== userId),
            projects: overview.projects.filter((project) => project.owner_id !== userId),
            analyses: overview.analyses.filter((analysis) => {
              const relatedProject = overview.projects.find(
                (project) => project.id === analysis.project_id
              );
              return relatedProject?.owner_id !== userId;
            }),
            events: overview.events.filter((event) => {
              const relatedProject = overview.projects.find(
                (project) => project.id === event.project_id
              );
              return relatedProject?.owner_id !== userId;
            })
          });
        } else {
          setOverview({
            ...overview,
            profiles: overview.profiles.map((profile) =>
              profile.id === userId
                ? {
                    ...profile,
                    is_disabled: action === "disable",
                    disabled_at: action === "disable" ? new Date().toISOString() : null
                  }
                : profile
            )
          });
        }
      }

      try {
        const response =
          action === "delete"
            ? await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
            : await fetch(`/api/admin/users/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ disabled: action === "disable" })
              });

        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          setOverview(previousOverview);
          setFeedback(payload.error ?? "用户操作失败。");
          return;
        }

        setFeedback(
          action === "delete"
            ? "用户已删除。"
            : action === "disable"
              ? "用户已禁用。"
              : "用户已恢复。"
        );
        await loadOverview();
      } finally {
        setPendingActionKey(null);
      }
    })();
  }

  const localSummary = buildAdminSummary(projects);
  const localUsers = buildAdminUsers(projects);
  const localFeed = buildAdminFeed(projects).slice(0, 8);

  const totalSpendUsd =
    overview?.analyses.reduce(
      (sum, analysis) => sum + (analysis.cost_estimate_json?.estimatedUsd ?? 0),
      0
    ) ?? localSummary.totalSpendUsd;
  const totalAnalyses = overview?.analyses.length ?? localSummary.totalAnalyses;
  const successfulAnalyses =
    overview?.analyses.filter((analysis) => analysis.status === "complete").length ??
    localSummary.successfulAnalyses;
  const activeUsers =
    overview?.profiles.filter((profile) => !profile.is_disabled).length ?? localSummary.activeUsers;
  const averageCostUsd = totalAnalyses > 0 ? totalSpendUsd / totalAnalyses : 0;
  const remainingBudgetUsd = Math.max(localSummary.monthlyBudgetUsd - totalSpendUsd, 0);

  const users =
    overview?.profiles.map((profile) => {
      const ownedProjectIds = new Set(
        overview.projects
          .filter((project) => project.owner_id === profile.id)
          .map((project) => project.id)
      );
      const analyses = overview.analyses.filter((analysis) =>
        ownedProjectIds.has(analysis.project_id)
      );
      const usageBalance = overview.usageBalances.find((balance) => balance.userId === profile.id);
      const shareRewardCount = overview.shareRewards.filter(
        (reward) => reward.userId === profile.id && reward.status === "awarded"
      ).length;

      return {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        isDisabled: profile.is_disabled,
        planId: profile.plan_id,
        projectCount: ownedProjectIds.size,
        analysisCount: analyses.length,
        successfulAnalyses: analyses.filter((analysis) => analysis.status === "complete").length,
        totalSpendUsd: analyses.reduce(
          (sum, analysis) => sum + (analysis.cost_estimate_json?.estimatedUsd ?? 0),
          0
        ),
        lastActiveAt:
          analyses[0]?.updated_at ?? profile.updated_at ?? new Date().toISOString(),
        basicRemaining: usageBalance?.basicRemaining ?? 0,
        premiumRemaining: usageBalance?.premiumRemaining ?? 0,
        shareRewardCount
      };
    }) ??
    localUsers.map((user) => ({
      id: user.email,
      email: user.email,
      role: user.role,
      isDisabled: false,
      planId: "free",
      projectCount: user.projectCount,
      analysisCount: user.analysisCount,
      successfulAnalyses: user.successfulAnalyses,
      totalSpendUsd: user.totalSpendUsd,
      lastActiveAt: user.lastActiveAt,
      basicRemaining: 0,
      premiumRemaining: 0,
      shareRewardCount: 0
    }));

  const feed =
    overview?.events.slice(0, 8).map((event) => {
      const project = overview.projects.find((item) => item.id === event.project_id);
      const profile = overview.profiles.find(
        (item) => item.id === project?.owner_id || item.email === event.actor_key
      );

      return {
        projectId: event.project_id ?? event.id,
        projectName: project?.name ?? "未命名项目",
        ownerEmail: profile?.email ?? event.actor_key,
        status: event.status,
        provider: event.provider,
        estimatedUsd: event.estimated_usd,
        createdAt: event.created_at,
        summary: `${event.provider} / ${event.status === "success" ? "分析完成" : "分析失败"}`
      };
    }) ?? localFeed;

  return (
    <div className="stack">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Admin Center</p>
          <h1>运营后台</h1>
          <p>
            现在后台会优先显示数据库里的真实用户、项目和分析记录，并支持直接管理账号状态。
          </p>
        </div>
      </div>

      {feedback ? <div className="callout"><span>{feedback}</span></div> : null}

      <div className="admin-metric-grid">
        <article className="soft-panel">
          <p className="eyebrow">Estimated Spend</p>
          <h2 className="admin-metric-value">${totalSpendUsd.toFixed(4)}</h2>
          <p className="helper-text">约 ¥{(totalSpendUsd * 7.24).toFixed(2)}</p>
        </article>
        <article className="soft-panel">
          <p className="eyebrow">Budget Left</p>
          <h2 className="admin-metric-value">${remainingBudgetUsd.toFixed(4)}</h2>
          <p className="helper-text">按月预算 ${localSummary.monthlyBudgetUsd.toFixed(2)} 计算</p>
        </article>
        <article className="soft-panel">
          <p className="eyebrow">Analyses</p>
          <h2 className="admin-metric-value">{totalAnalyses}</h2>
          <p className="helper-text">成功 {successfulAnalyses} 次</p>
        </article>
        <article className="soft-panel">
          <p className="eyebrow">Active Users</p>
          <h2 className="admin-metric-value">{activeUsers}</h2>
          <p className="helper-text">平均每次 ${averageCostUsd.toFixed(4)}</p>
        </article>
        <article className="soft-panel">
          <p className="eyebrow">Guest Quota</p>
          <h2 className="admin-metric-value">{config?.config.guestMonthlyLimit ?? 1}</h2>
          <p className="helper-text">同一 IP 允许试用次数</p>
        </article>
        <article className="soft-panel">
          <p className="eyebrow">Free Basic</p>
          <h2 className="admin-metric-value">{config?.config.freeBasicLimit ?? 5}</h2>
          <p className="helper-text">注册用户默认基础分析免费额度</p>
        </article>
        <article className="soft-panel">
          <p className="eyebrow">Share Reward</p>
          <h2 className="admin-metric-value">{config?.config.sharePremiumRewardCredits ?? 1}</h2>
          <p className="helper-text">每次分享奖励的高级分析额度</p>
        </article>
      </div>

      <div className="two-col">
        <section className="soft-panel">
          <p className="eyebrow">Integration Status</p>
          <h2 style={{ marginTop: 14 }}>数据源与后台接入状态</h2>
          <div className="project-list" style={{ marginTop: 18 }}>
            {config ? (
              <>
                <div className="project-row">
                  <div>
                    <h3>Google Maps API</h3>
                    <p>{config.config.googleMapsConfigured ? "已配置" : "未配置"}</p>
                  </div>
                </div>
                <div className="project-row">
                  <div>
                    <h3>Billing / BigQuery</h3>
                    <p>
                      {config.config.billingAccountConfigured &&
                      config.config.bigQueryDatasetConfigured &&
                      config.config.bigQueryApiKeyConfigured
                        ? "已填写基础信息，但读取官方账单还需要账单导出表所在项目与凭证"
                        : "还未完整配置"}
                    </p>
                  </div>
                </div>
                <div className="project-row">
                  <div>
                    <h3>Supabase</h3>
                    <p>
                      {config.config.supabaseSecretConfigured &&
                      config.config.supabaseUrlConfigured &&
                      config.config.supabaseAnonConfigured
                        ? "Supabase 登录和数据库主配置已接通"
                        : "还缺项目 URL、anon key 或 service key"}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">后台配置状态读取失败。</div>
            )}
          </div>
          {overview ? (
            <div className="bullet-box" style={{ marginTop: 16 }}>
              <h4>数据库概览</h4>
              <ul>
                <li>已同步用户 {overview.profiles.length} 个</li>
                <li>已禁用用户 {overview.profiles.filter((profile) => profile.is_disabled).length} 个</li>
                <li>已入库项目 {overview.projects.length} 个</li>
                <li>已入库分析 {overview.analyses.length} 条</li>
              </ul>
            </div>
          ) : null}
        </section>

        <section className="soft-panel">
          <p className="eyebrow">Recent Analyses</p>
          <h2 style={{ marginTop: 14 }}>最近分析记录</h2>
          <div className="project-list" style={{ marginTop: 18 }}>
            {feed.length > 0 ? (
              feed.map((item) => (
                <article className="project-row" key={`${item.projectId}-${item.createdAt}`}>
                  <div>
                    <h3>{item.projectName}</h3>
                    <p>{item.summary}</p>
                    <div className="meta-line">
                      <span>{item.ownerEmail}</span>
                      <span>{item.provider}</span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>
                  </div>
                  <div className="stack" style={{ justifyItems: "end" }}>
                    <span className="status-badge status-running">{item.status}</span>
                    <strong>${item.estimatedUsd.toFixed(4)}</strong>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">还没有可展示的分析记录。</div>
            )}
          </div>
        </section>
      </div>

      <section className="soft-panel">
        <p className="eyebrow">User Management</p>
        <h2 style={{ marginTop: 14 }}>用户管理</h2>
        {users.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>状态</th>
                  <th>角色</th>
                  <th>套餐</th>
                  <th>基础剩余</th>
                  <th>高级剩余</th>
                  <th>分享奖励</th>
                  <th>项目数</th>
                  <th>分析数</th>
                  <th>累计成本</th>
                  <th>最近活跃</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const disableActionKey = `${user.isDisabled ? "enable" : "disable"}:${user.id}`;
                  const deleteActionKey = `delete:${user.id}`;

                  return (
                    <tr key={user.id}>
                      <td>
                        <div>
                          <strong>{user.email}</strong>
                          <div className="helper-text">{user.id}</div>
                        </div>
                      </td>
                      <td>{user.isDisabled ? "已禁用" : "正常"}</td>
                      <td>{user.role}</td>
                      <td>{user.planId}</td>
                      <td>{user.basicRemaining}</td>
                      <td>{user.premiumRemaining}</td>
                      <td>{user.shareRewardCount}</td>
                      <td>{user.projectCount}</td>
                      <td>{user.analysisCount}</td>
                      <td>${user.totalSpendUsd.toFixed(4)}</td>
                      <td>{formatDateTime(user.lastActiveAt)}</td>
                      <td>
                        <div className="segmented">
                          <button
                            aria-busy={pendingActionKey === disableActionKey}
                            disabled={Boolean(pendingActionKey) || user.id === session?.id}
                            onClick={() =>
                              handleUserAction(
                                user.id,
                                user.isDisabled ? "enable" : "disable"
                              )
                            }
                            type="button"
                          >
                            {pendingActionKey === disableActionKey
                              ? "处理中..."
                              : user.isDisabled
                                ? "恢复"
                                : "禁用"}
                          </button>
                          <button
                            aria-busy={pendingActionKey === deleteActionKey}
                            disabled={Boolean(pendingActionKey) || user.id === session?.id}
                            onClick={() => handleUserAction(user.id, "delete")}
                            type="button"
                          >
                            {pendingActionKey === deleteActionKey ? "删除中..." : "删除"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">等用户开始使用后，这里会出现用户管理列表。</div>
        )}
      </section>
    </div>
  );
}
