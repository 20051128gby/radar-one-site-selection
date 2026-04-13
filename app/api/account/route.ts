import { NextResponse } from "next/server";

import { fetchAccountOverview } from "@/lib/repository";
import { getServerSession } from "@/lib/server-auth";

export async function GET() {
  const session = await getServerSession();
  if (!session?.id) {
    return NextResponse.json({ error: "请先登录后查看账户。" }, { status: 401 });
  }

  if (session.isDisabled) {
    return NextResponse.json({ error: "当前账号已被禁用。" }, { status: 403 });
  }

  const overview = await fetchAccountOverview(session);
  return NextResponse.json({ overview });
}
