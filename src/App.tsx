import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { DeviceProvider } from "./contexts/DeviceContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RequiresPaid } from "./components/RequiresPaid";
import { SubscriptionGraceBanner } from "./components/SubscriptionGraceBanner";

// ── Eager: shell + always-mounted globals (needed on first paint) ──────────
import { LoginPage } from "./components/LoginPage";
import { GlobalVideoCallNotification } from "./components/GlobalVideoCallNotification";
import { PatientIncomingCallOverlay } from "./components/PatientIncomingCallOverlay";
import { ChatSupport } from "./components/ChatSupport";
import { BackButtonHandler } from "./components/BackButtonHandler";

// ── Lazy: every routed page loads its own small chunk on navigation ─────────
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Chat = lazy(() => import("./pages/Chat"));
const ViewReports = lazy(() => import("./pages/ViewReports"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AddReports = lazy(() => import("./pages/AddReports"));
const DeviceList = lazy(() => import("./pages/DeviceList"));
const PatientList = lazy(() => import("./pages/PatientList"));
const PatientDevices = lazy(() => import("./pages/PatientDevices"));
const PatientMonitor = lazy(() => import("./pages/PatientMonitor"));
const LiveBPMonitorRevamped = lazy(() => import("./components/LiveBPMonitorRevamped").then(m => ({ default: m.LiveBPMonitorRevamped })));
const LiveBPMonitor = lazy(() => import("./pages/LiveBPMonitor"));
const WellueDeviceScanner = lazy(() => import("./pages/WellueDeviceScanner"));
const BPReadingsHistory = lazy(() => import("./pages/BPReadingsHistory"));
const ECGMonitor = lazy(() => import("./pages/ECGMonitor"));
const CGMMonitor = lazy(() => import("./pages/CGMMonitor"));
const BPResultScreen = lazy(() => import("./pages/BPResult"));
const DoctorAssignmentPage = lazy(() => import("./pages/DoctorAssignmentPage").then(m => ({ default: m.DoctorAssignmentPage })));
const PatientReportsView = lazy(() => import("./components/PatientReportsView"));
const ResetPasswordPage = lazy(() => import("./components/ResetPasswordPage").then(m => ({ default: m.ResetPasswordPage })));
const EcgDemo = lazy(() => import("./pages/EcgDemo"));
const VideoCallPage = lazy(() => import("./pages/VideoCall"));
const WaitingForDoctor = lazy(() => import("./pages/WaitingForDoctor"));
const AppointmentBookingPage = lazy(() => import("./pages/AppointmentBookingPage").then(m => ({ default: m.AppointmentBookingPage })));
const AIDoctorPage = lazy(() => import("./pages/AIDoctorPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const PatientInsuranceClaims = lazy(() => import("./components/PatientInsuranceClaims"));
const PatientInsuranceProfile = lazy(() => import("./components/PatientInsuranceProfile").then(m => ({ default: m.PatientInsuranceProfile })));
const ManualVitalInput = lazy(() => import("./components/ManualVitalInput").then(m => ({ default: m.ManualVitalInput })));
const PatientPrescriptions = lazy(() => import("./components/PatientPrescriptions").then(m => ({ default: m.PatientPrescriptions })));
const PatientVitalsHistory = lazy(() => import("./components/PatientVitalsHistory").then(m => ({ default: m.PatientVitalsHistory })));
const Profile = lazy(() => import("./pages/Profile"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const Support = lazy(() => import("./pages/Support"));
const MedicalDisclaimer = lazy(() => import("./pages/MedicalDisclaimer"));
const RadiologistAuth = lazy(() => import("./pages/RadiologistAuth"));
const RadiologistDashboard = lazy(() => import("./pages/RadiologistDashboard"));
const KardiaSixLeadECG = lazy(() => import("./pages/KardiaSixLeadECG"));
const RecommendationsDashboard = lazy(() => import("./pages/RecommendationsDashboard"));
const PatientMessages = lazy(() => import("./pages/PatientMessages"));
const AliveCorHistory = lazy(() => import("./pages/AliveCorHistory"));
const LiveMonitoringPage = lazy(() => import("./pages/LiveMonitoring"));
const ServicesRecords = lazy(() => import("./pages/ServicesRecords").then(m => ({ default: m.ServicesRecords })));
const MyThresholds = lazy(() => import("./components/MyThresholds"));
const MyCareTeam = lazy(() => import("./pages/MyCareTeam"));
const ConsentManagement = lazy(() => import("./pages/ConsentManagement").then(m => ({ default: m.ConsentManagement })));
const CareContextHistory = lazy(() => import("./pages/CareContextHistory").then(m => ({ default: m.CareContextHistory })));
const Subscription = lazy(() => import("./pages/Subscription"));

const queryClient = new QueryClient();

// Lightweight loader shown while a route chunk downloads
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

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
            {/* PatientIncomingCallOverlay MUST be mounted globally so the WebSocket
                is connected before the call arrives. Without this, the OFFER is sent
                while the patient has no socket registered on the server → USER_OFFLINE
                → call ends immediately before media can flow. */}
            <PatientIncomingCallOverlay />
            <ChatSupportOnDashboard />
            <SubscriptionGraceBanner />
            <Suspense fallback={<RouteFallback />}>
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
              <Route path="/subscription" element={
                <ProtectedRoute>
                  <Subscription />
                </ProtectedRoute>
              } />
              <Route path="/services" element={
                <ProtectedRoute>
                  <ServicesRecords />
                </ProtectedRoute>
              } />
              <Route path="/devices" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="connected devices"><DeviceList /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/wellue-scanner" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="device scanner"><WellueDeviceScanner /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/live-bp-monitor" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="live BP monitoring"><LiveBPMonitorRevamped /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/live-bp-monitor-old" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="live BP monitoring"><LiveBPMonitor /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/bp-readings" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="BP history"><BPReadingsHistory /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/bp-result" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="BP readings"><BPResultScreen /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/ecg-monitor" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="ECG monitoring"><ECGMonitor /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/kardia-6l-ecg" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="6-lead ECG"><KardiaSixLeadECG /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/alivecor-history" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="ECG history"><AliveCorHistory /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/ecg-results" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="ECG results"><EcgDemo /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/cgm-monitor" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="CGM monitoring"><CGMMonitor /></RequiresPaid>
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
                  <RequiresPaid featureLabel="doctor chat"><Chat /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="reports"><PatientReportsView /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/measurement-reports" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="measurement reports"><ViewReports /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/add-reports" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="report upload"><AddReports /></RequiresPaid>
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
              <Route path="/invoices" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="invoices"><InvoicesPage /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/insurance-claims" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="insurance claims"><PatientInsuranceClaims /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/insurance-profile" element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-background p-4">
                    <PatientInsuranceProfile />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/manual-vitals" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="manual vitals"><ManualVitalInput /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/prescriptions" element={
                <ProtectedRoute>
                  <PatientPrescriptions />
                </ProtectedRoute>
              } />
              <Route path="/vitals-history" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="vitals history"><PatientVitalsHistory /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/recommendations" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="recommendations"><RecommendationsDashboard /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/patient-messages" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="doctor messages"><PatientMessages /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              {/* /connect-camera and /pair-pi are now merged into /live-monitoring */}
              <Route path="/connect-camera" element={<Navigate to="/live-monitoring" replace />} />
              <Route path="/pair-pi" element={<Navigate to="/live-monitoring" replace />} />
              <Route path="/live-monitoring" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="live home monitoring"><LiveMonitoringPage /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/my-thresholds" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="risk thresholds"><MyThresholds /></RequiresPaid>
                </ProtectedRoute>
              } />
              <Route path="/care-team" element={
                <ProtectedRoute>
                  <RequiresPaid featureLabel="care team"><MyCareTeam /></RequiresPaid>
                </ProtectedRoute>
              } />

              <Route path="/abha/consents" element={
                <ProtectedRoute>
                  <ConsentManagement />
                </ProtectedRoute>
              } />
              <Route path="/abha/records" element={
                <ProtectedRoute>
                  <CareContextHistory />
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
            </Suspense>
          </BrowserRouter>
        </DeviceProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;