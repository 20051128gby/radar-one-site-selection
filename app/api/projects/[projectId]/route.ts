import { NextRequest, NextResponse } from "next/server";

import { fetchProjectById } from "@/lib/repository";
import { getServerSession } from "@/lib/server-auth";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const session = await getServerSession();
  if (!session?.id) {
    return NextResponse.json({ error: "请先登录后查看项目详情。" }, { status: 401 });
  }
  if (session.isDisabled) {
    return NextResponse.json({ error: "当前账号已被禁用。" }, { status: 403 });
  }

  const { projectId } = await context.params;
  const project = await fetchProjectById(session, projectId);

  if (!project) {
    return NextResponse.json({ error: "项目不存在或无访问权限。" }, { status: 404 });
  }

  return NextResponse.json({ project });
}
