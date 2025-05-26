import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: "ri-dashboard-line", label: "Dashboard" },
    { href: "/record", icon: "ri-mic-line", label: "Record Meeting" },
    { href: "/meetings", icon: "ri-file-list-3-line", label: "All Meetings" },
    { href: "/templates", icon: "ri-file-text-line", label: "Email Templates" },
    { href: "/tags", icon: "ri-price-tag-3-line", label: "Tags" },
    { href: "/settings", icon: "ri-user-settings-line", label: "Settings" },
  ];

  return (
    <aside className={cn("w-64 bg-white border-r border-neutral-200 h-full hidden md:block", className)}>
      <div className="p-4 border-b border-neutral-200">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-white mr-2">
            <i className="ri-file-text-line text-lg"></i>
          </div>
          <h1 className="text-xl font-semibold text-neutral-800">MeetScribe</h1>
        </div>
      </div>
      
      <nav className="py-4">
        <ul>
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>
                <a className={cn(
                  "sidebar-link flex items-center px-4 py-3 text-neutral-600 hover:bg-neutral-100",
                  (location === item.href || 
                  (item.href !== "/" && location.startsWith(item.href))) && 
                  "active bg-neutral-100 border-l-3 border-primary"
                )}>
                  <i className={cn(item.icon, "mr-3 text-lg")}></i>
                  <span>{item.label}</span>
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-neutral-200">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-700 mr-2">
            <span>S</span>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-800">Sarah Chen</p>
            <p className="text-xs text-neutral-500">sarah@company.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
