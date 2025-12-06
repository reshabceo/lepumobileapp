import React, { useEffect, useState } from 'react';
import { Calendar, User, Droplets, Phone, MapPin, Loader2 } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

  // Request location permission and autofill address on component mount
  useEffect(() => {
    const requestLocationAndAutofill = async () => {
      // Only request once
      if (locationRequested || formData.address) {
        return;
      }

      try {
        setIsRequestingLocation(true);
        setLocationRequested(true);

        let position: { latitude: number; longitude: number } | null = null;

        // Use Capacitor Geolocation for native apps, fallback to browser API for web
        if (Capacitor.isNativePlatform()) {
          // Request permissions first
          const permissionStatus = await Geolocation.requestPermissions();
          
          if (permissionStatus.location === 'granted' || permissionStatus.location === 'prompt') {
            const location = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 10000,
            });
            position = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
          } else {
            toast({
              title: "Location Permission Denied",
              description: "You can manually enter your address.",
              variant: "default",
            });
            setIsRequestingLocation(false);
            return;
          }
        } else {
          // Browser geolocation API
          if (navigator.geolocation) {
            position = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                  });
                },
                (err) => {
                  console.warn('Geolocation error:', err);
                  reject(err);
                },
                {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 0,
                }
              );
            });
          }
        }

        if (position) {
          // Reverse geocoding to get address from coordinates using OpenStreetMap Nominatim
          try {
            const addressResponse = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.latitude}&lon=${position.longitude}&zoom=18&addressdetails=1`,
              {
                headers: {
                  'User-Agent': 'MonitraqApp/1.0', // Required by Nominatim
                },
              }
            );
            
            if (addressResponse.ok) {
              const addressData = await addressResponse.json();
              if (addressData.display_name) {
                // Format the address nicely
                let formattedAddress = addressData.display_name;
                
                // Try to create a more concise address if possible
                if (addressData.address) {
                  const addr = addressData.address;
                  const parts = [];
                  if (addr.house_number && addr.road) {
                    parts.push(`${addr.house_number} ${addr.road}`);
                  } else if (addr.road) {
                    parts.push(addr.road);
                  }
                  if (addr.city || addr.town || addr.village) {
                    parts.push(addr.city || addr.town || addr.village);
                  }
                  if (addr.state) {
                    parts.push(addr.state);
                  }
                  if (addr.postcode) {
                    parts.push(addr.postcode);
                  }
                  if (addr.country) {
                    parts.push(addr.country);
                  }
                  
                  if (parts.length > 0) {
                    formattedAddress = parts.join(', ');
                  }
                }
                
                updateFormData({ address: formattedAddress });
                toast({
                  title: "Location Detected",
                  description: "Address has been auto-filled from your location.",
                  variant: "default",
                });
              } else {
                throw new Error('No address data in response');
              }
            } else {
              throw new Error('Reverse geocoding request failed');
            }
          } catch (geocodeError) {
            console.warn('Reverse geocoding failed:', geocodeError);
            // Fallback: Use coordinates as address if reverse geocoding fails
            updateFormData({ 
              address: `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}` 
            });
            toast({
              title: "Location Detected",
              description: "Coordinates have been added. Please edit the address field with your full address.",
              variant: "default",
            });
          }
        }
      } catch (error) {
        console.warn('Location request failed:', error);
        toast({
          title: "Location Access",
          description: "Could not access location. Please enter your address manually.",
          variant: "default",
        });
      } finally {
        setIsRequestingLocation(false);
      }
    };

    requestLocationAndAutofill();
  }, [locationRequested, formData.address, updateFormData, toast]);
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
        <div className="relative">
          <textarea
            name="address"
            value={formData.address}
            onChange={(e) => updateFormData({ address: e.target.value })}
            placeholder={isRequestingLocation ? "Detecting your location..." : "Full Address"}
            rows={3}
            disabled={isRequestingLocation}
            className={`w-full pl-12 pr-20 py-4 bg-black/30 backdrop-blur-sm text-white border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all duration-300 resize-none disabled:opacity-50 disabled:cursor-not-allowed ${
              errors.address ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''
            }`}
            aria-label="Address"
            required
          />
          {isRequestingLocation && (
            <div className="absolute right-4 top-4">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            </div>
          )}
        </div>
        {errors.address && (
          <p className="text-red-300 text-xs mt-2 ml-1">{errors.address}</p>
        )}
      </div>
    </div>
  );
};
