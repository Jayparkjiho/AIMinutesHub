import { useState } from "react";
import { Link, useLocation } from "wouter";

export function MobileHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [location] = useLocation();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const navItems = [
    { href: "/", icon: "ri-dashboard-line", label: "Dashboard" },
    { href: "/record", icon: "ri-mic-line", label: "Record Meeting" },
    { href: "/meetings", icon: "ri-file-list-3-line", label: "All Meetings" },
    { href: "/templates", icon: "ri-file-text-line", label: "Email Templates" },
    { href: "/tags", icon: "ri-price-tag-3-line", label: "Tags" },
    { href: "/settings", icon: "ri-user-settings-line", label: "Settings" },
  ];

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-neutral-200 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-white mr-2">
              <i className="ri-file-text-line text-lg"></i>
            </div>
            <h1 className="text-xl font-semibold text-neutral-800">MeetScribe</h1>
          </div>
          <button 
            className="text-neutral-600 focus:outline-none" 
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            <i className={`${isMenuOpen ? 'ri-close-line' : 'ri-menu-line'} text-2xl`}></i>
          </button>
        </div>
        
        {/* Mobile Menu */}
        {isMenuOpen && (
          <nav className="py-2 px-4 bg-white border-b border-neutral-200">
            <ul>
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>
                    <a 
                      className={`flex items-center py-3 text-neutral-600 ${
                        (location === item.href || 
                        (item.href !== "/" && location.startsWith(item.href))) ? 
                        "text-primary font-medium" : ""
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <i className={`${item.icon} mr-3`}></i>
                      <span>{item.label}</span>
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
      <div className="md:hidden h-16"></div>
    </>
  );
}
