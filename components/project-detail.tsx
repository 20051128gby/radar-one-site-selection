"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/app-providers";
import { scoringDimensions } from "@/lib/constants";
import { getStoreTypeLabel } from "@/lib/store-config";
import { getProjectById, updateProjectAnalysis } from "@/lib/storage";
import { CandidateAreaScore, ProjectRecord, SiteAnalysis } from "@/lib/types";
import {
  cn,
  formatAnalysisStatus,
  formatDateTime,
  formatPreferredAreaType,
  formatProviderName,
  getErrorMessage,
  scoreTone
} from "@/lib/utils";

function dimensionLabel(key: keyof CandidateAreaScore["dimensionScores"]) {
  const mapping = {
    footTraffic: "人流代理",
    competition: "竞品可控度",
    complementary: "互补业态",
    accessibility: "到达便利",
    maturity: "商圈成熟度",
    rentPressure: "租金匹配"
  } satisfies Record<keyof CandidateAreaScore["dimensionScores"], string>;

  return mapping[key] ?? key;
}

function topDimension(area: CandidateAreaScore) {
  return Object.entries(area.dimensionScores).sort((left, right) => right[1] - left[1])[0] as [
    keyof CandidateAreaScore["dimensionScores"],
    number
  ];
}

function confidenceMeta(area?: CandidateAreaScore, runnerUp?: CandidateAreaScore) {
  if (!area) {
    return {
      label: "待判断",
      detail: "还没有足够数据生成信心等级。"
    };
  }

  const gap = area.overallScore - (runnerUp?.overallScore ?? area.overallScore - 4);
  const warningCount = area.evidence.warnings.length;

  if (area.overallScore >= 84 && gap >= 5 && warningCount <= 1) {
    return {
      label: "高",
      detail: "首选区域和第二名拉开了明显差距，且关键风险较少。"
    };
  }

  if (area.overallScore >= 74 && gap >= 2) {
    return {
      label: "中",
      detail: "推荐方向清晰，但仍需要用实勘和租金谈判来确认。"
    };
  }

  return {
    label: "低",
    detail: "候选区域差距不大，建议先补更多线下样本再做决定。"
  };
}

function decisionMeta(area?: CandidateAreaScore) {
  if (!area) {
    return {
      label: "暂未形成结论",
      detail: "请先完成分析。"
    };
  }

  if (area.overallScore >= 84) {
    return {
      label: "优先推进",
      detail: "可以先约实地考察与租金谈判，把资源集中到前两名区域。"
    };
  }

  if (area.overallScore >= 72) {
    return {
      label: "继续比价",
      detail: "区域基本成立，但还需要对比租售比、客流峰值和竞品强度。"
    };
  }

  return {
    label: "谨慎推进",
    detail: "当前输入下没有形成明显优势区域，建议先调项目假设再试一次。"
  };
}

function buildFieldChecklist(project: ProjectRecord, area?: CandidateAreaScore) {
  if (!area) {
    return [];
  }

  return [
    `围绕 ${project.input.targetAudience || "目标客群"} 做午高峰、晚高峰与周末样本观察，各至少 2 轮。`,
    `核验 ${area.name} 周边铺位是否真的落在 ${area.evidence.estimatedRentBand} 区间内，并补充转让费与装修条件。`,
    `实地比对 ${area.evidence.nearbyLandmarks.slice(0, 2).join("、") || "周边锚点"} 的进店动线与停车/步行可达性。`,
    area.evidence.warnings[0] ?? "记录同类竞品在晚高峰的翻台、排队和外卖占比。"
  ];
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRerunning, setIsRerunning] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const { session, hydrated } = useAuth();

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!session?.id) {
      setProject(getProjectById(projectId));
      setLoading(false);
      return;
    }

    fetch(`/api/projects/${projectId}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("项目详情拉取失败");
        }

        const payload = (await response.json()) as { project: ProjectRecord };
        setProject(payload.project);
      })
      .catch(() => {
        setProject(getProjectById(projectId));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [hydrated, projectId, session?.id]);

  if (loading) {
    return <div className="empty-state">正在加载项目详情...</div>;
  }

  if (!project) {
    return (
      <div className="empty-state">
        没有找到这个项目。可能它还没保存在当前浏览器，或者已被清理。
      </div>
    );
  }

  const analysis = project.currentAnalysis;
  const result = analysis?.result;
  const leadArea = result?.recommendedAreas[0];
  const runnerUp = result?.recommendedAreas[1];
  const leadDimension = leadArea ? topDimension(leadArea) : null;
  const confidence = confidenceMeta(leadArea, runnerUp);
  const decision = decisionMeta(leadArea);
  const fieldChecklist = buildFieldChecklist(project, leadArea);

  async function rerunAnalysis() {
    if (!project || isRerunning) {
      return;
    }

    setActionFeedback(null);
    setIsRerunning(true);
    const now = new Date().toISOString();
    const runningAnalysis: SiteAnalysis = {
      id: analysis?.id ?? `${project.id}-latest`,
      projectId: project.id,
      status: "running",
      createdAt: now,
      lastCompletedStage: null,
      summary: "正在基于当前输入重新抓取候选区域..."
    };

    setProject((current) =>
      current
        ? {
            ...current,
            updatedAt: now,
            currentAnalysis: runningAnalysis
          }
        : current
    );

    if (!session?.id) {
      updateProjectAnalysis(project.id, runningAnalysis);
    }

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: project.input,
          runOptions: {
            projectId: project.id,
            radiusMeters: project.input.coverageRadiusMeters
          }
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        provider?: string;
        result?: SiteAnalysis["result"];
        costEstimate?: SiteAnalysis["costEstimate"];
      };

      if (!response.ok || !payload.result || !payload.costEstimate) {
        throw new Error(payload.error ?? "重新分析失败");
      }

      const nextAnalysis: SiteAnalysis = {
        ...runningAnalysis,
        status: "complete",
        lastCompletedStage: "summarize",
        summary: `已重新完成分析，数据来源 ${payload.provider}`,
        result: payload.result,
        costEstimate: payload.costEstimate
      };

      setProject((current) =>
        current
          ? {
              ...current,
              updatedAt: new Date().toISOString(),
              currentAnalysis: nextAnalysis
            }
          : current
      );

      if (!session?.id) {
        updateProjectAnalysis(project.id, nextAnalysis);
      }

      setActionFeedback("已基于当前项目重新运行分析。");
    } catch (error) {
      const message = getErrorMessage(error);
      const failedAnalysis: SiteAnalysis = {
        ...runningAnalysis,
        status: "failed",
        lastCompletedStage: "collect",
        summary: "重新分析失败",
        error: message
      };

      setProject((current) =>
        current
          ? {
              ...current,
              updatedAt: new Date().toISOString(),
              currentAnalysis: failedAnalysis
            }
          : current
      );

      if (!session?.id) {
        updateProjectAnalysis(project.id, failedAnalysis);
      }

      setActionFeedback(message);
    } finally {
      setIsRerunning(false);
    }
  }

  return (
    <div className="stack">
      <div className="soft-panel">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">Project Detail</p>
            <h1>{project.input.projectName}</h1>
            <p>
              {getStoreTypeLabel(project.input.businessType)} / {project.input.cuisineFocus} /{" "}
              {project.input.targetAddress} / 创建于{" "}
              {formatDateTime(project.createdAt)}
            </p>
          </div>

          <div className="hero-actions">
            <button
              aria-busy={isRerunning}
              className="primary-button"
              disabled={isRerunning}
              onClick={rerunAnalysis}
              type="button"
            >
              {isRerunning ? "重新分析中..." : "重新运行分析"}
            </button>
            <Link className="ghost-button" href="/projects/new">
              新建一轮分析
            </Link>
          </div>
        </div>

        <div className="meta-line">
          <span>状态: {formatAnalysisStatus(analysis?.status ?? "draft")}</span>
          <span>店型: {getStoreTypeLabel(project.input.businessType)}</span>
          <span>客群: {project.input.targetAudience}</span>
          <span>预算: {project.input.budgetRange}</span>
          <span>半径: {project.input.coverageRadiusMeters}m</span>
          <span>偏好: {formatPreferredAreaType(project.input.preferredAreaType)}</span>
          {analysis?.costEstimate ? (
            <span>数据源: {formatProviderName(analysis.costEstimate.provider)}</span>
          ) : null}
          {analysis?.costEstimate ? (
            <span>本次预估成本: ${analysis.costEstimate.estimatedUsd.toFixed(4)}</span>
          ) : null}
        </div>
      </div>

      {actionFeedback ? (
        <div className="callout">
          <strong>{analysis?.status === "failed" ? "操作反馈" : "最新状态"}</strong>
          <span>{actionFeedback}</span>
        </div>
      ) : null}

      {!analysis || analysis.status === "draft" ? (
        <div className="empty-state">当前项目还没有分析结果。</div>
      ) : null}

      {analysis?.status === "running" ? (
        <div className="callout">
          <strong>分析进行中</strong>
          <span>{analysis.summary}</span>
        </div>
      ) : null}

      {analysis?.status === "failed" ? (
        <div className="callout">
          <strong>分析失败</strong>
          <span>{analysis.error ?? analysis.summary}</span>
        </div>
      ) : null}

      {result ? (
        <>
          <div className="decision-grid">
            <article className="soft-panel decision-card">
              <p className="eyebrow">Decision</p>
              <h2>{decision.label}</h2>
              <p className="helper-text">{decision.detail}</p>
            </article>
            <article className="soft-panel decision-card">
              <p className="eyebrow">Lead Area</p>
              <h2>{leadArea?.name ?? "待生成"}</h2>
              <p className="helper-text">
                {leadDimension
                  ? `当前最强项是 ${dimensionLabel(leadDimension[0])}，总分 ${leadArea?.overallScore ?? "--"}`
                  : "等待候选区域生成"}
              </p>
            </article>
            <article className="soft-panel decision-card">
              <p className="eyebrow">Confidence</p>
              <h2>{confidence.label}</h2>
              <p className="helper-text">{confidence.detail}</p>
            </article>
            <article className="soft-panel decision-card">
              <p className="eyebrow">Gap To #2</p>
              <h2>{leadArea && runnerUp ? `+${leadArea.overallScore - runnerUp.overallScore}` : "--"}</h2>
              <p className="helper-text">
                {leadArea && runnerUp
                  ? `${leadArea.name} 相比第二名的领先分差`
                  : "当前只有一个推荐区域"}
              </p>
            </article>
          </div>

          <div className="two-col">
            <div className="soft-panel">
              <p className="eyebrow">Field Checklist</p>
              <h2 style={{ marginTop: 14 }}>建议先核验的四件事</h2>
              <ul className="section-copy" style={{ paddingLeft: 18 }}>
                {fieldChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="soft-panel">
              <p className="eyebrow">Decision Notes</p>
              <h2 style={{ marginTop: 14 }}>为什么现在先看这个区域</h2>
              <div className="project-list" style={{ marginTop: 18 }}>
                {leadArea ? (
                  <>
                    <div className="project-row">
                      <div>
                        <h3>{leadArea.name}</h3>
                        <p>{scoreTone(leadArea.overallScore)}</p>
                      </div>
                      <div className="score-orb" style={{ minWidth: 68, minHeight: 68 }}>
                        {leadArea.overallScore}
                      </div>
                    </div>
                    <div className="chip-row">
                      {leadArea.evidence.primarySignals.map((signal) => (
                        <span className="signal-chip" key={signal}>
                          {signal}
                        </span>
                      ))}
                    </div>
                    {leadArea.evidence.warnings.length > 0 ? (
                      <div className="chip-row" style={{ marginTop: 12 }}>
                        {leadArea.evidence.warnings.map((warning) => (
                          <span className="warning-chip" key={warning}>
                            {warning}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="empty-state">还没有可解释的首选区域。</div>
                )}
              </div>
            </div>
          </div>

          <div className="soft-panel stack">
            <div>
              <p className="eyebrow">Decision Matrix</p>
              <h2 className="section-title">候选区域对比面板</h2>
              <p className="section-copy">
                先看哪一个区域整体领先，再看每个候选区到底是赢在人流、业态还是租金适配。
              </p>
            </div>
            <div className="compare-grid">
              {result.recommendedAreas.map((area, index) => {
                const strongest = topDimension(area);

                return (
                  <article
                    className={cn("compare-card", index === 0 && "compare-card-lead")}
                    key={area.areaId}
                  >
                    <div className="compare-head">
                      <div>
                        <span className="result-rank">Top {index + 1}</span>
                        <h3>{area.name}</h3>
                        <p className="helper-text">
                          最强项 {dimensionLabel(strongest[0])} / {scoreTone(area.overallScore)}
                        </p>
                      </div>
                      <div className="score-orb" style={{ minWidth: 72, minHeight: 72 }}>
                        {area.overallScore}
                      </div>
                    </div>

                    <div className="score-stack">
                      {scoringDimensions.map((dimension) => (
                        <div className="score-row" key={dimension.key}>
                          <span>{dimension.label}</span>
                          <div className="score-bar">
                            <div
                              className="score-fill"
                              style={{ width: `${area.dimensionScores[dimension.key]}%` }}
                            />
                          </div>
                          <strong>{area.dimensionScores[dimension.key]}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="soft-panel stack">
            <div>
              <p className="eyebrow">Executive Summary</p>
              <h2 className="section-title">推荐区域拆解</h2>
              <p className="section-copy">{result.summary}</p>
            </div>
            <div className="results-grid">
              {result.recommendedAreas.map((area, index) => (
                <article className="result-card" key={area.areaId}>
                  <div className="result-head">
                    <div>
                      <span className="result-rank">Top {index + 1}</span>
                      <h3>{area.name}</h3>
                      <p className="helper-text">
                        {scoreTone(area.overallScore)} / 推荐生成于{" "}
                        {formatDateTime(result.generatedAt)}
                      </p>
                    </div>
                    <div className="score-orb">{area.overallScore}</div>
                  </div>

                  <div className="dimension-grid">
                    {scoringDimensions.map((dimension) => (
                      <div className="dimension-chip" key={dimension.key}>
                        <strong>{area.dimensionScores[dimension.key]}</strong>
                        <span>{dimension.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="two-col" style={{ marginTop: 16 }}>
                    <div className="bullet-box">
                      <h4>为什么推荐</h4>
                      <ul>
                        {area.whyRecommended.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bullet-box">
                      <h4>为什么不推荐</h4>
                      <ul>
                        {area.whyNotRecommended.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="meta-line">
                    <span>{area.evidence.estimatedRentBand}</span>
                    {area.evidence.primarySignals.map((signal) => (
                      <span key={signal}>{signal}</span>
                    ))}
                  </div>
                  {area.evidence.nearbyLandmarks.length > 0 ? (
                    <div className="chip-row">
                      {area.evidence.nearbyLandmarks.map((landmark) => (
                        <span className="signal-chip" key={landmark}>
                          {landmark}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {area.evidence.warnings.length > 0 ? (
                    <div className="chip-row" style={{ marginTop: 12 }}>
                      {area.evidence.warnings.map((warning) => (
                        <span className="warning-chip" key={warning}>
                          {warning}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <div className="two-col">
            <div className="soft-panel">
              <p className="eyebrow">Risk Notes</p>
              <h2 style={{ marginTop: 14 }}>风险提示</h2>
              <ul className="section-copy" style={{ paddingLeft: 18 }}>
                {result.riskNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>

            <div className="soft-panel">
              <p className="eyebrow">Next Actions</p>
              <h2 style={{ marginTop: 14 }}>下一步建议</h2>
              <ul className="section-copy" style={{ paddingLeft: 18 }}>
                {result.nextActions.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>

          {analysis.costEstimate ? (
            <div className="soft-panel">
              <p className="eyebrow">API Cost</p>
              <h2 style={{ marginTop: 14 }}>本次分析成本估算</h2>
              <p className="section-copy">{analysis.costEstimate.note}</p>
              <div className="project-list" style={{ marginTop: 18 }}>
                {analysis.costEstimate.lineItems.map((item) => (
                  <div className="project-row" key={item.sku}>
                    <div>
                      <h3>{item.sku}</h3>
                      <p>
                        {item.count} 次调用，单价 ${item.unitPriceUsd.toFixed(4)}
                      </p>
                    </div>
                    <div className="score-orb" style={{ minWidth: 68, minHeight: 68 }}>
                      ${item.subtotalUsd.toFixed(3)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {result.rejectedAreas.length > 0 ? (
            <div className="soft-panel">
              <p className="eyebrow">Hold Back</p>
              <h2 style={{ marginTop: 14 }}>暂不优先区域</h2>
              <div className="project-list">
                {result.rejectedAreas.map((area) => (
                  <div className="project-row" key={area.areaId}>
                    <div>
                      <h3>{area.name}</h3>
                      <p>{area.whyNotRecommended[0]}</p>
                    </div>
                    <div className="score-orb" style={{ minWidth: 68, minHeight: 68 }}>
                      {area.overallScore}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
