import { ScoringDimension } from "@/lib/types";

export const scoringDimensions: ScoringDimension[] = [
  {
    key: "footTraffic",
    label: "人流代理",
    description: "周边热门地点、商业锚点与访问活跃度的综合代理值。"
  },
  {
    key: "competition",
    label: "竞品压力",
    description: "同类餐饮密度带来的竞争强度，分数越高代表竞争越可控。"
  },
  {
    key: "complementary",
    label: "互补业态",
    description: "办公、娱乐、零售等互补业态对引流的支持程度。"
  },
  {
    key: "accessibility",
    label: "到达便利",
    description: "地铁、公交、停车和主干道可达性。"
  },
  {
    key: "maturity",
    label: "商圈成熟度",
    description: "区域是否已经形成稳定消费心智与经营氛围。"
  },
  {
    key: "rentPressure",
    label: "租金压力",
    description: "租金强度与项目预算适配度，分数越高代表压力越低。"
  }
];

export const defaultWeights = {
  footTraffic: 0.24,
  competition: 0.16,
  complementary: 0.18,
  accessibility: 0.16,
  maturity: 0.16,
  rentPressure: 0.1
} as const;

export const dashboardStats = [
  { label: "分析速度", value: "< 45 秒" },
  { label: "推荐区域", value: "Top 3-5" },
  { label: "评分维度", value: "6 项" }
];
