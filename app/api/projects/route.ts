import { NextResponse } from "next/server";

import { fetchProjectsForOwner } from "@/lib/repository";
import { getServerSession } from "@/lib/server-auth";

export async function GET() {
  const session = await getServerSession();
  if (!session?.id) {
    return NextResponse.json({ error: "请先登录后查看项目。" }, { status: 401 });
  }
  if (session.isDisabled) {
    return NextResponse.json({ error: "当前账号已被禁用。" }, { status: 403 });
  }

  const projects = await fetchProjectsForOwner(session);
  return NextResponse.json({ projects });
}
