import {
  CandidateAreaScore,
  CreateProjectInput,
  GooglePlaceCandidate,
  ScoringDimensionKey
} from "@/lib/types";
import { getStoreTypeProfile } from "@/lib/store-config";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function parseTicketLevel(averageTicket: string) {
  const digits = averageTicket.match(/\d+/g)?.map(Number) ?? [];
  if (digits.length === 0) {
    return 60;
  }

  return clamp(digits.reduce((total, value) => total + value, 0) / digits.length);
}

function parseBudgetLevel(budgetRange: string) {
  const digits = budgetRange.match(/\d+/g)?.map(Number) ?? [];
  if (digits.length === 0) {
    return 55;
  }

  return clamp(digits.reduce((total, value) => total + value, 0) / digits.length / 1000);
}

function parseRentToleranceLevel(rentTolerance: string) {
  const lower = rentTolerance.toLowerCase();

  if (
    lower.includes("低租") ||
    lower.includes("只能低") ||
    lower.includes("strict") ||
    lower.includes("sensitive") ||
    lower.includes("预算紧")
  ) {
    return 35;
  }

  if (
    lower.includes("中高") ||
    lower.includes("高租") ||
    lower.includes("可接受高") ||
    lower.includes("prime") ||
    lower.includes("旗舰")
  ) {
    return 82;
  }

  return 60;
}

function vibeScore(vibe: GooglePlaceCandidate["vibe"]) {
  if (vibe === "prime") {
    return 88;
  }

  if (vibe === "steady") {
    return 72;
  }

  return 58;
}

function deriveAudienceTags(targetAudience: string) {
  const lower = targetAudience.toLowerCase();
  const tags = new Set<string>();

  if (/(白领|上班|office|worker|commuter)/.test(lower)) {
    tags.add("office");
  }

  if (/(家庭|亲子|family|community|居民)/.test(lower)) {
    tags.add("family");
  }

  if (/(学生|校园|student|college|young)/.test(lower)) {
    tags.add("student");
  }

  if (/(游客|tourist|visitor)/.test(lower)) {
    tags.add("tourist");
  }

  if (/(夜间|夜宵|晚餐|聚餐|night|late)/.test(lower)) {
    tags.add("nightlife");
  }

  return tags;
}

function deriveNoteSignals(notes: string) {
  const lower = notes.toLowerCase();
  const tags = new Set<string>();

  if (/(样板|首店|旗舰|flagship|first store)/.test(lower)) {
    tags.add("flagship");
  }

  if (/(周末|weekend)/.test(lower)) {
    tags.add("weekend");
  }

  if (/(夜间|夜宵|晚餐|night|late)/.test(lower)) {
    tags.add("evening");
  }

  if (/(外卖|配送|delivery|takeout)/.test(lower)) {
    tags.add("delivery");
  }

  if (/(停车|parking|drive)/.test(lower)) {
    tags.add("parking");
  }

  return tags;
}

function buildCompetitionScore(
  competitorCount: number,
  budgetLevel: number,
  storeType: CreateProjectInput["businessType"]
) {
  const baseline = 92 - competitorCount * 6;
  const budgetShield = budgetLevel > 60 ? 8 : 0;
  const fierceCategories =
    storeType === "tea" || storeType === "cafe" || storeType === "convenience_store" ? -6 : 0;
  return clamp(baseline + budgetShield + fierceCategories);
}

function buildComplementaryScore(
  candidate: GooglePlaceCandidate,
  input: CreateProjectInput,
  audienceTags: Set<string>,
  noteSignals: Set<string>
) {
  let score = candidate.counts.complementary * 5 + candidate.counts.anchor * 4;

  if (
    (input.preferredAreaType === "mall" && candidate.counts.anchor >= 4) ||
    (input.preferredAreaType === "office" && candidate.counts.transit >= 3) ||
    (input.preferredAreaType === "residential" && candidate.counts.complementary >= 6)
  ) {
    score += 10;
  }

  if (audienceTags.has("office") && candidate.counts.transit >= 3) {
    score += 8;
  }

  if (audienceTags.has("family") && candidate.counts.anchor >= 3) {
    score += 8;
  }

  if (audienceTags.has("nightlife") && candidate.vibe !== "emerging") {
    score += 6;
  }

  if (noteSignals.has("weekend")) {
    score += 5;
  }

  if (noteSignals.has("evening")) {
    score += 4;
  }

  return clamp(score);
}

function buildAccessibilityScore(
  candidate: GooglePlaceCandidate,
  audienceTags: Set<string>,
  noteSignals: Set<string>
) {
  let score = candidate.counts.transit * 15 + candidate.counts.anchor * 6 + 20;

  if (audienceTags.has("office") || audienceTags.has("student")) {
    score += candidate.counts.transit >= 3 ? 8 : 3;
  }

  if (noteSignals.has("parking")) {
    score += candidate.counts.anchor >= 2 ? 5 : 0;
  }

  if (noteSignals.has("evening")) {
    score += candidate.counts.transit >= 2 ? 4 : 0;
  }

  return clamp(score);
}

function buildMaturityScore(
  candidate: GooglePlaceCandidate,
  audienceTags: Set<string>,
  noteSignals: Set<string>
) {
  let score = vibeScore(candidate.vibe);

  if (audienceTags.has("family") && candidate.vibe !== "emerging") {
    score += 6;
  }

  if (audienceTags.has("tourist") && candidate.vibe === "prime") {
    score += 6;
  }

  if (noteSignals.has("flagship")) {
    score += candidate.vibe === "prime" ? 10 : candidate.vibe === "steady" ? 4 : -6;
  }

  return clamp(score);
}

function buildRentPressureScore(
  rentIndex: number,
  input: CreateProjectInput,
  budgetLevel: number,
  rentToleranceLevel: number,
  noteSignals: Set<string>
) {
  const highTicket = parseTicketLevel(input.averageTicket) > 120 ? 10 : 0;
  const scalePenalty = input.storeScale.toLowerCase().includes("large") ? 6 : 0;
  const toleranceBonus = (rentToleranceLevel - 60) * 0.6;
  const flagshipBonus = noteSignals.has("flagship") ? 6 : 0;
  const deliveryBonus = noteSignals.has("delivery") ? 5 : 0;

  return clamp(
    112 -
      rentIndex +
      budgetLevel * 0.35 +
      toleranceBonus +
      highTicket +
      flagshipBonus +
      deliveryBonus -
      scalePenalty
  );
}

function buildFootTrafficScore(
  candidate: GooglePlaceCandidate,
  audienceTags: Set<string>,
  noteSignals: Set<string>
) {
  let score = candidate.footTrafficIndex;

  if (audienceTags.has("tourist")) {
    score += candidate.counts.anchor >= 4 ? 8 : 3;
  }

  if (audienceTags.has("nightlife")) {
    score += candidate.vibe === "prime" ? 7 : 3;
  }

  if (audienceTags.has("office")) {
    score += candidate.counts.transit >= 3 ? 4 : 0;
  }

  if (noteSignals.has("flagship")) {
    score += 4;
  }

  if (noteSignals.has("delivery")) {
    score -= 4;
  }

  return clamp(score);
}

function buildRecommendedReasons(
  dimensions: Record<ScoringDimensionKey, number>,
  candidate: GooglePlaceCandidate,
  audienceTags: Set<string>,
  noteSignals: Set<string>
) {
  const reasons: string[] = [];

  if (dimensions.footTraffic >= 78) {
    reasons.push("人流代理指数高，具备较强自然曝光与进店机会。");
  }

  if (dimensions.complementary >= 72) {
    reasons.push("周边互补业态完整，具备餐前餐后联动消费条件。");
  }

  if (dimensions.accessibility >= 70) {
    reasons.push(`到达便利度较好，${candidate.travelModeHint}。`);
  }

  if (dimensions.rentPressure >= 68) {
    reasons.push("租金压力与当前项目预算更匹配，落地风险较低。");
  }

  if (audienceTags.has("office") && candidate.counts.transit >= 3) {
    reasons.push("与白领通勤客群匹配度较高，午晚高峰承接能力更好。");
  }

  if (audienceTags.has("family") && candidate.vibe !== "emerging") {
    reasons.push("区域成熟度更适合家庭与社区型复购客群。");
  }

  if (noteSignals.has("flagship") && candidate.vibe === "prime") {
    reasons.push("商圈成熟度和展示面更适合首店或样板店落位。");
  }

  if (reasons.length === 0) {
    reasons.push("综合指标较均衡，适合作为备选区域继续实勘。");
  }

  return reasons.slice(0, 4);
}

function buildWarningReasons(
  dimensions: Record<ScoringDimensionKey, number>,
  candidate: GooglePlaceCandidate,
  audienceTags: Set<string>,
  noteSignals: Set<string>
) {
  const warnings: string[] = [];

  if (dimensions.competition < 56) {
    warnings.push("同类竞品密度偏高，需要进一步验证差异化能力。");
  }

  if (dimensions.rentPressure < 52) {
    warnings.push("租金压力偏大，建议复核坪效与回本周期。");
  }

  if (dimensions.footTraffic < 60) {
    warnings.push("人流代理值一般，可能更依赖固定客群与复购。");
  }

  if (candidate.vibe === "emerging") {
    warnings.push("区域仍在成长阶段，消费心智需要时间培养。");
  }

  if (audienceTags.has("family") && candidate.vibe === "emerging") {
    warnings.push("家庭客群通常更依赖成熟商圈，需要重点核验周末稳定性。");
  }

  if (noteSignals.has("flagship") && candidate.vibe === "emerging") {
    warnings.push("若作为首店或样板店，当前成熟度可能还不够稳。");
  }

  if (warnings.length === 0) {
    warnings.push("当前没有明显硬伤，但仍建议线下核验高峰时段客流。");
  }

  return warnings.slice(0, 4);
}

function estimatedRentBand(rentIndex: number) {
  if (rentIndex >= 85) {
    return "高租金带";
  }

  if (rentIndex >= 65) {
    return "中高租金带";
  }

  if (rentIndex >= 45) {
    return "中租金带";
  }

  return "相对友好租金带";
}

export function scoreCandidateAreas(
  input: CreateProjectInput,
  candidates: GooglePlaceCandidate[],
  weightOverride?: Partial<Record<ScoringDimensionKey, number>>
): CandidateAreaScore[] {
  const budgetLevel = parseBudgetLevel(input.budgetRange);
  const rentToleranceLevel = parseRentToleranceLevel(input.rentTolerance);
  const audienceTags = deriveAudienceTags(input.targetAudience);
  const noteSignals = deriveNoteSignals(input.notes);
  const storeProfile = getStoreTypeProfile(input.businessType);
  const weights = { ...storeProfile.weights, ...weightOverride };

  return candidates
    .map((candidate) => {
      const dimensionScores: Record<ScoringDimensionKey, number> = {
        footTraffic: buildFootTrafficScore(candidate, audienceTags, noteSignals),
        competition: buildCompetitionScore(
          candidate.counts.competitor,
          budgetLevel,
          input.businessType
        ),
        complementary: buildComplementaryScore(candidate, input, audienceTags, noteSignals),
        accessibility: buildAccessibilityScore(candidate, audienceTags, noteSignals),
        maturity: buildMaturityScore(candidate, audienceTags, noteSignals),
        rentPressure: buildRentPressureScore(
          candidate.rentIndex,
          input,
          budgetLevel,
          rentToleranceLevel,
          noteSignals
        )
      };

      const weightedScore =
        dimensionScores.footTraffic * weights.footTraffic +
        dimensionScores.competition * weights.competition +
        dimensionScores.complementary * weights.complementary +
        dimensionScores.accessibility * weights.accessibility +
        dimensionScores.maturity * weights.maturity +
        dimensionScores.rentPressure * weights.rentPressure;

      return {
        areaId: candidate.id,
        name: candidate.name,
        lat: candidate.lat,
        lng: candidate.lng,
        overallScore: Math.round(weightedScore),
        dimensionScores,
        evidence: {
          primarySignals: [
            `${candidate.counts.anchor} 个商业锚点`,
            `${candidate.counts.transit} 个高频到达节点`,
            `${candidate.counts.competitor} 家同类竞品`,
            `${candidate.counts.complementary} 个互补业态`
          ],
          warnings: buildWarningReasons(
            dimensionScores,
            candidate,
            audienceTags,
            noteSignals
          ),
          nearbyLandmarks: candidate.nearbyLandmarks,
          estimatedRentBand: estimatedRentBand(candidate.rentIndex)
        },
        whyRecommended: buildRecommendedReasons(
          dimensionScores,
          candidate,
          audienceTags,
          noteSignals
        ),
        whyNotRecommended: buildWarningReasons(
          dimensionScores,
          candidate,
          audienceTags,
          noteSignals
        )
      };
    })
    .sort((left, right) => right.overallScore - left.overallScore);
}
