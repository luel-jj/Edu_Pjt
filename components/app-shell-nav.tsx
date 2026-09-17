"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(app)/actions";

const NAV_ITEMS = [
  { href: "/", label: "아침" },
  { href: "/tasks", label: "업무" },
  { href: "/tasks/new", label: "등록" },
  { href: "/close-day", label: "퇴근 전" },
  { href: "/performance", label: "실적" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShellNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 border-b">
      <span className="mr-4 pb-3 text-[15px] font-semibold">업무 기록</span>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "-mb-px border-b-2 border-transparent px-3 pb-3 pt-2 text-sm text-muted-foreground hover:text-foreground",
            isActive(pathname, item.href) && "border-primary font-medium text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
      <span className="flex-1" />
      <form action={signOut} className="pb-2">
        <Button type="submit" variant="ghost" size="sm">
          로그아웃
        </Button>
      </form>
    </nav>
  );
}
