import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { runSiteAnalysis } from "@/lib/analysis";
import { AnalysisEventLog } from "@/lib/commercial-types";
import {
  buildGuestTrialKey,
  claimGuestTrial,
  consumeUserAnalysisCredit,
  logAnalysisEvent,
  persistProject,
  persistSiteAnalysis,
  refundUserAnalysisCredit,
  releaseGuestTrial
} from "@/lib/repository";
import { getRequestIp, getRequestUserAgent, getServerSession } from "@/lib/server-auth";
import { CreateProjectInput, ProjectRecord, RunAnalysisInput, SiteAnalysis } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function normalizeInput(input: CreateProjectInput): CreateProjectInput {
  const radius = Number.isFinite(input.coverageRadiusMeters)
    ? Math.min(Math.max(Number(input.coverageRadiusMeters), 300), 5000)
    : 1800;

  return {
    projectName: normalizeText(input.projectName, 80),
    businessType: normalizeText(input.businessType, 40),
    cuisineFocus: normalizeText(input.cuisineFocus, 80),
    budgetRange: normalizeText(input.budgetRange, 50),
    storeScale: normalizeText(input.storeScale, 50),
    targetAudience: normalizeText(input.targetAudience, 120),
    averageTicket: normalizeText(input.averageTicket, 40),
    rentTolerance: normalizeText(input.rentTolerance, 120),
    coverageRadiusMeters: radius,
    preferredAreaType:
      input.preferredAreaType === "mall" ||
      input.preferredAreaType === "residential" ||
      input.preferredAreaType === "office"
        ? input.preferredAreaType
        : "office",
    targetAddress: normalizeText(input.targetAddress, 160),
    notes: normalizeText(input.notes, 400)
  };
}

function normalizeProjectId(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
}

function validateNormalizedInput(input: CreateProjectInput) {
  if (!input.projectName || !input.cuisineFocus || !input.targetAddress) {
    return "请至少填写项目名称、细分品类和目标地点。";
  }

  if (input.coverageRadiusMeters < 300 || input.coverageRadiusMeters > 5000) {
    return "分析半径必须在 300 到 5000 米之间。";
  }

  return null;
}

export async function POST(request: NextRequest) {
  let reservedUserCredit:
    | {
        userId: string;
        tier: "basic" | "premium";
      }
    | undefined;
  let reservedGuestTrialIp: string | null = null;

  try {
    const session = await getServerSession();
    if (session?.isDisabled) {
      return NextResponse.json({ error: "当前账号已被禁用，请联系管理员。" }, { status: 403 });
    }

    const requestIp = await getRequestIp();
    const userAgent = await getRequestUserAgent();

    const payload = (await request.json()) as {
      input?: CreateProjectInput;
      runOptions?: RunAnalysisInput;
    };

    if (!payload.input || !payload.runOptions) {
      return NextResponse.json({ error: "缺少分析参数" }, { status: 400 });
    }

    const normalizedInput = normalizeInput(payload.input);
    const normalizedProjectId = normalizeProjectId(payload.runOptions.projectId);
    const inputError = validateNormalizedInput(normalizedInput);
    if (inputError) {
      return NextResponse.json({ error: inputError }, { status: 400 });
    }
    if (!normalizedProjectId) {
      return NextResponse.json({ error: "项目标识无效。" }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (session?.id) {
      const projectRecord: ProjectRecord = {
        id: normalizedProjectId,
        createdAt: now,
        updatedAt: now,
        ownerEmail: session.email,
        ownerId: session.id,
        input: normalizedInput
      };

      await persistProject(projectRecord);
    }

    let quotaSource: AnalysisEventLog["creditSource"] = "guest_trial";
    if (session?.id) {
      const access = await consumeUserAnalysisCredit(session.id, "basic");
      if (!access.allowed) {
        return NextResponse.json(
          { error: access.reason ?? "当前分析额度已用完，请升级套餐后继续。" },
          { status: 402 }
        );
      }

      reservedUserCredit = { userId: session.id, tier: "basic" };
      quotaSource = access.source;
    } else {
      const guestAccess = await claimGuestTrial(requestIp, userAgent);
      if (!guestAccess.allowed) {
        return NextResponse.json(
          { error: guestAccess.reason ?? "同一个 IP 只能试用 1 次，请注册后继续使用。" },
          { status: 429 }
        );
      }

      reservedGuestTrialIp = requestIp ?? "unknown";
    }

    const analysis = await runSiteAnalysis(normalizedInput, {
      ...payload.runOptions,
      projectId: normalizedProjectId,
      radiusMeters: normalizedInput.coverageRadiusMeters
    });

    if (session?.id) {
      await persistSiteAnalysis({
        id: `${normalizedProjectId}-latest`,
        projectId: normalizedProjectId,
        status: "complete",
        createdAt: now,
        lastCompletedStage: "summarize",
        summary: `已完成分析，数据来源 ${analysis.provider}`,
        result: analysis.result,
        costEstimate: analysis.costEstimate
      } satisfies SiteAnalysis);
    }
      await logAnalysisEvent({
      id: crypto.randomUUID(),
      actorKey: session?.id ?? `guest:${buildGuestTrialKey(requestIp)}`,
      actorType: session ? "user" : "guest",
      projectId: normalizedProjectId,
      createdAt: new Date().toISOString(),
      address: normalizedInput.targetAddress,
      businessType: normalizedInput.businessType,
      cuisineFocus: normalizedInput.cuisineFocus,
      provider: analysis.provider,
      status: "success",
      estimatedUsd: analysis.costEstimate.estimatedUsd,
      analysisTier: "basic",
      creditSource: session ? quotaSource : "guest_trial"
    } satisfies AnalysisEventLog);

    return NextResponse.json({
      provider: analysis.provider,
      result: analysis.result,
      costEstimate: analysis.costEstimate
    });
  } catch (error) {
    if (reservedUserCredit) {
      try {
        await refundUserAnalysisCredit(reservedUserCredit.userId, reservedUserCredit.tier);
      } catch {}
    }

    if (reservedGuestTrialIp) {
      try {
        await releaseGuestTrial(reservedGuestTrialIp);
      } catch {}
    }

    const message = getErrorMessage(error);
    try {
      const session = await getServerSession();
      const requestIp = await getRequestIp();
      await logAnalysisEvent({
        id: crypto.randomUUID(),
        actorKey: session?.id ?? `guest:${buildGuestTrialKey(requestIp)}`,
        actorType: session ? "user" : "guest",
        projectId: "failed-analysis",
        createdAt: new Date().toISOString(),
        address: "unknown",
        businessType: "unknown",
        cuisineFocus: "unknown",
        provider: "unknown",
        status: "failed",
        estimatedUsd: 0,
        analysisTier: "basic",
        creditSource:
          session?.planId === "free"
            ? "free_basic"
            : session
              ? "plan_basic"
              : "guest_trial",
        failureReason: message
      });
    } catch {}

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
