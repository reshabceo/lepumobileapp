import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DeviceProvider } from "./contexts/DeviceContext";
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
import BPResultScreen from "./pages/BPResult";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DeviceProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/devices" element={<DeviceList />} />
              <Route path="/wellue-scanner" element={<WellueDeviceScanner />} />
              <Route path="/live-bp-monitor" element={<LiveBPMonitorRevamped />} />
              <Route path="/live-bp-monitor-old" element={<LiveBPMonitor />} />
              <Route path="/bp-readings" element={<BPReadingsHistory />} />
              <Route path="/bp-result" element={<BPResultScreen />} />
              <Route path="/ecg-monitor" element={<ECGMonitor />} />
              <Route path="/patients" element={<PatientList />} />
              <Route path="/patient/:patientId/devices" element={<PatientDevices />} />
              <Route path="/patient/:patientId/monitor" element={<PatientMonitor />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/reports" element={<ViewReports />} />
              <Route path="/add-reports" element={<AddReports />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </DeviceProvider>
      </TooltipProvider>
  </QueryClientProvider>
);

export default App;
