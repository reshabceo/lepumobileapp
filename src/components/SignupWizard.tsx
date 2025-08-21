import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ProgressIndicator } from './ProgressIndicator';
import { SignupStep1 } from './SignupStep1';
import { SignupStep2 } from './SignupStep2';
import { SignupStep3 } from './SignupStep3';

interface SignupData {
  // Step 1: Basic Information
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  doctorCode: string;
  
  // Step 2: Personal Details
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  phoneNumber: string;
  address: string;
  
  // Step 3: Medical & Emergency
  medicalConditions: string;
  allergies: string;
  currentMedications: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

interface SignupWizardProps {
  onSwitchToLogin: () => void;
}

export const SignupWizard: React.FC<SignupWizardProps> = ({ onSwitchToLogin }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SignupData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    doctorCode: '',
    dateOfBirth: '',
    gender: '',
    bloodType: '',
    phoneNumber: '',
    address: '',
    medicalConditions: '',
    allergies: '',
    currentMedications: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signup } = useAuth();

  const steps = ['Basic Info', 'Personal Details', 'Medical Info'];

  const validateDoctorCode = async (doctorCode: string): Promise<boolean> => {
    try {
      console.log('🔍 Validating doctor code:', doctorCode);

      const { data: doctor, error } = await supabase
        .from('doctors')
        .select('id, full_name, doctor_code')
        .eq('doctor_code', doctorCode)
        .single();

      if (error || !doctor) {
        console.error('❌ Doctor validation error:', error);
        return false;
      }

      console.log('✅ Doctor code validated:', doctor.full_name);
      return true;
    } catch (err) {
      console.error('❌ Doctor validation exception:', err);
      return false;
    }
  };

  const updateFormData = (newData: Partial<SignupData>) => {
    setFormData(prev => ({ ...prev, ...newData }));
    // Clear errors for updated fields
    const newErrors = { ...errors };
    Object.keys(newData).forEach(key => {
      if (newErrors[key]) {
        delete newErrors[key];
      }
    });
    setErrors(newErrors);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.name.trim()) {
        newErrors.name = 'Full name is required';
      } else if (formData.name.trim().length < 2) {
        newErrors.name = 'Name must be at least 2 characters';
      }

      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }

      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }

      if (!formData.doctorCode.trim()) {
        newErrors.doctorCode = 'Doctor code is required';
      } else if (!/^DR\d{4}$/.test(formData.doctorCode.trim().toUpperCase())) {
        newErrors.doctorCode = 'Doctor code must be in format DR#### (e.g., DR1234)';
      }
    }

    if (step === 2) {
      if (!formData.dateOfBirth) {
        newErrors.dateOfBirth = 'Date of birth is required';
      } else {
        const birthDate = new Date(formData.dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        if (age < 0 || age > 150) {
          newErrors.dateOfBirth = 'Please enter a valid date of birth';
        }
      }

      if (!formData.gender) {
        newErrors.gender = 'Gender is required';
      }

      if (!formData.bloodType) {
        newErrors.bloodType = 'Blood type is required';
      }

      if (!formData.address.trim()) {
        newErrors.address = 'Address is required';
      } else if (formData.address.trim().length < 10) {
        newErrors.address = 'Please enter a complete address';
      }

      if (!formData.phoneNumber.trim()) {
        newErrors.phoneNumber = 'Phone number is required';
      } else if (!/^[\+]?[0-9\-\(\)\s]{10,}$/.test(formData.phoneNumber)) {
        newErrors.phoneNumber = 'Please enter a valid phone number';
      }
    }

    if (step === 3) {
      if (!formData.medicalConditions.trim()) {
        newErrors.medicalConditions = 'Medical conditions are required';
      } else if (formData.medicalConditions.trim().length < 3) {
        newErrors.medicalConditions = 'Please provide more detail about medical conditions';
      }

      if (!formData.emergencyContactName.trim()) {
        newErrors.emergencyContactName = 'Emergency contact name is required';
      } else if (formData.emergencyContactName.trim().length < 2) {
        newErrors.emergencyContactName = 'Emergency contact name must be at least 2 characters';
      }

      if (!formData.emergencyContactPhone.trim()) {
        newErrors.emergencyContactPhone = 'Emergency contact phone is required';
      } else if (!/^[\+]?[0-9\-\(\)\s]{10,}$/.test(formData.emergencyContactPhone)) {
        newErrors.emergencyContactPhone = 'Please enter a valid emergency contact phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      return;
    }

    setLoading(true);

    try {
      // FIRST: Validate doctor code before creating account
      console.log('🔍 Step 1: Validating doctor code before signup...');
      const isDoctorValid = await validateDoctorCode(formData.doctorCode);

      if (!isDoctorValid) {
        setErrors(prev => ({
          ...prev,
          doctorCode: 'Invalid doctor code. Please check with your doctor for the correct code.'
        }));
        toast({
          title: "Invalid Doctor Code",
          description: "Please verify the doctor code with your healthcare provider.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      console.log('✅ Step 1: Doctor code validated successfully');

      // DISABLED: Profile picture upload (keeping same as original)
      const profilePictureUrl = '';

      const additionalData = {
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        bloodType: formData.bloodType,
        address: formData.address,
        phoneNumber: formData.phoneNumber,
        emergencyContactName: formData.emergencyContactName,
        emergencyContactPhone: formData.emergencyContactPhone,
        allergies: formData.allergies,
        medicalConditions: formData.medicalConditions,
        currentMedications: formData.currentMedications,
        profilePictureUrl: profilePictureUrl
      };

      console.log('🔍 Step 2: Creating user account...');
      const success = await signup(formData.email, formData.password, formData.name, formData.doctorCode, additionalData);

      if (success) {
        toast({
          title: "Account Created Successfully!",
          description: "Please check your email to confirm your account, then return to login.",
        });

        // Redirect to login page after showing the message
        setTimeout(() => {
          onSwitchToLogin();
        }, 3000); // Give more time to read the email confirmation message
      }
    } catch (error) {
      console.error('Signup error:', error);
      let errorMessage = 'An error occurred during signup';

      if (error instanceof Error) {
        // Check for specific doctor code error
        if (error.message.includes('doctor code')) {
          errorMessage = 'Invalid doctor code. Please verify with your healthcare provider.';
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <SignupStep1
            formData={formData}
            errors={errors}
            updateFormData={updateFormData}
          />
        );
      case 2:
        return (
          <SignupStep2
            formData={formData}
            errors={errors}
            updateFormData={updateFormData}
          />
        );
      case 3:
        return (
          <SignupStep3
            formData={formData}
            errors={errors}
            updateFormData={updateFormData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">

      {/* Progress Indicator */}
      <ProgressIndicator
        currentStep={currentStep}
        totalSteps={3}
        steps={steps}
      />

      {/* Step Content */}
      <div className="backdrop-blur-xl bg-black/20 border border-white/20 rounded-3xl p-8 shadow-2xl shadow-black/20 mb-6">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        {/* Previous Button */}
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
            currentStep === 1
              ? 'bg-white/10 text-gray-500 cursor-not-allowed'
              : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
          }`}
        >
          <ArrowLeft className="w-3 h-3" />
          Previous
        </button>

        {/* Step Indicator */}
        <div className="text-xs text-gray-400">
          {currentStep} of {steps.length}
        </div>

        {/* Next/Submit Button */}
        {currentStep < 3 ? (
          <button
            onClick={nextStep}
            className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300"
          >
            Next
            <ArrowRight className="w-3 h-3" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-medium rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        )}
      </div>
    </div>
  );
};
