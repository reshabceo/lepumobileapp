import React from 'react';
import { Activity, AlertTriangle, Pill, User, Phone } from 'lucide-react';

type PatientCategory = 'REMOTE' | 'OPD' | 'IPD' | 'ICU';

interface SignupStep3Props {
  formData: {
    medicalConditions: string;
    allergies: string;
    currentMedications: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactName2: string;
    emergencyContactPhone2: string;
    category: PatientCategory;
  };
  errors: Record<string, string>;
  updateFormData: (data: Partial<{
    medicalConditions: string;
    allergies: string;
    currentMedications: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactName2: string;
    emergencyContactPhone2: string;
    category: PatientCategory;
  }>) => void;
}

const CATEGORY_OPTIONS: { value: PatientCategory; label: string; hint: string }[] = [
  { value: 'REMOTE', label: 'Remote', hint: 'Home monitoring only' },
  { value: 'OPD',    label: 'OPD',    hint: 'Outpatient (clinic visits)' },
  { value: 'IPD',    label: 'IPD',    hint: 'Inpatient (admitted)' },
  { value: 'ICU',    label: 'ICU',    hint: 'Intensive care' },
];

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

      {/* Category picker */}
      <div>
        <label className="block text-sm text-white/75 mb-2">What kind of patient are you?</label>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORY_OPTIONS.map((opt) => {
            const active = formData.category === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => updateFormData({ category: opt.value })}
                className={`text-left rounded-2xl border p-3 transition-colors ${
                  active
                    ? 'border-blue-400/60 bg-blue-500/15 text-white'
                    : 'border-white/15 bg-black/30 text-gray-300 hover:bg-white/5'
                }`}
                aria-pressed={active}
              >
                <p className="text-sm font-semibold">{opt.label}</p>
                <p className="text-[11px] text-gray-400">{opt.hint}</p>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Your doctor can change this later, but you can't.</p>
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

      {/* Second Emergency Contact */}
      <div className="border-t border-white/10 pt-4">
        <h4 className="text-sm font-medium text-white mb-3 text-center">Second Emergency Contact</h4>

        <div className="relative group mb-3">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <User className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={18} />
          </div>
          <input
            type="text"
            name="emergencyContactName2"
            value={formData.emergencyContactName2}
            onChange={(e) => updateFormData({ emergencyContactName2: e.target.value })}
            placeholder="Second Emergency Contact Name"
            className={`w-full pl-12 pr-4 py-3 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
              errors.emergencyContactName2 ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
            }`}
            aria-label="Second Emergency Contact Name"
            required
          />
          {errors.emergencyContactName2 && (
            <p className="text-red-300 text-xs mt-1 ml-1">{errors.emergencyContactName2}</p>
          )}
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Phone className="text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" size={18} />
          </div>
          <input
            type="tel"
            name="emergencyContactPhone2"
            value={formData.emergencyContactPhone2}
            onChange={(e) => updateFormData({ emergencyContactPhone2: e.target.value })}
            placeholder="Second Emergency Contact Phone"
            className={`w-full pl-12 pr-4 py-3 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 ${
              errors.emergencyContactPhone2 ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
            }`}
            aria-label="Second Emergency Contact Phone"
            required
          />
          {errors.emergencyContactPhone2 && (
            <p className="text-red-300 text-xs mt-1 ml-1">{errors.emergencyContactPhone2}</p>
          )}
        </div>
      </div>
    </div>
  );
};
