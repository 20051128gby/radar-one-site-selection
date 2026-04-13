"use client";

import Link from "next/link";

import { useAuth } from "@/components/app-providers";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { hydrated, session } = useAuth();

  if (!hydrated) {
    return <div className="empty-state">正在校验后台权限...</div>;
  }

  if (!session) {
    return (
      <div className="soft-panel stack">
        <div>
          <p className="eyebrow">Admin Access</p>
          <h1 className="section-title">后台需要管理员登录。</h1>
          <p className="section-copy">
            当前公开站点允许游客直接做选址分析，但后台只对管理员开放。
          </p>
        </div>
        <Link className="primary-button" href="/login">
          去登录
        </Link>
      </div>
    );
  }

  if (session.role !== "admin") {
    return (
      <div className="soft-panel stack">
        <div>
          <p className="eyebrow">Access Denied</p>
          <h1 className="section-title">你没有后台权限。</h1>
          <p className="section-copy">
            当前账号角色是 `{session.role}`。只有管理员账号可以查看用户管理、预算与成本总览。
          </p>
        </div>
        <Link className="ghost-button" href="/projects">
          返回项目中心
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
