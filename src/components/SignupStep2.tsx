import React from 'react';
import { Calendar, User, Droplets, Phone, MapPin } from 'lucide-react';

interface SignupStep2Props {
  formData: {
    dateOfBirth: string;
    gender: string;
    bloodType: string;
    phoneNumber: string;
    address: string;
  };
  errors: Record<string, string>;
  updateFormData: (data: Partial<{
    dateOfBirth: string;
    gender: string;
    bloodType: string;
    phoneNumber: string;
    address: string;
  }>) => void;
}

export const SignupStep2: React.FC<SignupStep2Props> = ({
  formData,
  errors,
  updateFormData,
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">Personal Details</h3>
        <p className="text-gray-400 text-sm">Tell us more about yourself</p>
      </div>

      {/* Date of Birth */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Calendar className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
        </div>
        <input
          type="date"
          name="dateOfBirth"
          value={formData.dateOfBirth}
          onChange={(e) => updateFormData({ dateOfBirth: e.target.value })}
          className={`w-full pl-12 pr-4 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 ${
            errors.dateOfBirth ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
          }`}
          aria-label="Date of Birth"
          required
        />
        {errors.dateOfBirth && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.dateOfBirth}</p>
        )}
      </div>

      {/* Gender */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <User className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
        </div>
        <select
          name="gender"
          value={formData.gender}
          onChange={(e) => updateFormData({ gender: e.target.value })}
          className={`w-full pl-12 pr-4 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 ${
            errors.gender ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
          }`}
          aria-label="Gender"
          required
        >
          <option value="" className="bg-black text-white">Select Gender</option>
          <option value="male" className="bg-black text-white">Male</option>
          <option value="female" className="bg-black text-white">Female</option>
          <option value="other" className="bg-black text-white">Other</option>
          <option value="prefer-not-to-say" className="bg-black text-white">Prefer not to say</option>
        </select>
        {errors.gender && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.gender}</p>
        )}
      </div>

      {/* Blood Type */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Droplets className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
        </div>
        <select
          name="bloodType"
          value={formData.bloodType}
          onChange={(e) => updateFormData({ bloodType: e.target.value })}
          className={`w-full pl-12 pr-4 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 ${
            errors.bloodType ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
          }`}
          aria-label="Blood Type"
          required
        >
          <option value="" className="bg-black text-white">Select Blood Type</option>
          <option value="A+" className="bg-black text-white">A+</option>
          <option value="A-" className="bg-black text-white">A-</option>
          <option value="B+" className="bg-black text-white">B+</option>
          <option value="B-" className="bg-black text-white">B-</option>
          <option value="AB+" className="bg-black text-white">AB+</option>
          <option value="AB-" className="bg-black text-white">AB-</option>
          <option value="O+" className="bg-black text-white">O+</option>
          <option value="O-" className="bg-black text-white">O-</option>
        </select>
        {errors.bloodType && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.bloodType}</p>
        )}
      </div>

      {/* Phone Number */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Phone className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
        </div>
        <input
          type="tel"
          name="phoneNumber"
          value={formData.phoneNumber}
          onChange={(e) => updateFormData({ phoneNumber: e.target.value })}
          placeholder="Phone Number"
          className={`w-full pl-12 pr-4 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
            errors.phoneNumber ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
          }`}
          aria-label="Phone Number"
          required
        />
        {errors.phoneNumber && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.phoneNumber}</p>
        )}
      </div>

      {/* Address */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <MapPin className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
        </div>
        <textarea
          name="address"
          value={formData.address}
          onChange={(e) => updateFormData({ address: e.target.value })}
          placeholder="Full Address"
          rows={3}
          className={`w-full pl-12 pr-4 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 resize-none ${
            errors.address ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
          }`}
          aria-label="Address"
          required
        />
        {errors.address && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.address}</p>
        )}
      </div>
    </div>
  );
};
