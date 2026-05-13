import React, { useEffect, useState } from 'react';
import { Calendar, User, Droplets, Phone, MapPin, Loader2 } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { ScrollDatePicker } from './ScrollDatePicker';

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
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationRequested, setLocationRequested] = useState(false);
  const [detectionTimedOut, setDetectionTimedOut] = useState(false);
  const { toast } = useToast();

  const detectLocation = async () => {
    try {
      setIsRequestingLocation(true);
      setDetectionTimedOut(false);

      // Set a safety timeout for the UI
      const timeoutId = setTimeout(() => {
        if (isRequestingLocation) {
          setDetectionTimedOut(true);
          setIsRequestingLocation(false);
          toast({
            title: "Location Detection Timeout",
            description: "Detection is taking longer than expected. Please enter your address manually.",
            variant: "default",
          });
        }
      }, 10000);

      let position: { latitude: number; longitude: number } | null = null;

      // Use Capacitor Geolocation for native apps, fallback to browser API for web
      if (Capacitor.isNativePlatform()) {
        const permissionStatus = await Geolocation.requestPermissions();
        
        if (permissionStatus.location === 'granted' || permissionStatus.location === 'prompt') {
          const location = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 8000, // Slightly less than our 10s UI timeout
          });
          position = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
        } else {
          toast({
            title: "Permission Denied",
            description: "Please enter your address manually.",
            variant: "default",
          });
          clearTimeout(timeoutId);
          setIsRequestingLocation(false);
          return;
        }
      } else {
        if (navigator.geolocation) {
          position = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
              (err) => reject(err),
              { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
          });
        }
      }

      clearTimeout(timeoutId);

      if (position) {
        try {
          const addressResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.latitude}&lon=${position.longitude}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'MonitraqApp/1.0' } }
          );
          
          if (addressResponse.ok) {
            const addressData = await addressResponse.json();
            if (addressData.display_name) {
              let formattedAddress = addressData.display_name;
              if (addressData.address) {
                const addr = addressData.address;
                const parts = [];
                if (addr.house_number && addr.road) parts.push(`${addr.house_number} ${addr.road}`);
                else if (addr.road) parts.push(addr.road);
                if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
                if (addr.state) parts.push(addr.state);
                if (addr.postcode) parts.push(addr.postcode);
                if (addr.country) parts.push(addr.country);
                if (parts.length > 0) formattedAddress = parts.join(', ');
              }
              updateFormData({ address: formattedAddress });
              toast({
                title: "Location Detected",
                description: "Address has been auto-filled.",
              });
            }
          }
        } catch (geocodeError) {
          console.warn('Reverse geocoding failed:', geocodeError);
          updateFormData({ address: `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}` });
        }
      }
    } catch (error) {
      console.warn('Location request failed:', error);
    } finally {
      setIsRequestingLocation(false);
    }
  };

  useEffect(() => {
    if (!locationRequested && !formData.address) {
      setLocationRequested(true);
      detectLocation();
    }
  }, [locationRequested, formData.address]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-white mb-1">Personal Details</h3>
        <p className="text-gray-400 text-xs sm:text-sm">Tell us more about yourself</p>
      </div>

      {/* Date of Birth */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-400 ml-1 block uppercase tracking-wider">Date of Birth</label>
        <ScrollDatePicker
          value={formData.dateOfBirth}
          onChange={(date) => updateFormData({ dateOfBirth: date })}
          error={errors.dateOfBirth}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Gender */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <User className="text-gray-400 group-focus-within:text-blue-400 transition-colors" size={18} />
          </div>
          <select
            name="gender"
            value={formData.gender}
            onChange={(e) => updateFormData({ gender: e.target.value })}
            className={`w-full pl-10 pr-3 py-3 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm ${
              errors.gender ? 'border-red-500/50' : ''
            }`}
            required
          >
            <option value="" className="bg-black">Gender</option>
            <option value="male" className="bg-black">Male</option>
            <option value="female" className="bg-black">Female</option>
            <option value="other" className="bg-black">Other</option>
          </select>
          {errors.gender && <p className="text-red-400 text-[10px] mt-1 ml-1">{errors.gender}</p>}
        </div>

        {/* Blood Type */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Droplets className="text-gray-400 group-focus-within:text-blue-400 transition-colors" size={18} />
          </div>
          <select
            name="bloodType"
            value={formData.bloodType}
            onChange={(e) => updateFormData({ bloodType: e.target.value })}
            className={`w-full pl-10 pr-3 py-3 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm ${
              errors.bloodType ? 'border-red-500/50' : ''
            }`}
            required
          >
            <option value="" className="bg-black">Blood Type</option>
            <option value="A+" className="bg-black">A+</option>
            <option value="A-" className="bg-black">A-</option>
            <option value="B+" className="bg-black">B+</option>
            <option value="B-" className="bg-black">B-</option>
            <option value="AB+" className="bg-black">AB+</option>
            <option value="AB-" className="bg-black">AB-</option>
            <option value="O+" className="bg-black">O+</option>
            <option value="O-" className="bg-black">O-</option>
          </select>
          {errors.bloodType && <p className="text-red-400 text-[10px] mt-1 ml-1">{errors.bloodType}</p>}
        </div>
      </div>

      {/* Phone Number */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Phone className="text-gray-400 group-focus-within:text-blue-400 transition-colors" size={18} />
        </div>
        <input
          type="tel"
          name="phoneNumber"
          value={formData.phoneNumber}
          onChange={(e) => updateFormData({ phoneNumber: e.target.value })}
          placeholder="Phone Number"
          className={`w-full pl-10 pr-4 py-3 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-500 transition-all text-sm ${
            errors.phoneNumber ? 'border-red-500/50' : ''
          }`}
          required
        />
        {errors.phoneNumber && <p className="text-red-400 text-[10px] mt-1 ml-1">{errors.phoneNumber}</p>}
      </div>

      {/* Address */}
      <div className="space-y-2">
        <div className="relative group">
          <div className="absolute top-4 left-3 pointer-events-none">
            <MapPin className="text-gray-400 group-focus-within:text-blue-400 transition-colors" size={18} />
          </div>
          <textarea
            name="address"
            value={formData.address}
            onChange={(e) => updateFormData({ address: e.target.value })}
            placeholder={isRequestingLocation ? "Detecting location..." : "Enter Full Address"}
            rows={2}
            className={`w-full pl-10 pr-4 py-3 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-500 transition-all text-sm resize-none ${
              errors.address ? 'border-red-500/50' : ''
            }`}
            required
          />
          {isRequestingLocation && (
            <div className="absolute right-3 top-3">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={detectLocation}
            disabled={isRequestingLocation}
            className="flex items-center gap-1.5 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
          >
            <MapPin size={12} />
            {isRequestingLocation ? "Detecting..." : "Detect Location Automatically"}
          </button>
          <span className="text-[10px] text-gray-500 italic">or enter manually</span>
        </div>
        
        {errors.address && <p className="text-red-400 text-[10px] mt-1 ml-1">{errors.address}</p>}
      </div>
    </div>
  );
};
