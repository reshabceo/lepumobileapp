import React, { useState } from 'react';
import { User, LogOut, Settings, ChevronDown, Bluetooth } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export const UserProfile: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
    navigate('/');
  };

  const handleProfileClick = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="relative">
      {/* User Profile Button */}
      <button
        onClick={handleProfileClick}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-[#21262D] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-white">{user.name}</p>
          <p className="text-xs text-gray-400">{user.role}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
          isDropdownOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsDropdownOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute right-0 mt-2 w-fit max-w-96 bg-[#21262D] border border-gray-700 rounded-lg shadow-lg z-20">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 min-w-10 bg-green-600 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                  <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                </div>
              </div>
            </div>
            
            <div className="p-2">
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  // Add profile settings navigation here
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#30363D] rounded-md transition-colors duration-200"
              >
                <Settings className="w-4 h-4" />
                <span>Profile Settings</span>
              </button>
              
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate('/devices');
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#30363D] rounded-md transition-colors duration-200"
              >
                <Bluetooth className="w-4 h-4" />
                <span>Device Settings</span>
              </button>
              
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
