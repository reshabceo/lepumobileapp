import React from 'react';
import { Activity, AlertTriangle, Pill, User, Phone } from 'lucide-react';

interface SignupStep3Props {
  formData: {
    medicalConditions: string;
    allergies: string;
    currentMedications: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  };
  errors: Record<string, string>;
  updateFormData: (data: Partial<{
    medicalConditions: string;
    allergies: string;
    currentMedications: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  }>) => void;
}

export const SignupStep3: React.FC<SignupStep3Props> = ({
  formData,
  errors,
  updateFormData,
}) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">Medical & Emergency</h3>
        <p className="text-gray-400 text-xs">Help us provide better care</p>
      </div>

      {/* Medical Conditions */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Activity className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
        </div>
        <textarea
          name="medicalConditions"
          value={formData.medicalConditions}
          onChange={(e) => updateFormData({ medicalConditions: e.target.value })}
          placeholder="Any medical conditions or chronic illnesses? (e.g., diabetes, hypertension, asthma)"
          rows={2}
          className={`w-full pl-12 pr-4 py-3 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 resize-none ${
            errors.medicalConditions ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
          }`}
          aria-label="Medical Conditions"
          required
        />
        {errors.medicalConditions && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.medicalConditions}</p>
        )}
      </div>

      {/* Allergies */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <AlertTriangle className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
        </div>
        <input
          type="text"
          name="allergies"
          value={formData.allergies}
          onChange={(e) => updateFormData({ allergies: e.target.value })}
          placeholder="Any allergies? (e.g., food, medication, environmental)"
          className={`w-full pl-12 pr-4 py-3 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
            errors.allergies ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
          }`}
          aria-label="Allergies"
        />
        {errors.allergies && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.allergies}</p>
        )}
      </div>

      {/* Current Medications */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Pill className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
        </div>
        <input
          type="text"
          name="currentMedications"
          value={formData.currentMedications}
          onChange={(e) => updateFormData({ currentMedications: e.target.value })}
          placeholder="Current medications you're taking (including dosage if known)"
          className={`w-full pl-12 pr-4 py-3 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
            errors.currentMedications ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
          }`}
          aria-label="Current Medications"
        />
        {errors.currentMedications && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.currentMedications}</p>
        )}
      </div>

      {/* Emergency Contact Section */}
      <div className="bg-black/20 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
        <h4 className="text-sm font-medium text-white mb-3 text-center">Emergency Contact</h4>
        
        {/* Emergency Contact Name */}
        <div className="relative group mb-3">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <User className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={18} />
          </div>
          <input
            type="text"
            name="emergencyContactName"
            value={formData.emergencyContactName}
            onChange={(e) => updateFormData({ emergencyContactName: e.target.value })}
            placeholder="Emergency Contact Name"
            className={`w-full pl-12 pr-4 py-3 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
              errors.emergencyContactName ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
            }`}
            aria-label="Emergency Contact Name"
            required
          />
          {errors.emergencyContactName && (
            <p className="text-red-300 text-xs mt-1 ml-1">{errors.emergencyContactName}</p>
          )}
        </div>

        {/* Emergency Contact Phone */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Phone className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={18} />
          </div>
          <input
            type="tel"
            name="emergencyContactPhone"
            value={formData.emergencyContactPhone}
            onChange={(e) => updateFormData({ emergencyContactPhone: e.target.value })}
            placeholder="Emergency Contact Phone"
            className={`w-full pl-12 pr-4 py-3 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
              errors.emergencyContactPhone ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
            }`}
            aria-label="Emergency Contact Phone"
            required
          />
          {errors.emergencyContactPhone && (
            <p className="text-red-300 text-xs mt-1 ml-1">{errors.emergencyContactPhone}</p>
          )}
        </div>
      </div>
    </div>
  );
};
