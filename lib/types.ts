export type PreferredAreaType = "office" | "residential" | "mall";

export type AnalysisStatus = "draft" | "running" | "complete" | "failed";

export type ScoringDimensionKey =
  | "footTraffic"
  | "competition"
  | "complementary"
  | "accessibility"
  | "maturity"
  | "rentPressure";

export type ScoringDimension = {
  key: ScoringDimensionKey;
  label: string;
  description: string;
};

export type CreateProjectInput = {
  projectName: string;
  businessType: string;
  cuisineFocus: string;
  budgetRange: string;
  storeScale: string;
  targetAudience: string;
  averageTicket: string;
  rentTolerance: string;
  coverageRadiusMeters: number;
  preferredAreaType: PreferredAreaType;
  targetAddress: string;
  notes: string;
};

export type RunAnalysisInput = {
  projectId: string;
  radiusMeters: number;
  weightOverride?: Partial<Record<ScoringDimensionKey, number>>;
};

export type CandidateAreaEvidence = {
  primarySignals: string[];
  warnings: string[];
  nearbyLandmarks: string[];
  estimatedRentBand: string;
};

export type CandidateAreaScore = {
  areaId: string;
  name: string;
  lat: number;
  lng: number;
  overallScore: number;
  dimensionScores: Record<ScoringDimensionKey, number>;
  evidence: CandidateAreaEvidence;
  whyRecommended: string[];
  whyNotRecommended: string[];
};

export type AnalysisResult = {
  recommendedAreas: CandidateAreaScore[];
  rejectedAreas: CandidateAreaScore[];
  summary: string;
  riskNotes: string[];
  nextActions: string[];
  generatedAt: string;
};

export type AnalysisCostEstimate = {
  provider: "google-places" | "geoapify" | "mock";
  estimatedUsd: number;
  estimatedCny: number;
  lineItems: Array<{
    sku: string;
    count: number;
    unitPriceUsd: number;
    subtotalUsd: number;
  }>;
  note: string;
};

export type AnalysisStage = "collect" | "score" | "summarize";

export type SiteAnalysis = {
  id: string;
  projectId: string;
  status: AnalysisStatus;
  createdAt: string;
  lastCompletedStage: AnalysisStage | null;
  summary: string;
  result?: AnalysisResult;
  error?: string;
  costEstimate?: AnalysisCostEstimate;
};

export type ProjectRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  ownerEmail: string;
  ownerId?: string;
  input: CreateProjectInput;
  currentAnalysis?: SiteAnalysis;
};

export type UserSession = {
  id?: string;
  email: string;
  displayName: string;
  planId?: string;
  role?: "admin" | "operator" | "viewer";
  isDisabled?: boolean;
};

export type GooglePlaceCandidate = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  travelModeHint: string;
  counts: {
    competitor: number;
    complementary: number;
    transit: number;
    anchor: number;
  };
  vibe: "emerging" | "steady" | "prime";
  footTrafficIndex: number;
  rentIndex: number;
  nearbyLandmarks: string[];
};

export type ProviderSearchContext = {
  address: string;
  businessType: string;
  cuisineFocus: string;
  preferredAreaType: PreferredAreaType;
  radiusMeters: number;
};

export type PlaceDataProvider = {
  providerName: string;
  getCandidateAreas(
    context: ProviderSearchContext
  ): Promise<GooglePlaceCandidate[]>;
};
