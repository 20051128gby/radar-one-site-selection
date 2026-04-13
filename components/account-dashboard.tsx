"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/app-providers";
import { ProjectRecord } from "@/lib/types";
import { formatDateTime, formatProviderName, getErrorMessage } from "@/lib/utils";

type AccountOverviewPayload = {
  overview: {
    profile: {
      id: string;
      email: string;
      displayName: string;
      role: "admin" | "operator" | "viewer";
      planId: string;
      isDisabled: boolean;
    };
    usageBalance: {
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
    } | null;
    shareRewards: Array<{
      id: string;
      shareReference: string | null;
      shareChannel: string | null;
      status: "pending" | "awarded" | "reversed";
      premiumCreditsAwarded: number;
      awardedAt: string | null;
      createdAt: string;
    }>;
    stats: {
      projectCount: number;
      completedAnalyses: number;
      failedAnalyses: number;
      totalSpendUsd: number;
    };
    recentProjects: ProjectRecord[];
  } | null;
};

function formatPlan(planId: string) {
  const mapping: Record<string, string> = {
    free: "免费版",
    starter: "Starter",
    growth: "Growth",
    scale: "Scale"
  };

  return mapping[planId] ?? planId;
}

export function AccountDashboard() {
  const { session, hydrated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AccountOverviewPayload["overview"] | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!session?.id) {
      setLoading(false);
      return;
    }

    fetch("/api/account")
      .then(async (response) => {
        const payload = (await response.json()) as AccountOverviewPayload & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "账户信息拉取失败");
        }

        setOverview(payload.overview);
      })
      .catch((requestError) => {
        setError(getErrorMessage(requestError));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [hydrated, session?.id]);

  if (!hydrated || loading) {
    return <div className="empty-state">正在加载账户信息...</div>;
  }

  if (!session?.id) {
    return (
      <div className="soft-panel stack">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="section-title">登录后查看账户额度。</h1>
          <p className="section-copy">
            这里会展示你还剩多少基础分析、高级分析奖励、最近项目和账户状态。
          </p>
        </div>
        <Link className="primary-button" href="/login">
          去登录
        </Link>
      </div>
    );
  }

  if (error) {
    return <div className="empty-state">{error}</div>;
  }

  if (!overview) {
    return <div className="empty-state">暂时没有拿到账户数据。</div>;
  }

  const usageBalance = overview.usageBalance;
  const awardedRewards = overview.shareRewards.filter((reward) => reward.status === "awarded");

  return (
    <div className="stack">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h1>{overview.profile.displayName} 的账户主页</h1>
          <p>
            这里集中展示当前套餐、剩余额度、分享奖励和最近项目，方便用户自己判断还剩多少可用分析次数。
          </p>
        </div>
        <div className="hero-actions">
          <Link className="primary-button" href="/projects/new">
            新建分析
          </Link>
          <Link className="ghost-button" href="/billing">
            查看套餐
          </Link>
        </div>
      </div>

      <div className="callout">
        <strong>账户状态</strong>
        <span>
          当前方案 {formatPlan(overview.profile.planId)}，角色 {overview.profile.role}。
          {overview.profile.planId === "free"
            ? " 免费账号默认可使用 5 次基础分析。"
            : " 当前已进入付费方案额度模型。"}
        </span>
      </div>

      <div className="admin-metric-grid">
        <article className="soft-panel">
          <p className="eyebrow">Basic Left</p>
          <h2 className="admin-metric-value">{usageBalance?.basicRemaining ?? 0}</h2>
          <p className="helper-text">
            已用 {usageBalance?.basicUsed ?? 0} / {(usageBalance?.basicIncluded ?? 0) + (usageBalance?.basicBonus ?? 0)}
          </p>
        </article>
        <article className="soft-panel">
          <p className="eyebrow">Premium Left</p>
          <h2 className="admin-metric-value">{usageBalance?.premiumRemaining ?? 0}</h2>
          <p className="helper-text">
            分享或后续活动奖励都会累计到这里
          </p>
        </article>
        <article className="soft-panel">
          <p className="eyebrow">Projects</p>
          <h2 className="admin-metric-value">{overview.stats.projectCount}</h2>
          <p className="helper-text">已完成 {overview.stats.completedAnalyses} 次分析</p>
        </article>
        <article className="soft-panel">
          <p className="eyebrow">Share Rewards</p>
          <h2 className="admin-metric-value">{awardedRewards.length}</h2>
          <p className="helper-text">
            共奖励 {awardedRewards.reduce((sum, reward) => sum + reward.premiumCreditsAwarded, 0)} 次高级分析
          </p>
        </article>
      </div>

      <div className="two-col">
        <section className="soft-panel">
          <p className="eyebrow">Usage Detail</p>
          <h2 style={{ marginTop: 14 }}>额度明细</h2>
          {usageBalance ? (
            <div className="project-list" style={{ marginTop: 18 }}>
              <div className="project-row">
                <div>
                  <h3>基础分析额度</h3>
                  <p>包含套餐基础额度和额外奖励额度。</p>
                </div>
                <div className="stack" style={{ justifyItems: "end" }}>
                  <strong>{usageBalance.basicRemaining}</strong>
                  <span className="helper-text">剩余</span>
                </div>
              </div>
              <div className="meta-line">
                <span>套餐内 {usageBalance.basicIncluded}</span>
                <span>奖励 {usageBalance.basicBonus}</span>
                <span>已使用 {usageBalance.basicUsed}</span>
              </div>
              <div className="project-row">
                <div>
                  <h3>高级分析额度</h3>
                  <p>当前先用于分享奖励预留，未来接入大模型分析。</p>
                </div>
                <div className="stack" style={{ justifyItems: "end" }}>
                  <strong>{usageBalance.premiumRemaining}</strong>
                  <span className="helper-text">剩余</span>
                </div>
              </div>
              <div className="meta-line">
                <span>套餐内 {usageBalance.premiumIncluded}</span>
                <span>奖励 {usageBalance.premiumBonus}</span>
                <span>已使用 {usageBalance.premiumUsed}</span>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              额度表还没有初始化。如果你刚跑完数据库迁移，重新登录后这里会正常显示。
            </div>
          )}
        </section>

        <section className="soft-panel">
          <p className="eyebrow">Reward History</p>
          <h2 style={{ marginTop: 14 }}>分享奖励记录</h2>
          {overview.shareRewards.length > 0 ? (
            <div className="project-list" style={{ marginTop: 18 }}>
              {overview.shareRewards.map((reward) => (
                <div className="project-row" key={reward.id}>
                  <div>
                    <h3>{reward.shareChannel || "未标记渠道"}</h3>
                    <p>奖励 {reward.premiumCreditsAwarded} 次高级分析</p>
                    <div className="meta-line">
                      <span>{reward.status}</span>
                      <span>{formatDateTime(reward.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              还没有分享奖励记录。后续你接入分享成功回调后，这里会展示奖励历史。
            </div>
          )}
        </section>
      </div>

      <section className="soft-panel">
        <p className="eyebrow">Recent Projects</p>
        <h2 style={{ marginTop: 14 }}>最近项目</h2>
        {overview.recentProjects.length > 0 ? (
          <div className="project-list" style={{ marginTop: 18 }}>
            {overview.recentProjects.map((project) => (
              <div className="project-row" key={project.id}>
                <div>
                  <h3>{project.input.projectName}</h3>
                  <p>{project.input.targetAddress}</p>
                  <div className="meta-line">
                    <span>{project.currentAnalysis?.summary ?? "还没有分析摘要"}</span>
                    {project.currentAnalysis?.costEstimate ? (
                      <span>
                        {formatProviderName(project.currentAnalysis.costEstimate.provider)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <Link className="ghost-button" href={`/projects/${project.id}`}>
                  打开项目
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">还没有项目，先去创建第一轮分析。</div>
        )}
      </section>
    </div>
  );
}
