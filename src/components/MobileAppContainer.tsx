
import React from 'react';
import { useIsMobile } from '../hooks/use-mobile';

interface MobileAppContainerProps {
  children: React.ReactNode;
}

export const MobileAppContainer: React.FC<MobileAppContainerProps> = ({ children }) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    // On actual mobile devices, use full screen
    return (
      <div className="min-h-screen bg-[#101010]">
        {children}
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
          <div className="bg-[#101010] rounded-[2.5rem] overflow-hidden relative">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-black rounded-b-xl z-10"></div>
            
            {/* Content Container */}
            <div className="w-[375px] h-[812px] overflow-y-auto scrollbar-hide">
              {children}
            </div>
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
