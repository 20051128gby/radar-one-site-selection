import { AnalysisStatus, PreferredAreaType } from "@/lib/types";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

export function scoreTone(score: number) {
  if (score >= 82) {
    return "高优先级";
  }

  if (score >= 70) {
    return "可重点考察";
  }

  return "谨慎评估";
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "分析任务失败，请稍后重试。";
}

export function formatAnalysisStatus(status: AnalysisStatus) {
  const mapping: Record<AnalysisStatus, string> = {
    draft: "待分析",
    running: "分析中",
    complete: "已完成",
    failed: "已失败"
  };

  return mapping[status] ?? status;
}

export function formatPreferredAreaType(areaType: PreferredAreaType) {
  const mapping: Record<PreferredAreaType, string> = {
    office: "办公区",
    residential: "住宅区",
    mall: "商场区"
  };

  return mapping[areaType] ?? areaType;
}

export function formatProviderName(provider?: string) {
  const mapping: Record<string, string> = {
    "google-places": "Google Maps",
    geoapify: "Geoapify",
    mock: "演示数据"
  };

  if (!provider) {
    return "未标记";
  }

  return mapping[provider] ?? provider;
}
