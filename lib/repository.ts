import crypto from "node:crypto";

import {
  AnalysisAccessState,
  AnalysisEventLog,
  ShareRewardRecord,
  SubscriptionRecord,
  UsageBalanceRecord
} from "@/lib/commercial-types";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { ProjectRecord, SiteAnalysis, UserSession } from "@/lib/types";

type ProjectRow = {
  id: string;
  owner_id: string | null;
  name: string;
  business_type: string;
  cuisine_focus: string;
  target_address: string;
  target_audience: string | null;
  average_ticket: string | null;
  budget_range: string | null;
  store_scale: string | null;
  rent_tolerance: string | null;
  preferred_area_type: "office" | "residential" | "mall" | null;
  coverage_radius_meters: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SiteAnalysisRow = {
  id: string;
  project_id: string;
  status: SiteAnalysis["status"];
  last_completed_stage: SiteAnalysis["lastCompletedStage"];
  summary: string;
  provider: string | null;
  result_json: SiteAnalysis["result"] | null;
  cost_estimate_json: SiteAnalysis["costEstimate"] | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type UsageBalanceRow = {
  user_id: string;
  plan_id: string;
  basic_credits_included: number;
  basic_credits_bonus: number;
  basic_credits_used: number;
  premium_credits_included: number;
  premium_credits_bonus: number;
  premium_credits_used: number;
  created_at: string;
  updated_at: string;
};

type ShareRewardRow = {
  id: string;
  user_id: string;
  reward_type: "share_premium_analysis";
  share_reference: string;
  share_channel: string | null;
  status: "pending" | "awarded" | "reversed";
  premium_credits_awarded: number;
  awarded_at: string | null;
  created_at: string;
  updated_at: string;
};

type CreditConsumeRow = {
  allowed: boolean;
  reason: string | null;
  source: AnalysisAccessState["source"];
  plan_id: string;
  basic_remaining: number;
  premium_remaining: number;
};

type ShareRewardGrantRow = {
  awarded: boolean;
  reason: string | null;
  premium_remaining: number;
};

function configured() {
  return Boolean(getSupabaseAdminClient() && isSupabaseConfigured());
}

function requireAdminClient() {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !configured()) {
    throw new Error("Supabase 未配置完成。");
  }

  return supabase;
}

function assertNoError(error: { message?: string } | null) {
  if (error) {
    throw new Error(error.message ?? "数据库操作失败。");
  }
}

function mapProjectRow(
  row: ProjectRow,
  ownerEmail: string,
  analysis?: SiteAnalysisRow
): ProjectRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerEmail,
    ownerId: row.owner_id ?? undefined,
    input: {
      projectName: row.name,
      businessType: row.business_type,
      cuisineFocus: row.cuisine_focus,
      budgetRange: row.budget_range ?? "",
      storeScale: row.store_scale ?? "",
      targetAudience: row.target_audience ?? "",
      averageTicket: row.average_ticket ?? "",
      rentTolerance: row.rent_tolerance ?? "",
      coverageRadiusMeters: row.coverage_radius_meters,
      preferredAreaType: row.preferred_area_type ?? "office",
      targetAddress: row.target_address,
      notes: row.notes ?? ""
    },
    currentAnalysis: analysis
      ? {
          id: analysis.id,
          projectId: analysis.project_id,
          status: analysis.status,
          createdAt: analysis.created_at,
          lastCompletedStage: analysis.last_completed_stage,
          summary: analysis.summary,
          result: analysis.result_json ?? undefined,
          error: analysis.error ?? undefined,
          costEstimate: analysis.cost_estimate_json ?? undefined
        }
      : undefined
  };
}

function mapUsageBalanceRow(row: UsageBalanceRow): UsageBalanceRecord {
  const basicRemaining = Math.max(
    row.basic_credits_included + row.basic_credits_bonus - row.basic_credits_used,
    0
  );
  const premiumRemaining = Math.max(
    row.premium_credits_included + row.premium_credits_bonus - row.premium_credits_used,
    0
  );

  return {
    userId: row.user_id,
    planId: row.plan_id as UsageBalanceRecord["planId"],
    basicIncluded: row.basic_credits_included,
    basicBonus: row.basic_credits_bonus,
    basicUsed: row.basic_credits_used,
    basicRemaining,
    premiumIncluded: row.premium_credits_included,
    premiumBonus: row.premium_credits_bonus,
    premiumUsed: row.premium_credits_used,
    premiumRemaining,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapShareRewardRow(row: ShareRewardRow): ShareRewardRecord {
  return {
    id: row.id,
    userId: row.user_id,
    rewardType: row.reward_type,
    shareReference: row.share_reference,
    shareChannel: row.share_channel,
    status: row.status,
    premiumCreditsAwarded: row.premium_credits_awarded,
    awardedAt: row.awarded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function hashGuestValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function buildGuestTrialKey(ip: string | null) {
  return hashGuestValue(ip ?? "unknown");
}

export function buildUserAgentKey(userAgent: string | null) {
  if (!userAgent) {
    return null;
  }

  return hashGuestValue(userAgent);
}

export async function syncUsageBalancePlan(userId: string, planId: string) {
  const supabase = requireAdminClient();
  const { data, error } = await supabase.rpc("sync_usage_balance_plan", {
    p_user_id: userId,
    p_plan_id: planId
  });

  assertNoError(error);
  return mapUsageBalanceRow(data as UsageBalanceRow);
}

export async function fetchUsageBalance(userId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !configured()) {
    return null;
  }

  const { data, error } = await supabase
    .from("usage_balances")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  assertNoError(error);

  if (!data) {
    return null;
  }

  return mapUsageBalanceRow(data as UsageBalanceRow);
}

export async function consumeUserAnalysisCredit(
  userId: string,
  tier: "basic" | "premium"
) {
  const supabase = requireAdminClient();
  const { data, error } = await supabase.rpc("consume_analysis_credit", {
    p_user_id: userId,
    p_tier: tier
  });

  assertNoError(error);
  const result = Array.isArray(data) ? (data[0] as CreditConsumeRow | undefined) : undefined;

  if (!result) {
    throw new Error("未拿到额度校验结果。");
  }

  return {
    allowed: result.allowed,
    reason: result.reason ?? undefined,
    source: result.source,
    bucketKey: userId,
    bucketType: "member" as const,
    analysisTier: tier,
    limit:
      tier === "premium"
        ? result.premium_remaining + (result.allowed ? 1 : 0)
        : result.basic_remaining + (result.allowed ? 1 : 0),
    used: 0,
    remaining:
      tier === "premium" ? result.premium_remaining : result.basic_remaining,
    remainingBasic: result.basic_remaining,
    remainingPremium: result.premium_remaining
  } satisfies AnalysisAccessState;
}

export async function refundUserAnalysisCredit(
  userId: string,
  tier: "basic" | "premium"
) {
  const supabase = requireAdminClient();
  const { error } = await supabase.rpc("refund_analysis_credit", {
    p_user_id: userId,
    p_tier: tier
  });

  assertNoError(error);
}

export async function claimGuestTrial(ip: string | null, userAgent: string | null) {
  const supabase = requireAdminClient();
  const ipHash = buildGuestTrialKey(ip);
  const userAgentHash = buildUserAgentKey(userAgent);
  const { data, error } = await supabase.rpc("claim_guest_trial", {
    p_ip_hash: ipHash,
    p_user_agent_hash: userAgentHash
  });

  assertNoError(error);
  const allowed = Boolean(data);

  return {
    allowed,
    reason: allowed ? undefined : "同一个 IP 只能试用 1 次，请注册后继续使用。",
    source: "guest_trial" as const,
    bucketKey: ipHash,
    bucketType: "guest" as const,
    analysisTier: "basic" as const,
    limit: 1,
    used: allowed ? 0 : 1,
    remaining: allowed ? 1 : 0,
    remainingBasic: allowed ? 1 : 0,
    remainingPremium: 0
  } satisfies AnalysisAccessState;
}

export async function releaseGuestTrial(ip: string | null) {
  const supabase = requireAdminClient();
  const { error } = await supabase.rpc("release_guest_trial", {
    p_ip_hash: buildGuestTrialKey(ip)
  });

  assertNoError(error);
}

export async function grantSharePremiumReward(
  userId: string,
  shareReference: string,
  shareChannel?: string | null,
  premiumCredits = 1
) {
  const supabase = requireAdminClient();
  const { data, error } = await supabase.rpc("grant_share_premium_reward", {
    p_user_id: userId,
    p_share_reference: shareReference,
    p_share_channel: shareChannel ?? null,
    p_premium_credits: premiumCredits
  });

  assertNoError(error);
  const result = Array.isArray(data) ? (data[0] as ShareRewardGrantRow | undefined) : undefined;

  if (!result) {
    throw new Error("分享奖励发放失败。");
  }

  return result;
}

export async function fetchShareRewardsForUser(userId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !configured()) {
    return [] as ShareRewardRecord[];
  }

  const { data, error } = await supabase
    .from("share_reward_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  assertNoError(error);
  return ((data ?? []) as ShareRewardRow[]).map(mapShareRewardRow);
}

export async function upsertProfile(session: UserSession) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !configured()) {
    return session;
  }

  if (!session.id) {
    return session;
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("role,plan_id,display_name,email")
      .eq("id", session.id)
      .maybeSingle();

    assertNoError(existingError);

    const nextRole = existing?.role ?? session.role ?? "operator";
    const nextPlanId = existing?.plan_id ?? session.planId ?? "free";
    const nextDisplayName = existing?.display_name ?? session.displayName;
    const nextEmail = existing?.email ?? session.email;
    const nextDisabled = session.isDisabled ?? false;

    const { error: upsertError } = await supabase.from("profiles").upsert({
      id: session.id,
      email: nextEmail,
      display_name: nextDisplayName,
      role: nextRole,
      plan_id: nextPlanId,
      updated_at: new Date().toISOString()
    });

    assertNoError(upsertError);

    try {
      await syncUsageBalancePlan(session.id, nextPlanId);
    } catch {}

    return {
      ...session,
      email: nextEmail,
      displayName: nextDisplayName ?? session.displayName,
      role: nextRole,
      planId: nextPlanId,
      isDisabled: nextDisabled
    } satisfies UserSession;
  } catch {
    return {
      ...session,
      role: session.role ?? "operator",
      planId: session.planId ?? "free",
      isDisabled: session.isDisabled ?? false
    } satisfies UserSession;
  }
}

export async function updateUserAccess(userId: string, disabled: boolean) {
  const supabase = requireAdminClient();
  const {
    data: { user },
    error
  } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: {
      disabled
    }
  });

  assertNoError(error);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      is_disabled: disabled,
      disabled_at: disabled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  assertNoError(profileError);
  return user;
}

export async function deleteManagedUser(userId: string) {
  const supabase = requireAdminClient();

  const { error: profileError } = await supabase.from("profiles").delete().eq("id", userId);
  assertNoError(profileError);

  const { error } = await supabase.auth.admin.deleteUser(userId);
  assertNoError(error);
}

export async function persistProject(project: ProjectRecord) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !configured() || !project.ownerId) {
    return;
  }

  const { error } = await supabase.from("projects").upsert({
    id: project.id,
    owner_id: project.ownerId,
    name: project.input.projectName,
    business_type: project.input.businessType,
    cuisine_focus: project.input.cuisineFocus,
    target_address: project.input.targetAddress,
    target_audience: project.input.targetAudience,
    average_ticket: project.input.averageTicket,
    budget_range: project.input.budgetRange,
    store_scale: project.input.storeScale,
    rent_tolerance: project.input.rentTolerance,
    preferred_area_type: project.input.preferredAreaType,
    coverage_radius_meters: project.input.coverageRadiusMeters,
    notes: project.input.notes,
    created_at: project.createdAt,
    updated_at: project.updatedAt
  });

  assertNoError(error);
}

export async function persistSiteAnalysis(analysis: SiteAnalysis) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !configured()) {
    return;
  }

  const { error } = await supabase.from("site_analyses").upsert({
    id: analysis.id,
    project_id: analysis.projectId,
    status: analysis.status,
    last_completed_stage: analysis.lastCompletedStage,
    summary: analysis.summary,
    provider: analysis.costEstimate?.provider ?? null,
    result_json: analysis.result ?? null,
    cost_estimate_json: analysis.costEstimate ?? null,
    error: analysis.error ?? null,
    created_at: analysis.createdAt,
    updated_at: new Date().toISOString()
  });

  assertNoError(error);
}

export async function logAnalysisEvent(event: AnalysisEventLog) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !configured()) {
    return;
  }

  const { error } = await supabase.from("analysis_events").insert({
    id: event.id,
    actor_id: event.actorType === "user" ? event.actorKey : null,
    actor_key: event.actorKey,
    actor_type: event.actorType,
    project_id:
      event.actorType === "user" && event.projectId !== "failed-analysis"
        ? event.projectId
        : null,
    provider: event.provider,
    status: event.status,
    analysis_tier: event.analysisTier,
    credit_source: event.creditSource,
    address: event.address,
    business_type: event.businessType,
    cuisine_focus: event.cuisineFocus,
    estimated_usd: event.estimatedUsd,
    failure_reason: event.failureReason,
    created_at: event.createdAt
  });

  assertNoError(error);
}

export async function syncSubscriptionRecord(subscription: SubscriptionRecord) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !configured()) {
    return;
  }

  const { error } = await supabase.from("subscriptions").upsert({
    user_id: subscription.userId,
    plan_id: subscription.planId,
    stripe_customer_id: subscription.stripeCustomerId,
    stripe_subscription_id: subscription.stripeSubscriptionId,
    status: subscription.status,
    current_period_end: subscription.currentPeriodEnd,
    updated_at: new Date().toISOString()
  });

  assertNoError(error);
  await syncUsageBalancePlan(subscription.userId, subscription.planId);
}

export async function fetchProjectsForOwner(session: UserSession) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !configured() || !session.id) {
    return [] as ProjectRecord[];
  }

  const { data: projectRows, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", session.id)
    .order("updated_at", { ascending: false });

  assertNoError(projectError);

  const projectIds = ((projectRows ?? []) as ProjectRow[]).map((project) => project.id);
  if (projectIds.length === 0) {
    return [];
  }

  const { data: analysisRows, error: analysisError } = await supabase
    .from("site_analyses")
    .select("*")
    .in("project_id", projectIds)
    .order("updated_at", { ascending: false });

  assertNoError(analysisError);

  const analysisByProject = new Map<string, SiteAnalysisRow>();
  for (const analysis of (analysisRows ?? []) as SiteAnalysisRow[]) {
    if (!analysisByProject.has(analysis.project_id)) {
      analysisByProject.set(analysis.project_id, analysis);
    }
  }

  return ((projectRows ?? []) as ProjectRow[]).map((project) =>
    mapProjectRow(project, session.email, analysisByProject.get(project.id))
  );
}

export async function fetchProjectById(session: UserSession, projectId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !configured() || !session.id) {
    return null;
  }

  const [{ data: project, error: projectError }, { data: analysisRows, error: analysisError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("owner_id", session.id)
        .maybeSingle(),
      supabase
        .from("site_analyses")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false })
        .limit(1)
    ]);

  assertNoError(projectError);
  assertNoError(analysisError);

  if (!project) {
    return null;
  }

  return mapProjectRow(
    project as ProjectRow,
    session.email,
    ((analysisRows ?? []) as SiteAnalysisRow[])[0]
  );
}

export async function fetchAdminOverview() {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !configured()) {
    return null;
  }

  const [
    { data: profiles, error: profileError },
    { data: projects, error: projectError },
    { data: analyses, error: analysesError },
    { data: events, error: eventsError },
    { data: usageBalances, error: usageError },
    { data: shareRewards, error: rewardError },
    authUsers
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,display_name,role,plan_id,is_disabled,disabled_at,updated_at"),
    supabase.from("projects").select("id,owner_id,name,updated_at,created_at"),
    supabase
      .from("site_analyses")
      .select("id,project_id,status,summary,provider,cost_estimate_json,created_at,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("analysis_events")
      .select(
        "id,project_id,actor_id,actor_key,actor_type,provider,status,analysis_tier,credit_source,address,business_type,cuisine_focus,estimated_usd,failure_reason,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("usage_balances").select("*"),
    supabase
      .from("share_reward_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })
  ]);

  assertNoError(profileError);
  assertNoError(projectError);
  assertNoError(analysesError);
  assertNoError(eventsError);
  assertNoError(usageError);
  assertNoError(rewardError);
  assertNoError(authUsers.error ?? null);

  const authUsersById = new Map((authUsers.data?.users ?? []).map((user) => [user.id, user]));

  return {
    profiles: (profiles ?? []).map((profile) => {
      const authUser = authUsersById.get(profile.id);
      return {
        ...profile,
        is_disabled: Boolean(profile.is_disabled ?? authUser?.app_metadata?.disabled),
        disabled_at:
          profile.disabled_at ??
          (authUser?.app_metadata?.disabled ? authUser.updated_at ?? null : null)
      };
    }),
    projects: projects ?? [],
    analyses: analyses ?? [],
    events: events ?? [],
    usageBalances: ((usageBalances ?? []) as UsageBalanceRow[]).map(mapUsageBalanceRow),
    shareRewards: ((shareRewards ?? []) as ShareRewardRow[]).map(mapShareRewardRow)
  };
}

export async function fetchAccountOverview(session: UserSession) {
  if (!session.id) {
    return null;
  }

  const [usageBalance, shareRewards, projects] = await Promise.all([
    fetchUsageBalance(session.id),
    fetchShareRewardsForUser(session.id),
    fetchProjectsForOwner(session)
  ]);

  const recentProjects = projects.slice(0, 5);
  const completedAnalyses = projects.filter(
    (project) => project.currentAnalysis?.status === "complete"
  ).length;
  const failedAnalyses = projects.filter(
    (project) => project.currentAnalysis?.status === "failed"
  ).length;
  const totalSpendUsd = projects.reduce(
    (sum, project) => sum + (project.currentAnalysis?.costEstimate?.estimatedUsd ?? 0),
    0
  );

  return {
    profile: {
      id: session.id,
      email: session.email,
      displayName: session.displayName,
      role: session.role ?? "operator",
      planId: session.planId ?? "free",
      isDisabled: Boolean(session.isDisabled)
    },
    usageBalance,
    shareRewards,
    stats: {
      projectCount: projects.length,
      completedAnalyses,
      failedAnalyses,
      totalSpendUsd: Number(totalSpendUsd.toFixed(4))
    },
    recentProjects
  };
}
