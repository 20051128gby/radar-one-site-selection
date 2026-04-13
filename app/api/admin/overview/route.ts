import { NextResponse } from "next/server";

import { fetchAdminOverview } from "@/lib/repository";
import { getServerSession } from "@/lib/server-auth";

export async function GET() {
  const session = await getServerSession();
  if (!session || session.role !== "admin" || session.isDisabled) {
    return NextResponse.json({ error: "需要管理员权限。" }, { status: 403 });
  }

  const overview = await fetchAdminOverview();
  return NextResponse.json({ overview });
}
