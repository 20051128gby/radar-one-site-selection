"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/app-providers";
import { getStoreTypeProfile, storeTypeOptions } from "@/lib/store-config";
import { upsertProject, updateProjectAnalysis } from "@/lib/storage";
import { CreateProjectInput, ProjectRecord, SiteAnalysis } from "@/lib/types";
import { formatPreferredAreaType, getErrorMessage } from "@/lib/utils";

const defaultInput: CreateProjectInput = {
  projectName: "新店选址项目",
  businessType: "hotpot",
  cuisineFocus: "川渝火锅",
  budgetRange: "80000-150000",
  storeScale: "medium / 180 sqm",
  targetAudience: "周边白领 + 夜间聚餐客群",
  averageTicket: "120-160",
  rentTolerance: "可接受中高租金，要求高峰人流支撑",
  coverageRadiusMeters: 1800,
  preferredAreaType: "office",
  targetAddress: "San Francisco Ferry Building",
  notes: "需要晚餐与周末都具备稳定流量，适合品牌第一家样板店。"
};

function buildId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function ProjectForm() {
  const router = useRouter();
  const { session, hydrated } = useAuth();
  const [input, setInput] = useState<CreateProjectInput>(defaultInput);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const storeProfile = getStoreTypeProfile(input.businessType);
  const completionChecklist = [
    input.projectName.trim(),
    input.cuisineFocus.trim(),
    input.budgetRange.trim(),
    input.storeScale.trim(),
    input.targetAudience.trim(),
    input.averageTicket.trim(),
    input.rentTolerance.trim(),
    input.targetAddress.trim(),
    input.notes.trim(),
    input.coverageRadiusMeters >= 500 ? "radius" : ""
  ];
  const completedFields = completionChecklist.filter(Boolean).length;
  const completionPercent = Math.round((completedFields / completionChecklist.length) * 100);
  const leadingFactors = Object.entries(storeProfile.weights)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([key]) => {
      const mapping: Record<string, string> = {
        footTraffic: "人流代理",
        competition: "竞品可控度",
        complementary: "互补业态",
        accessibility: "到达便利",
        maturity: "商圈成熟度",
        rentPressure: "租金匹配"
      };

      return mapping[key] ?? key;
    });

  function updateField<Key extends keyof CreateProjectInput>(
    key: Key,
    value: CreateProjectInput[Key]
  ) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    if (!input.projectName.trim() || !input.cuisineFocus.trim() || !input.targetAddress.trim()) {
      return "请至少填写项目名称、细分品类和目标地点。";
    }

    if (input.coverageRadiusMeters < 500) {
      return "建议分析半径不少于 500 米。";
    }

    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const nextError = validate();
    if (nextError) {
      setError(nextError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    void (async () => {
      const projectId = buildId("project");
      const now = new Date().toISOString();
      const project: ProjectRecord = {
        id: projectId,
        createdAt: now,
        updatedAt: now,
        ownerEmail: session?.email ?? "guest@local",
        input
      };

      const runningAnalysis: SiteAnalysis = {
        id: buildId("analysis"),
        projectId,
        status: "running",
        createdAt: now,
        lastCompletedStage: null,
        summary: "正在抓取候选商圈与评分..."
      };

      upsertProject({ ...project, currentAnalysis: runningAnalysis });

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input,
            runOptions: {
              projectId,
              radiusMeters: input.coverageRadiusMeters
            }
          })
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "分析请求失败");
        }

        const payload = (await response.json()) as {
          provider: string;
          result: SiteAnalysis["result"];
          costEstimate: SiteAnalysis["costEstimate"];
        };

        updateProjectAnalysis(projectId, {
          ...runningAnalysis,
          status: "complete",
          lastCompletedStage: "summarize",
          summary: `已完成分析，数据来源 ${payload.provider}`,
          result: payload.result,
          costEstimate: payload.costEstimate
        });

        router.push(`/projects/${projectId}`);
      } catch (analysisError) {
        updateProjectAnalysis(projectId, {
          ...runningAnalysis,
          status: "failed",
          lastCompletedStage: "collect",
          summary: "分析未完成",
          error: getErrorMessage(analysisError)
        });
        setError(getErrorMessage(analysisError));
      } finally {
        setIsSubmitting(false);
      }
    })();
  }

  return (
    <form className="soft-panel stack" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">New Analysis</p>
        <h1 className="section-title">创建一个新的选址项目。</h1>
        <p className="section-copy">
          这一步会收集项目画像和目标地点，再生成候选区域排行榜与建议。
        </p>
      </div>

      {!session && hydrated ? (
        <div className="callout">
          <strong>游客模式可用</strong>
          <span>你现在可以直接开始分析。若登录后再使用，项目历史会跟随当前浏览器会话一起保留。</span>
        </div>
      ) : null}

      <div className="two-col">
        <div className="soft-panel">
          <p className="eyebrow">Input Quality</p>
          <h2 style={{ marginTop: 14 }}>当前输入完整度 {completionPercent}%</h2>
          <p className="section-copy">
            信息越完整，排序越稳定。建议把预算、客群、租金容忍度和补充说明都填到可执行的程度。
          </p>
          <div className="score-bar" style={{ marginTop: 18 }}>
            <div className="score-fill" style={{ width: `${completionPercent}%` }} />
          </div>
          <div className="toolbar-meta" style={{ marginTop: 12 }}>
            <span>已完成 {completedFields} / {completionChecklist.length} 项关键输入</span>
          </div>
        </div>
        <div className="soft-panel">
          <p className="eyebrow">Store Playbook</p>
          <h2 style={{ marginTop: 14 }}>{storeProfile.label} 选址侧重点</h2>
          <p className="section-copy">{storeProfile.description}</p>
          <div className="chip-row" style={{ marginTop: 18 }}>
            {leadingFactors.map((factor) => (
              <span className="signal-chip" key={factor}>
                重点关注 {factor}
              </span>
            ))}
          </div>
          <p className="helper-text" style={{ marginTop: 14 }}>
            默认推荐优先从{formatPreferredAreaType(storeProfile.defaultPreferredAreaType)}开始找候选区域。
          </p>
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="projectName">项目名称</label>
          <input
            id="projectName"
            onChange={(event) => updateField("projectName", event.target.value)}
            value={input.projectName}
          />
        </div>
        <div className="field">
          <label htmlFor="businessType">店铺类型</label>
          <select
            id="businessType"
            onChange={(event) => {
              const nextType = event.target.value;
              updateField("businessType", nextType);
              updateField(
                "preferredAreaType",
                getStoreTypeProfile(nextType).defaultPreferredAreaType
              );
            }}
            value={input.businessType}
          >
            {storeTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="field-hint">
            系统会按店铺类型切换评分权重和周边 POI 抓取逻辑。
          </span>
        </div>
        <div className="field">
          <label htmlFor="cuisineFocus">细分定位 / 产品方向</label>
          <input
            id="cuisineFocus"
            onChange={(event) => updateField("cuisineFocus", event.target.value)}
            value={input.cuisineFocus}
          />
        </div>
        <div className="field">
          <label htmlFor="storeScale">规模 / 面积</label>
          <input
            id="storeScale"
            onChange={(event) => updateField("storeScale", event.target.value)}
            value={input.storeScale}
          />
        </div>
        <div className="field">
          <label htmlFor="budgetRange">预算区间</label>
          <input
            id="budgetRange"
            onChange={(event) => updateField("budgetRange", event.target.value)}
            value={input.budgetRange}
          />
        </div>
        <div className="field">
          <label htmlFor="averageTicket">目标客单价</label>
          <input
            id="averageTicket"
            onChange={(event) => updateField("averageTicket", event.target.value)}
            value={input.averageTicket}
          />
        </div>
        <div className="field">
          <label htmlFor="targetAudience">目标客群</label>
          <input
            id="targetAudience"
            onChange={(event) => updateField("targetAudience", event.target.value)}
            value={input.targetAudience}
          />
          <span className="field-hint">例如：白领午餐、家庭客、学生、夜间聚餐、游客。</span>
        </div>
        <div className="field">
          <label htmlFor="rentTolerance">租金接受范围</label>
          <input
            id="rentTolerance"
            onChange={(event) => updateField("rentTolerance", event.target.value)}
            value={input.rentTolerance}
          />
          <span className="field-hint">例如：只能低租金、可接受中高租金、旗舰店可承受高租金。</span>
        </div>
        <div className="field">
          <label htmlFor="coverageRadiusMeters">分析半径（米）</label>
          <input
            id="coverageRadiusMeters"
            min={500}
            onChange={(event) =>
              updateField("coverageRadiusMeters", Number(event.target.value))
            }
            type="number"
            value={input.coverageRadiusMeters}
          />
        </div>
        <div className="field">
          <label>偏好区域类型</label>
          <div className="segmented">
            {[
              { value: "office", label: "办公区" },
              { value: "residential", label: "住宅区" },
              { value: "mall", label: "商场区" }
            ].map((option) => (
              <button
                className={input.preferredAreaType === option.value ? "active" : ""}
                key={option.value}
                onClick={() =>
                  updateField("preferredAreaType", option.value as CreateProjectInput["preferredAreaType"])
                }
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field form-grid-full">
          <label htmlFor="targetAddress">目标地点</label>
          <input
            id="targetAddress"
            onChange={(event) => updateField("targetAddress", event.target.value)}
            placeholder="例如: San Francisco Ferry Building"
            value={input.targetAddress}
          />
          <span className="field-hint">
            接入真实 Google Maps API 后，这里可解析为经纬度并抓取周边候选区域。
          </span>
        </div>
        <div className="field form-grid-full">
          <label htmlFor="notes">补充说明</label>
          <textarea
            id="notes"
            onChange={(event) => updateField("notes", event.target.value)}
            value={input.notes}
          />
          <span className="field-hint">例如：重晚餐、重周末、首店样板店、外卖占比高、需要停车位。</span>
        </div>
      </div>

      {error ? <div className="field-error">{error}</div> : null}

      <button
        aria-busy={isSubmitting}
        className="primary-button"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "正在抓取候选区域..." : "保存项目并开始分析"}
      </button>
    </form>
  );
}
