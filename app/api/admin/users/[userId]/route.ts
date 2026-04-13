import { NextRequest, NextResponse } from "next/server";

import { deleteManagedUser, updateUserAccess } from "@/lib/repository";
import { getServerSession } from "@/lib/server-auth";

async function requireAdmin() {
  const session = await getServerSession();
  if (!session || session.role !== "admin" || session.isDisabled) {
    return null;
  }

  return session;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理员权限。" }, { status: 403 });
  }

  const { userId } = await context.params;
  if (admin.id === userId) {
    return NextResponse.json({ error: "不能禁用当前管理员自己。" }, { status: 400 });
  }

  const payload = (await request.json()) as { disabled?: boolean };
  if (typeof payload.disabled !== "boolean") {
    return NextResponse.json({ error: "缺少 disabled 参数。" }, { status: 400 });
  }

  try {
    const profile = await updateUserAccess(userId, payload.disabled);
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新用户状态失败。" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理员权限。" }, { status: 403 });
  }

  const { userId } = await context.params;
  if (admin.id === userId) {
    return NextResponse.json({ error: "不能删除当前管理员自己。" }, { status: 400 });
  }

  try {
    await deleteManagedUser(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除用户失败。" },
      { status: 500 }
    );
  }
}
