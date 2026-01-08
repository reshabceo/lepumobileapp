import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { DeviceProvider } from "./contexts/DeviceContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./components/LoginPage";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import ViewReports from "./pages/ViewReports";
import NotFound from "./pages/NotFound";
import AddReports from "./pages/AddReports";
import DeviceList from "./pages/DeviceList";
import PatientList from "./pages/PatientList";
import PatientDevices from "./pages/PatientDevices";
import PatientMonitor from "./pages/PatientMonitor";
import { LiveBPMonitorRevamped } from "./components/LiveBPMonitorRevamped";
import LiveBPMonitor from "./pages/LiveBPMonitor";
import WellueDeviceScanner from "./pages/WellueDeviceScanner";
import BPReadingsHistory from "./pages/BPReadingsHistory";
import ECGMonitor from "./pages/ECGMonitor";
import CGMMonitor from "./pages/CGMMonitor";
import BPResultScreen from "./pages/BPResult";
import { DoctorAssignmentPage } from "./pages/DoctorAssignmentPage";
import PatientReportsView from "./components/PatientReportsView";
import { ResetPasswordPage } from "./components/ResetPasswordPage";
import EcgDemo from "./pages/EcgDemo";
import VideoCallPage from "./pages/VideoCall";
import WaitingForDoctor from "./pages/WaitingForDoctor";
import { GlobalVideoCallNotification } from "./components/GlobalVideoCallNotification";
import { AppointmentBookingPage } from "./pages/AppointmentBookingPage";
import { ChatSupport } from "./components/ChatSupport";
import AIDoctorPage from "./pages/AIDoctorPage";
import PatientInsuranceClaims from "./components/PatientInsuranceClaims";
import { ManualVitalInput } from "./components/ManualVitalInput";
import { PatientPrescriptions } from "./components/PatientPrescriptions";
import { PatientVitalsHistory } from "./components/PatientVitalsHistory";
import Profile from "./pages/Profile";
import { BackButtonHandler } from "./components/BackButtonHandler";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ContactUs from "./pages/ContactUs";
import Support from "./pages/Support";
import MedicalDisclaimer from "./pages/MedicalDisclaimer";
import RadiologistAuth from "./pages/RadiologistAuth";
import RadiologistDashboard from "./pages/RadiologistDashboard";

const queryClient = new QueryClient();

const ChatSupportOnDashboard = () => {
  const location = useLocation();
  // Only show ChatSupport on the home/dashboard page
  const isDashboard = location.pathname === "/dashboard" || location.pathname === "/dashboard/";
  if (!isDashboard) return null;
  return <ChatSupport />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <DeviceProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <BackButtonHandler />
            <GlobalVideoCallNotification />
            <ChatSupportOnDashboard />
            <Routes>
              {/* Public routes */}
              <Route path="/" element={
                <ProtectedRoute requireAuth={false}>
                  <LoginPage />
                </ProtectedRoute>
              } />

              {/* Protected routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/devices" element={
                <ProtectedRoute>
                  <DeviceList />
                </ProtectedRoute>
              } />
              <Route path="/wellue-scanner" element={
                <ProtectedRoute>
                  <WellueDeviceScanner />
                </ProtectedRoute>
              } />
              <Route path="/live-bp-monitor" element={
                <ProtectedRoute>
                  <LiveBPMonitorRevamped />
                </ProtectedRoute>
              } />
              <Route path="/live-bp-monitor-old" element={
                <ProtectedRoute>
                  <LiveBPMonitor />
                </ProtectedRoute>
              } />
              <Route path="/bp-readings" element={
                <ProtectedRoute>
                  <BPReadingsHistory />
                </ProtectedRoute>
              } />
              <Route path="/bp-result" element={
                <ProtectedRoute>
                  <BPResultScreen />
                </ProtectedRoute>
              } />
              <Route path="/ecg-monitor" element={
                <ProtectedRoute>
                  <ECGMonitor />
                </ProtectedRoute>
              } />
              <Route path="/ecg-results" element={
                <ProtectedRoute>
                  <EcgDemo />
                </ProtectedRoute>
              } />
              <Route path="/cgm-monitor" element={
                <ProtectedRoute>
                  <CGMMonitor />
                </ProtectedRoute>
              } />
              <Route path="/patients" element={
                <ProtectedRoute>
                  <PatientList />
                </ProtectedRoute>
              } />
              <Route path="/patient/:patientId/devices" element={
                <ProtectedRoute>
                  <PatientDevices />
                </ProtectedRoute>
              } />
              <Route path="/patient/:patientId/monitor" element={
                <ProtectedRoute>
                  <PatientMonitor />
                </ProtectedRoute>
              } />
              <Route path="/chat" element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute>
                  <PatientReportsView />
                </ProtectedRoute>
              } />
              <Route path="/measurement-reports" element={
                <ProtectedRoute>
                  <ViewReports />
                </ProtectedRoute>
              } />
              <Route path="/add-reports" element={
                <ProtectedRoute>
                  <AddReports />
                </ProtectedRoute>
              } />
              <Route path="/doctor-assignment" element={
                <ProtectedRoute>
                  <DoctorAssignmentPage />
                </ProtectedRoute>
              } />
              <Route path="/appointments" element={
                <ProtectedRoute>
                  <AppointmentBookingPage />
                </ProtectedRoute>
              } />
              <Route path="/ai-doctor" element={
                <ProtectedRoute>
                  <AIDoctorPage />
                </ProtectedRoute>
              } />
              <Route path="/insurance-claims" element={
                <ProtectedRoute>
                  <PatientInsuranceClaims />
                </ProtectedRoute>
              } />
              <Route path="/manual-vitals" element={
                <ProtectedRoute>
                  <ManualVitalInput />
                </ProtectedRoute>
              } />
              <Route path="/prescriptions" element={
                <ProtectedRoute>
                  <PatientPrescriptions />
                </ProtectedRoute>
              } />
              <Route path="/vitals-history" element={
                <ProtectedRoute>
                  <PatientVitalsHistory />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />

              <Route path="/call/:channel" element={
                <ProtectedRoute>
                  <VideoCallPage />
                </ProtectedRoute>
              } />

              <Route path="/call/wait" element={
                <ProtectedRoute>
                  <WaitingForDoctor />
                </ProtectedRoute>
              } />

              <Route path="/reset-password" element={
                <ProtectedRoute requireAuth={false}>
                  <ResetPasswordPage />
                </ProtectedRoute>
              } />

              {/* Public informational pages */}
              <Route path="/privacy-policy" element={
                <ProtectedRoute requireAuth={false}>
                  <PrivacyPolicy />
                </ProtectedRoute>
              } />
              <Route path="/contact-us" element={
                <ProtectedRoute requireAuth={false}>
                  <ContactUs />
                </ProtectedRoute>
              } />
              <Route path="/support" element={
                <ProtectedRoute requireAuth={false}>
                  <Support />
                </ProtectedRoute>
              } />
              <Route path="/medical-disclaimer" element={
                <ProtectedRoute requireAuth={false}>
                  <MedicalDisclaimer />
                </ProtectedRoute>
              } />

              {/* Radiologist Routes */}
              <Route path="/radiologist-auth" element={
                <ProtectedRoute requireAuth={false}>
                  <RadiologistAuth />
                </ProtectedRoute>
              } />
              <Route path="/radiologist-dashboard" element={
                <ProtectedRoute>
                  <RadiologistDashboard />
                </ProtectedRoute>
              } />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </DeviceProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;