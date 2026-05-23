import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  LayoutGrid,
  Bot,
  User
} from 'lucide-react';

interface AppNavigationProps {
  className?: string;
}

const navigationItems = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/services', label: 'Services', icon: LayoutGrid },
  { path: '/ai-doctor', label: 'AI Assistant', icon: Bot },
  { path: '/profile', label: 'Profile', icon: User },
];


export const AppNavigation: React.FC<AppNavigationProps> = ({ className = "" }) => {
  const location = useLocation();

  return (
    <nav className={`bg-[#1A243D]/95 backdrop-blur-lg border-t border-slate-800/80 px-2 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] z-50 h-[76px] flex items-center justify-around ${className}`}>
      {navigationItems.map((item) => {
        const Icon = item.icon;
        // Match path exactly or check if current route starts with path (except for /dashboard)
        const isActive = item.path === '/dashboard' 
          ? location.pathname === '/dashboard' || location.pathname === '/dashboard/'
          : location.pathname.startsWith(item.path);

        return (
          <Link
            key={item.path}
            to={item.path}
            className="flex flex-col items-center justify-center flex-1 h-full relative py-2 touch-manipulation group"
            style={{ minHeight: '64px' }}
          >
            {/* Active Indicator Top Line */}
            {isActive && (
              <div className="absolute top-0 w-10 h-1 bg-emerald-500 rounded-b-xl shadow-[0_2px_10px_#10b981]" />
            )}

            <div className={`flex flex-col items-center gap-1 transition-all duration-200 ${isActive ? 'scale-105' : 'opacity-60 hover:opacity-100'}`}>
              <Icon className={`w-6 h-6 transition-colors duration-200 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className={`text-[11px] tracking-wide transition-colors duration-200 uppercase ${isActive ? 'text-emerald-400 font-extrabold' : 'text-slate-400 font-bold'}`}>
                {item.label}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
};
