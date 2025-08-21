import React, { useState } from 'react';
import { User, Mail, Lock, UserCheck, Eye, EyeOff } from 'lucide-react';

interface SignupStep1Props {
  formData: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    doctorCode: string;
  };
  errors: Record<string, string>;
  updateFormData: (data: Partial<{
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    doctorCode: string;
  }>) => void;
}

export const SignupStep1: React.FC<SignupStep1Props> = ({
  formData,
  errors,
  updateFormData,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">Basic Information</h3>
        <p className="text-gray-400 text-sm">Let's start with your essential details</p>
      </div>

      {/* Full Name */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <User className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
        </div>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={(e) => updateFormData({ name: e.target.value })}
          placeholder="Full Name"
          className={`w-full pl-12 pr-4 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
            errors.name ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
          }`}
          aria-label="Full Name"
          required
        />
        {errors.name && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.name}</p>
        )}
      </div>

      {/* Email */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Mail className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
        </div>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={(e) => updateFormData({ email: e.target.value })}
          placeholder="Email Address"
          className={`w-full pl-12 pr-4 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
            errors.email ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
          }`}
          aria-label="Email Address"
          required
        />
        {errors.email && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.email}</p>
        )}
      </div>

      {/* Doctor Code */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <UserCheck className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
        </div>
        <input
          type="text"
          name="doctorCode"
          value={formData.doctorCode}
          onChange={(e) => updateFormData({ doctorCode: e.target.value })}
          placeholder="Doctor Code"
          className={`w-full pl-12 pr-4 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
            errors.doctorCode ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
          }`}
          aria-label="Doctor Code"
          required
        />
        {errors.doctorCode && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.doctorCode}</p>
        )}
      </div>

      {/* Password */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Lock className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
        </div>
        <input
          type={showPassword ? 'text' : 'password'}
          name="password"
          value={formData.password}
          onChange={(e) => updateFormData({ password: e.target.value })}
          placeholder="Password"
          className={`w-full pl-12 pr-12 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
            errors.password ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
          }`}
          aria-label="Password"
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-300 transition-colors duration-200"
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
        {errors.password && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.password}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Lock className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
        </div>
        <input
          type={showConfirmPassword ? 'text' : 'password'}
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={(e) => updateFormData({ confirmPassword: e.target.value })}
          placeholder="Confirm Password"
          className={`w-full pl-12 pr-12 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
            errors.confirmPassword ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
          }`}
          aria-label="Confirm Password"
          required
        />
        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-300 transition-colors duration-200"
        >
          {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
        {errors.confirmPassword && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.confirmPassword}</p>
        )}
      </div>
    </div>
  );
};
