import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { db, supabase } from '@/lib/supabase';
import { ProgressIndicator } from './ProgressIndicator';
import { SignupStep1 } from './SignupStep1';
import { SignupStep2 } from './SignupStep2';
import { SignupStep3 } from './SignupStep3';
import { OTPVerification } from './OTPVerification';

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
  onSignupSuccess?: (email: string) => void; // Made optional since we'll handle internally
}

export const SignupWizard: React.FC<SignupWizardProps> = ({ onSwitchToLogin, onSignupSuccess }) => {
  // Restore currentStep from localStorage if in signup flow, otherwise default to 1
  const getInitialStep = () => {
    const awaitingOTP = localStorage.getItem('awaiting_otp_verification') === 'true';
    const savedStep = localStorage.getItem('signup_current_step');
    if (awaitingOTP && savedStep) {
      const step = parseInt(savedStep, 10);
      if (step >= 1 && step <= 4) {
        console.log('🔄 Restoring signup step from localStorage:', step);
        return step;
      }
    }
    return 1;
  };
  
  const [currentStep, setCurrentStep] = useState(getInitialStep);
  const [loading, setLoading] = useState(false);
  const signupInProgressRef = React.useRef(false);
  
  // Persist currentStep to localStorage whenever it changes
  React.useEffect(() => {
    const awaitingOTP = localStorage.getItem('awaiting_otp_verification') === 'true';
    if (awaitingOTP) {
      localStorage.setItem('signup_current_step', currentStep.toString());
      console.log('💾 Saved currentStep to localStorage:', currentStep);
    }
  }, [currentStep]);
  
  // Restore signup email from localStorage if awaiting OTP
  const getInitialFormData = (): SignupData => {
    const awaitingOTP = localStorage.getItem('awaiting_otp_verification') === 'true';
    const savedEmail = localStorage.getItem('signup_email');
    
    if (awaitingOTP && savedEmail) {
      console.log('🔄 Restoring signup email from localStorage:', savedEmail);
      return {
        name: '',
        email: savedEmail,
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
      };
    }
    
    return {
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
    };
  };
  
  const [formData, setFormData] = useState<SignupData>(getInitialFormData());

  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { toast } = useToast();
  const { signup } = useAuth();

  const steps = ['Basic Info', 'Personal Details', 'Medical Info', 'Verify Email'];
  
  // Sync email from localStorage when on step 4 (OTP verification)
  React.useEffect(() => {
    if (currentStep === 4) {
      const savedEmail = localStorage.getItem('signup_email');
      if (savedEmail && !formData.email) {
        console.log('🔄 Syncing email from localStorage to formData:', savedEmail);
        setFormData(prev => ({ ...prev, email: savedEmail }));
      }
    }
  }, [currentStep]); // Only depend on currentStep to avoid infinite loops

  const validateDoctorCode = async (doctorCode: string): Promise<boolean> => {
    try {
      // Normalize doctor code - trim whitespace and convert to uppercase
      const normalizedCode = doctorCode.trim().toUpperCase();
      console.log('🔍 Validating doctor code:', normalizedCode);

      // Query doctors table - use ilike for case-insensitive search
      const { data: doctors, error } = await supabase
        .from('doctors')
        .select('id, full_name, doctor_code')
        .ilike('doctor_code', normalizedCode);

      if (error) {
        console.error('❌ Doctor validation error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        return false;
      }

      console.log('🔍 Query returned doctors:', doctors);

      if (!doctors || doctors.length === 0) {
        console.error('❌ Doctor not found for code:', normalizedCode);
        return false;
      }

      const doctor = doctors[0];
      console.log('✅ Doctor code validated:', doctor.full_name, '(ID:', doctor.id, ')');
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
      setCurrentStep(prev => Math.min(prev + 1, 4));
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
      const normalizedDoctorCode = formData.doctorCode.trim().toUpperCase();
      const isDoctorValid = await validateDoctorCode(normalizedDoctorCode);

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
        setCurrentStep(1); // Go back to step 1 to fix doctor code
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
      
      // CRITICAL: Set flag and ref BEFORE signup to prevent AuthContext from auto-logging in
      // This must happen synchronously before any async operations
      signupInProgressRef.current = true;
      localStorage.setItem('awaiting_otp_verification', 'true');
      localStorage.setItem('signup_email', formData.email); // Save email NOW, before signup
      console.log('✅ awaiting_otp_verification flag set to true, signupInProgressRef set to true, email saved:', formData.email);
      
      const success = await signup(formData.email, formData.password, formData.name, normalizedDoctorCode, additionalData);

      console.log('🔍 Signup result:', success);

      if (success) {
        console.log('✅ Signup success! Moving to OTP verification step...');
        
        // CRITICAL: Ensure flag and ref are still set
        signupInProgressRef.current = true;
        localStorage.setItem('awaiting_otp_verification', 'true');
        console.log('✅ Flags confirmed - awaiting_otp_verification: true, signupInProgressRef: true');
        
        // Move to step 4 immediately (synchronously if possible)
        setLoading(false);
        setCurrentStep(4);
        localStorage.setItem('signup_current_step', '4');
        localStorage.setItem('signup_email', formData.email); // Save email for OTP verification
        console.log('✅ State updated - currentStep is now 4, email saved to localStorage');
        
        // Show toast after a brief delay
        setTimeout(() => {
          toast({
            title: "Verification Code Sent!",
            description: "Please check your email for the 6-digit verification code.",
          });
        }, 100);
        
        return;
      } else {
        console.log('❌ Signup failed - success was false');
        // Clear flag on failure
        localStorage.removeItem('awaiting_otp_verification');
        toast({
          title: "Signup Failed",
          description: "Unable to create account. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
      }
    } catch (error) {
      console.error('Signup error:', error);
      
      // Clear flag on error
      localStorage.removeItem('awaiting_otp_verification');
      
      let errorMessage = 'An error occurred during signup';

      if (error instanceof Error) {
        // Check for specific doctor code error
        if (error.message.includes('doctor code')) {
          errorMessage = 'Invalid doctor code. Please verify with your healthcare provider.';
          setCurrentStep(1); // Go back to step 1
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // OTP Verification handler - ONLY confirm email, don't create profile yet
  const handleOTPVerified = async () => {
    try {
      console.log('✅ OTP verified - email confirmed!');

      toast({
        title: "Email Verified!",
        description: "Your email has been confirmed. Please login to continue.",
      });
      
      // Clean up signup state
      signupInProgressRef.current = false;
      localStorage.removeItem('awaiting_otp_verification');
      localStorage.removeItem('signup_current_step');
      localStorage.removeItem('signup_email');
      localStorage.removeItem('pending_doctor_code');
      localStorage.removeItem('pending_user_name');
      localStorage.removeItem('pending_patient_data');
      localStorage.removeItem('from_otp_verification');
      
      console.log('✅ OTP verification complete - redirecting to login...');
      
      // Reset form and go back to login
      setTimeout(() => {
        onSwitchToLogin();
      }, 1500);
    } catch (error) {
      console.error('❌ Error after OTP verification:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'An error occurred after verification',
        variant: "destructive",
      });
    }
  };

  const renderStep = () => {
    console.log('🎨 SignupWizard renderStep - currentStep:', currentStep);
    
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
      case 4:
        console.log('🎨 Rendering OTP Verification step (Step 4)');
        return (
          <div className="space-y-6">
            <OTPVerification
              email={formData.email}
              type="signup"
              onVerified={handleOTPVerified}
              onBack={() => setCurrentStep(3)}
              embedded={true}
            />
          </div>
        );
      default:
        return null;
    }
  };

  // Prevent component reset during signup flow - restore step if needed
  React.useEffect(() => {
    const awaitingOTP = localStorage.getItem('awaiting_otp_verification') === 'true';
    const savedStep = localStorage.getItem('signup_current_step');
    
    if (awaitingOTP) {
      if (savedStep) {
        const step = parseInt(savedStep, 10);
        if (step >= 1 && step <= 4 && step !== currentStep) {
          console.log('⚠️ Step mismatch detected - restoring from localStorage:', step, 'current:', currentStep);
          setCurrentStep(step);
        }
      } else if (signupInProgressRef.current && currentStep !== 4) {
        console.log('⚠️ awaiting_otp_verification flag is set but currentStep is not 4 - fixing...');
        setCurrentStep(4);
        localStorage.setItem('signup_current_step', '4');
      }
    }
  }, [currentStep]);
  
  // Cleanup ref when component unmounts (only if not in signup flow)
  React.useEffect(() => {
    return () => {
      const awaitingOTP = localStorage.getItem('awaiting_otp_verification') === 'true';
      if (!awaitingOTP) {
        signupInProgressRef.current = false;
        localStorage.removeItem('signup_current_step');
        localStorage.removeItem('signup_email');
      }
    };
  }, []);
  
  // Debug: Log whenever component renders
  React.useEffect(() => {
    console.log('🔄 SignupWizard mounted/updated - currentStep:', currentStep, 'awaitingOTP:', localStorage.getItem('awaiting_otp_verification'));
  });

  console.log('🎨 SignupWizard RENDER - currentStep:', currentStep, 'loading:', loading, 'awaitingOTP:', localStorage.getItem('awaiting_otp_verification'));

  return (
    <div className="w-full max-w-2xl mx-auto">

      {/* Progress Indicator */}
      <ProgressIndicator
        currentStep={currentStep}
        totalSteps={4}
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
          disabled={currentStep === 1 || currentStep === 4}
          className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
            currentStep === 1 || currentStep === 4
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
        ) : currentStep === 3 ? (
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
              'Send Verification Code'
            )}
          </button>
        ) : (
          <div className="w-16"></div> // Spacer for step 4 (OTP auto-verifies)
        )}
      </div>
    </div>
  );
};
