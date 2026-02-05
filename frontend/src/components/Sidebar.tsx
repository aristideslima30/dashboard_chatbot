"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, MessageSquare, ShoppingCart, Users, BarChart3, Settings } from "lucide-react"

const sidebarItems = [
  { icon: LayoutDashboard, label: "Visão Geral", href: "/" },
  { icon: ShoppingCart, label: "Vendas", href: "/sales" },
  { icon: Users, label: "Clientes", href: "/customers" },
  { icon: MessageSquare, label: "Conversas", href: "/chat" },
  { icon: BarChart3, label: "Relatórios", href: "/reports" },
  { icon: Settings, label: "Configurações", href: "/settings" },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <>
      <div className="flex lg:hidden w-full border-b bg-[#7c0101] text-white">
        <nav className="flex w-full overflow-x-auto px-2 py-2 gap-2 text-sm font-medium">
          {sidebarItems.map((item) => (
            <Link
              key={item.href}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 whitespace-nowrap transition-colors",
                pathname === item.href
                  ? "bg-white text-[#7c0101] shadow-sm"
                  : "bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
              )}
              href={item.href}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="hidden lg:block border-r border-white/10 bg-[#7c0101] w-64 min-h-screen">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-[60px] items-center border-b border-white/10 px-6">
            <Link className="flex items-center gap-2 font-semibold text-white" href="/">
              <span className="text-lg tracking-tight">3A Frios</span>
            </Link>
          </div>
          <div className="flex-1 overflow-auto py-2">
            <nav className="grid items-start px-4 text-sm font-medium">
              {sidebarItems.map((item) => (
                <Link
                  key={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                    pathname === item.href
                      ? "bg-white text-[#7c0101] shadow-sm ring-1 ring-white/20"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                  href={item.href}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </>
  )
}
