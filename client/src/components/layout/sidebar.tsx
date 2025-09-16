import { BarChart3, Home, Store, ChevronLeft, ChevronRight, DollarSign, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";

export default function Sidebar() {
  const [location] = useLocation();
  const [isMinimized, setIsMinimized] = useState(false);

  const menuItems = [
    {
      href: "/dashboard",
      icon: Home,
      label: "Dashboard",
    },
    {
      href: "/merchants",
      icon: Store,
      label: "Comerciantes",
    },
    {
      href: "/reports",
      icon: BarChart3,
      label: "Relatórios",
    },
    {
      href: "/merchant-access",
      icon: Users,
      label: "Acesso dos Comerciantes",
    },
  ];

  return (
    <aside 
      className={`bg-card border-r border-border h-screen sticky top-0 transition-all duration-300 ${
        isMinimized ? "w-16" : "w-64"
      }`} 
      data-testid="sidebar"
    >
      <div className="p-4">
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="w-full flex items-center justify-end mb-4 text-muted-foreground hover:text-foreground transition-colors"
          data-testid="sidebar-toggle"
        >
          {isMinimized ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="px-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center ${
                isMinimized ? "justify-center px-3" : "space-x-3 px-3"
              } py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
              data-testid={`link-${item.label.toLowerCase()}`}
              title={isMinimized ? item.label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!isMinimized && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}