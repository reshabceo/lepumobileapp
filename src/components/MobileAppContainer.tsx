import React from 'react';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '../hooks/use-mobile';
import { AppNavigation } from './AppNavigation';

interface MobileAppContainerProps {
  children: React.ReactNode;
}

export const MobileAppContainer: React.FC<MobileAppContainerProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const location = useLocation();

  // Primary navigation hub paths
  const showNavPaths = ["/dashboard", "/services", "/ai-doctor", "/profile"];
  const showNav = showNavPaths.some(p => location.pathname === p || location.pathname === `${p}/`);

  if (isMobile) {
    return (
      <div className={`min-h-screen bg-[#080D1A] relative flex flex-col ${showNav ? 'pb-[76px]' : ''}`}>
        <div className="flex-1 w-full overflow-y-auto">
          {children}
        </div>
        {showNav && <AppNavigation className="fixed bottom-0 left-0 right-0 w-full" />}
      </div>
    );
  }

  // On desktop, show mobile device frame
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-8">
      <div className="relative">
        {/* Device Frame */}
        <div className="relative bg-black rounded-[3rem] p-2 shadow-2xl">
          {/* Screen */}
          <div className="bg-[#080D1A] rounded-[2.5rem] overflow-hidden relative">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-black rounded-b-xl z-10"></div>
            
            {/* Content Container */}
            <div className={`w-[375px] h-[812px] overflow-y-auto scrollbar-hide ${showNav ? 'pb-[76px]' : ''}`}>
              {children}
            </div>

            {showNav && <AppNavigation className="absolute bottom-0 left-0 right-0 w-full" />}
          </div>
        </div>
        
        {/* Device Label */}
        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-center">
          <p className="text-gray-400 text-sm font-medium">Health Monitor Mobile App</p>
          <p className="text-gray-500 text-xs mt-1">Desktop Preview</p>
        </div>
      </div>
    </div>
  );
};
