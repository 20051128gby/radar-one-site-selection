"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/app-providers";
import { cn } from "@/lib/utils";

export function SiteNav() {
  const pathname = usePathname();
  const { session, signOut } = useAuth();

  return (
    <header className="site-nav">
      <div className="container site-nav-inner">
        <Link href="/" className="brand-block">
          <div className="brand-mark">R1</div>
          <div>
            <p className="brand-title">Radar One</p>
            <p className="brand-subtitle">商圈选址助手</p>
          </div>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          <Link className={cn("nav-link", pathname === "/" && "nav-link-active")} href="/">
            首页
          </Link>
          <Link
            className={cn("nav-link", pathname.startsWith("/projects") && "nav-link-active")}
            href="/projects"
          >
            项目中心
          </Link>
          <Link
            className={cn("nav-link", pathname === "/login" && "nav-link-active")}
            href={session ? "/projects/new" : "/login"}
          >
            新建分析
          </Link>
          <Link
            className={cn("nav-link", pathname.startsWith("/admin") && "nav-link-active")}
            href="/admin"
          >
            后台
          </Link>
          <Link
            className={cn("nav-link", pathname.startsWith("/billing") && "nav-link-active")}
            href="/billing"
          >
            付费
          </Link>
          <Link
            className={cn("nav-link", pathname.startsWith("/account") && "nav-link-active")}
            href="/account"
          >
            账户
          </Link>
          {session ? (
            <button className="ghost-button" onClick={signOut} type="button">
              退出 {session.displayName}
            </button>
          ) : (
            <Link className="primary-button" href="/login">
              登录开始
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
