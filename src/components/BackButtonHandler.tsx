import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * BackButtonHandler component that handles Android back button and iOS swipe gestures
 * to navigate back through React Router history instead of closing the app
 */
export const BackButtonHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasNavigatedRef = useRef<boolean>(false);

  // Track if user has navigated (not on initial page load)
  useEffect(() => {
    if (location.pathname !== '/') {
      hasNavigatedRef.current = true;
    }
  }, [location.pathname]);

  useEffect(() => {
    // Only handle back button on native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // Listen for the back button event
    const backButtonListener = App.addListener('backButton', () => {
      // If we're on the login page and haven't navigated, exit the app
      if (location.pathname === '/' && !hasNavigatedRef.current) {
        App.exitApp();
        return;
      }

      // If we're on the login page but have navigated, go back
      if (location.pathname === '/') {
        navigate(-1);
        return;
      }

      // For all other pages, navigate back
      // React Router will handle the navigation
      navigate(-1);
    });

    // Cleanup listener on unmount
    return () => {
      backButtonListener.then(listener => listener.remove());
    };
  }, [navigate, location.pathname]);

  // This component doesn't render anything
  return null;
};

