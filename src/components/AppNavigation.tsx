import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Activity,
  Users,
  BarChart3,
  MessageSquare,
  FileText,
  Plus,
  Settings
} from 'lucide-react';

const navigationItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/devices', label: 'Devices', icon: Activity },
  { path: '/patients', label: 'Patients', icon: Users },
  { path: '/reports', label: 'My Reports', icon: FileText },
  { path: '/measurement-reports', label: 'Measurements', icon: BarChart3 },
  { path: '/add-reports', label: 'Add Report', icon: Plus },
  { path: '/chat', label: 'Chat', icon: MessageSquare },
];

export const AppNavigation: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="bg-[#21262D] border-t border-gray-700 px-4 py-2">
      <div className="flex items-center justify-around">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors duration-200 ${isActive
                ? 'text-green-500 bg-green-500/10'
                : 'text-gray-400 hover:text-white hover:bg-[#30363D]'
                }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
