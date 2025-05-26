import { useState } from "react";
import { Link, useLocation } from "wouter";

export function MobileHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [location] = useLocation();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const navItems = [
    { href: "/", icon: "ri-dashboard-line", label: "대시보드" },
    { href: "/record", icon: "ri-mic-line", label: "회의 녹음" },
    { href: "/meetings", icon: "ri-file-list-3-line", label: "모든 회의" },
    { href: "/templates", icon: "ri-file-text-line", label: "이메일 템플릿" },
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
                  <Link 
                    href={item.href}
                    className={`flex items-center py-3 text-neutral-600 ${
                      (location === item.href || 
                      (item.href !== "/" && location.startsWith(item.href))) ? 
                      "text-primary font-medium" : ""
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <i className={`${item.icon} mr-3`}></i>
                    <span>{item.label}</span>
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
