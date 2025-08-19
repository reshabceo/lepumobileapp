import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, Loader2, Stethoscope, Calendar, Phone, UserCheck, MapPin, Heart, Upload, Image } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface SignupFormProps {
  onSwitchToLogin: () => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    // Basic info (existing)
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    doctorCode: '',

    // New mandatory fields
    dateOfBirth: '',
    gender: '',
    bloodType: '',
    address: '',
    phoneNumber: '',
    emergencyContactName: '',
    emergencyContactPhone: '',

    // Medical conditions (mandatory)
    medicalConditions: '',

    // Optional fields
    allergies: '',
    currentMedications: '',

    // Profile picture
    // profilePicture: null as File | null // DISABLED: Profile picture upload
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signup } = useAuth();
  const { toast } = useToast();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Basic validation (existing)
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

    // New mandatory fields validation
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

    // Medical conditions validation (mandatory)
    if (!formData.medicalConditions.trim()) {
      newErrors.medicalConditions = 'Medical conditions are required';
    } else if (formData.medicalConditions.trim().length < 3) {
      newErrors.medicalConditions = 'Please provide more detail about medical conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // DISABLED: Profile picture upload functionality
  /*
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setErrors(prev => ({ ...prev, profilePicture: 'Please select a valid image file (JPG, PNG, or WebP)' }));
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, profilePicture: 'Image size must be less than 5MB' }));
        return;
      }

      setFormData(prev => ({ ...prev, profilePicture: file }));

      // Clear any previous errors
      if (errors.profilePicture) {
        setErrors(prev => ({ ...prev, profilePicture: '' }));
      }
    }
  };
  */

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
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
      // DISABLED: Profile picture upload
      const profilePictureUrl = '';
      /*
      let profilePictureUrl = '';

      // Upload profile picture if provided
      if (formData.profilePicture) {
        const fileExt = formData.profilePicture.name.split('.').pop();
        const fileName = `profile-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        console.log('🖼️ Uploading profile picture:', fileName);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('profile-pictures')
          .upload(fileName, formData.profilePicture, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('❌ Profile picture upload error:', uploadError);
          toast({
            title: "Upload Warning",
            description: "Profile picture upload failed, but signup will continue.",
            variant: "destructive",
          });
        } else {
          console.log('✅ Profile picture uploaded successfully:', uploadData);
          // Get public URL for the uploaded image
          const { data: { publicUrl } } = supabase.storage
            .from('profile-pictures')
            .getPublicUrl(fileName);
          profilePictureUrl = publicUrl;
          console.log('🔗 Profile picture URL:', profilePictureUrl);
        }
      }
      */

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
        if (error.message.includes('Doctor not found') || error.message.includes('doctor_code')) {
          errorMessage = 'Invalid doctor code. Please check with your doctor for the correct code.';
        } else if (error.message.includes('Cannot coerce the result to a single JSON object')) {
          errorMessage = 'Database connection error. Please try again.';
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

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Create Account</h2>
        <p className="text-gray-400 text-sm">Join us to monitor vital signs</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {/* Name Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <User className="text-gray-500" size={20} />
          </div>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Full Name"
            className={`w-full pl-12 pr-4 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500 ${errors.name ? 'border-red-500' : 'border-gray-700'
              }`}
            aria-label="Full Name"
            required
          />
          {errors.name && (
            <p className="text-red-400 text-xs mt-1 ml-1">{errors.name}</p>
          )}
        </div>

        {/* Email Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Mail className="text-gray-500" size={20} />
          </div>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Email Address"
            className={`w-full pl-12 pr-4 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500 ${errors.email ? 'border-red-500' : 'border-gray-700'
              }`}
            aria-label="Email Address"
            required
          />
          {errors.email && (
            <p className="text-red-400 text-xs mt-1 ml-1">{errors.email}</p>
          )}
        </div>

        {/* Doctor Code Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Stethoscope className="text-gray-500" size={20} />
          </div>
          <input
            type="text"
            name="doctorCode"
            value={formData.doctorCode}
            onChange={handleInputChange}
            placeholder="Doctor Code (e.g., DR1234)"
            className={`w-full pl-12 pr-4 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500 ${errors.doctorCode ? 'border-red-500' : 'border-gray-700'
              }`}
            aria-label="Doctor Code"
            required
          />
          {errors.doctorCode && (
            <p className="text-red-400 text-xs mt-1 ml-1">{errors.doctorCode}</p>
          )}
          <p className="text-xs text-gray-500 mt-1 ml-1">
            Enter the doctor code provided by your healthcare provider
          </p>
        </div>

        {/* Date of Birth Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Calendar className="text-gray-500" size={20} />
          </div>
          <input
            type="date"
            name="dateOfBirth"
            value={formData.dateOfBirth}
            onChange={handleInputChange}
            className={`w-full pl-12 pr-4 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500 ${errors.dateOfBirth ? 'border-red-500' : 'border-gray-700'
              }`}
            aria-label="Date of Birth"
            required
          />
          {errors.dateOfBirth && (
            <p className="text-red-400 text-xs mt-1 ml-1">{errors.dateOfBirth}</p>
          )}
        </div>

        {/* Gender and Blood Type Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <UserCheck className="text-gray-500" size={20} />
            </div>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className={`w-full pl-12 pr-4 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.gender ? 'border-red-500' : 'border-gray-700'
                }`}
              aria-label="Gender"
              required
            >
              <option value="">Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
            {errors.gender && (
              <p className="text-red-400 text-xs mt-1 ml-1">{errors.gender}</p>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Heart className="text-gray-500" size={20} />
            </div>
            <select
              name="bloodType"
              value={formData.bloodType}
              onChange={handleInputChange}
              className={`w-full pl-12 pr-4 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.bloodType ? 'border-red-500' : 'border-gray-700'
                }`}
              aria-label="Blood Type"
              required
            >
              <option value="">Blood Type</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
            {errors.bloodType && (
              <p className="text-red-400 text-xs mt-1 ml-1">{errors.bloodType}</p>
            )}
          </div>
        </div>

        {/* Phone Number Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Phone className="text-gray-500" size={20} />
          </div>
          <input
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleInputChange}
            placeholder="Phone Number"
            className={`w-full pl-12 pr-4 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500 ${errors.phoneNumber ? 'border-red-500' : 'border-gray-700'
              }`}
            aria-label="Phone Number"
            required
          />
          {errors.phoneNumber && (
            <p className="text-red-400 text-xs mt-1 ml-1">{errors.phoneNumber}</p>
          )}
        </div>

        {/* Address Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <MapPin className="text-gray-500" size={20} />
          </div>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="Home Address"
            className={`w-full pl-12 pr-4 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500 ${errors.address ? 'border-red-500' : 'border-gray-700'
              }`}
            aria-label="Address"
            required
          />
          {errors.address && (
            <p className="text-red-400 text-xs mt-1 ml-1">{errors.address}</p>
          )}
        </div>

        {/* DISABLED: Profile Picture Upload - causing RLS issues
        <div className="bg-[#1A1A1A] p-4 rounded-lg border border-gray-700">
          <h4 className="text-sm font-medium text-white mb-3">Profile Picture (Optional)</h4>

          <div className="relative">
            <input
              type="file"
              name="profilePicture"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="profilePictureInput"
            />
            <label
              htmlFor="profilePictureInput"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer hover:border-gray-500 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {formData.profilePicture ? (
                  <>
                    <Image className="w-8 h-8 mb-2 text-green-500" />
                    <p className="text-sm text-green-400">{formData.profilePicture.name}</p>
                    <p className="text-xs text-gray-500">Click to change</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-gray-400" />
                    <p className="text-sm text-gray-400">Upload profile picture</p>
                    <p className="text-xs text-gray-500">PNG, JPG, WebP up to 5MB</p>
                  </>
                )}
              </div>
            </label>
            {errors.profilePicture && (
              <p className="text-red-400 text-xs mt-1">{errors.profilePicture}</p>
            )}
          </div>
        </div>
        */}

        {/* Medical Conditions (Mandatory) */}
        <div className="bg-[#1A1A1A] p-4 rounded-lg border border-gray-700">
          <h4 className="text-sm font-medium text-white mb-3">Medical Information *</h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Current Medical Conditions *</label>
              <textarea
                name="medicalConditions"
                value={formData.medicalConditions}
                onChange={handleInputChange}
                placeholder="Please describe your current medical conditions (e.g., Hypertension, Diabetes, etc.)"
                rows={3}
                className={`w-full px-4 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500 resize-none ${errors.medicalConditions ? 'border-red-500' : 'border-gray-700'}`}
                aria-label="Medical Conditions"
                required
              />
              {errors.medicalConditions && (
                <p className="text-red-400 text-xs mt-1">{errors.medicalConditions}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Allergies (Optional)</label>
              <input
                type="text"
                name="allergies"
                value={formData.allergies}
                onChange={handleInputChange}
                placeholder="Known allergies (comma separated)"
                className="w-full px-4 py-3 bg-[#21262D] text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500"
                aria-label="Allergies"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Current Medications (Optional)</label>
              <input
                type="text"
                name="currentMedications"
                value={formData.currentMedications}
                onChange={handleInputChange}
                placeholder="Current medications (comma separated)"
                className="w-full px-4 py-3 bg-[#21262D] text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500"
                aria-label="Current Medications"
              />
            </div>
          </div>
        </div>

        {/* Emergency Contact Section */}
        <div className="bg-[#1A1A1A] p-4 rounded-lg border border-gray-700">
          <h4 className="text-sm font-medium text-white mb-3">Emergency Contact</h4>

          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="text-gray-500" size={20} />
              </div>
              <input
                type="text"
                name="emergencyContactName"
                value={formData.emergencyContactName}
                onChange={handleInputChange}
                placeholder="Emergency Contact Name"
                className={`w-full pl-12 pr-4 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500 ${errors.emergencyContactName ? 'border-red-500' : 'border-gray-700'
                  }`}
                aria-label="Emergency Contact Name"
                required
              />
              {errors.emergencyContactName && (
                <p className="text-red-400 text-xs mt-1 ml-1">{errors.emergencyContactName}</p>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Phone className="text-gray-500" size={20} />
              </div>
              <input
                type="tel"
                name="emergencyContactPhone"
                value={formData.emergencyContactPhone}
                onChange={handleInputChange}
                placeholder="Emergency Contact Phone"
                className={`w-full pl-12 pr-4 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500 ${errors.emergencyContactPhone ? 'border-red-500' : 'border-gray-700'
                  }`}
                aria-label="Emergency Contact Phone"
                required
              />
              {errors.emergencyContactPhone && (
                <p className="text-red-400 text-xs mt-1 ml-1">{errors.emergencyContactPhone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Password Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Lock className="text-gray-500" size={20} />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Password"
            className={`w-full pl-12 pr-12 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500 ${errors.password ? 'border-red-500' : 'border-gray-700'
              }`}
            aria-label="Password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          {errors.password && (
            <p className="text-red-400 text-xs mt-1 ml-1">{errors.password}</p>
          )}
        </div>

        {/* Confirm Password Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Lock className="text-gray-500" size={20} />
          </div>
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            placeholder="Confirm Password"
            className={`w-full pl-12 pr-12 py-3 bg-[#21262D] text-white border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500 ${errors.confirmPassword ? 'border-red-500' : 'border-gray-700'
              }`}
            aria-label="Confirm Password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300"
          >
            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          {errors.confirmPassword && (
            <p className="text-red-400 text-xs mt-1 ml-1">{errors.confirmPassword}</p>
          )}
        </div>

        {/* Sign Up Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#238636] text-white font-semibold py-3 rounded-lg hover:bg-[#2EA043] transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#161B22] focus:ring-green-500 mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      {/* Switch to Login */}
      <div className="text-center mt-6">
        <p className="text-sm text-gray-500">
          Already have an account?{' '}
          <button
            onClick={onSwitchToLogin}
            className="font-medium text-[#58A6FF] hover:underline focus:outline-none"
          >
            Sign in here
          </button>
        </p>
      </div>
    </div>
  );
};
