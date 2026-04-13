import { estimateAnalysisCost } from "@/lib/billing";
import { buildNarrativeSummary } from "@/lib/narrator";
import { createProvider, getProviderMode } from "@/lib/provider";
import { scoreCandidateAreas } from "@/lib/scoring";
import {
  AnalysisCostEstimate,
  AnalysisResult,
  CreateProjectInput,
  GooglePlaceCandidate,
  RunAnalysisInput
} from "@/lib/types";

export type AnalysisEngineResult = {
  provider: string;
  rawCandidates: GooglePlaceCandidate[];
  result: AnalysisResult;
  costEstimate: AnalysisCostEstimate;
};

export async function runSiteAnalysis(
  input: CreateProjectInput,
  runOptions: RunAnalysisInput
): Promise<AnalysisEngineResult> {
  const provider = createProvider();
  const rawCandidates = await provider.getCandidateAreas({
    address: input.targetAddress,
    businessType: input.businessType,
    cuisineFocus: input.cuisineFocus,
    preferredAreaType: input.preferredAreaType,
    radiusMeters: runOptions.radiusMeters
  });

  const rankedAreas = scoreCandidateAreas(
    input,
    rawCandidates,
    runOptions.weightOverride
  );
  const result = buildNarrativeSummary(input, rankedAreas);
  const providerMode = getProviderMode();
  const costEstimate = estimateAnalysisCost(
    provider.providerName,
    providerMode.fallbackToMock,
    rawCandidates.length
  );

  return {
    provider: provider.providerName,
    rawCandidates,
    result,
    costEstimate
  };
}
