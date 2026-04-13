import { scoreTone } from "@/lib/utils";
import { getStoreTypeLabel } from "@/lib/store-config";
import { AnalysisResult, CandidateAreaScore, CreateProjectInput } from "@/lib/types";

function topDimension(area: CandidateAreaScore) {
  return Object.entries(area.dimensionScores).sort((a, b) => b[1] - a[1])[0];
}

function dimensionLabel(key: string) {
  const mapping: Record<string, string> = {
    footTraffic: "人流",
    competition: "竞品可控度",
    complementary: "互补业态",
    accessibility: "交通便利",
    maturity: "成熟度",
    rentPressure: "租金匹配"
  };

  return mapping[key] ?? key;
}

export function buildNarrativeSummary(
  input: CreateProjectInput,
  rankedAreas: CandidateAreaScore[]
): AnalysisResult {
  const recommendedAreas = rankedAreas.slice(0, 3);
  const rejectedAreas = rankedAreas.slice(3);
  const leadArea = recommendedAreas[0];
  const leadDimension = leadArea ? topDimension(leadArea) : null;

  const summary = leadArea
    ? `${input.projectName} 作为 ${getStoreTypeLabel(input.businessType)}，当前最优先的落点是 ${leadArea.name}。它在 ${leadDimension ? dimensionLabel(leadDimension[0]) : "综合指标"} 上表现最强，总分为 ${leadArea.overallScore}，属于 ${scoreTone(leadArea.overallScore)}。系统已把目标客群、租金容忍度和补充要求一起计入评分，建议优先实勘该区域，并与第二梯队区域做租金与高峰客流对比。`
    : "当前没有可输出的推荐区域，请检查地点与输入条件。";

  return {
    recommendedAreas,
    rejectedAreas,
    summary,
    riskNotes: [
      "线上地点数据只能作为初筛，正式签约前仍需线下核验午晚高峰人流。",
      "租金压力分为代理计算，建议结合真实报价、物业条件和转让费复核。",
      "若项目强依赖夜宵、周末家庭客或办公午餐，应补充对应时段的专项客流采样。"
    ],
    nextActions: [
      `优先实勘 ${recommendedAreas.map((area) => area.name).join("、")}，重点记录与你目标客群最相关的时段客流。`,
      "筛出 2 个备选铺位后，对比租售比、外摆条件、停车可达性与竞品上座率。",
      "在试营业模型中加入保守客流情景，验证回本周期是否仍可接受。"
    ],
    generatedAt: new Date().toISOString()
  };
}
