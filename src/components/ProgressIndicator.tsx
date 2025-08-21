import React from 'react';
import { Check } from 'lucide-react';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  steps,
}) => {
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="w-full mb-8">
      {/* Progress Bar */}
      <div className="relative mb-6">
        {/* Background Track */}
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          {/* Progress Fill */}
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Step Dots */}
        <div className="absolute top-0 left-0 right-0 flex justify-between -mt-1">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep - 1;
            const isCurrent = index === currentStep - 1;
            const isUpcoming = index > currentStep - 1;
            
            return (
              <div key={index} className="relative">
                {/* Dot */}
                <div 
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-blue-500 scale-110' 
                      : isCurrent 
                      ? 'bg-blue-400 scale-125 shadow-lg shadow-blue-500/50' 
                      : 'bg-white/20 scale-100'
                  }`}
                >
                  {/* Check Icon for Completed Steps */}
                  {isCompleted && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>
                
                {/* Step Label */}
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                  <span 
                    className={`text-xs font-medium transition-all duration-300 ${
                      isCompleted 
                        ? 'text-blue-400' 
                        : isCurrent 
                        ? 'text-white' 
                        : 'text-gray-400'
                    }`}
                  >
                    {step}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Counter */}
      <div className="text-center">
        <span className="text-sm text-gray-400">
          Step {currentStep} of {totalSteps}
        </span>
        <div className="text-xs text-gray-500 mt-1">
          {Math.round(progress)}% Complete
        </div>
      </div>
    </div>
  );
};
