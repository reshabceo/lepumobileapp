
import React, { useState } from 'react';
import { ArrowLeft, FileText, Search, Eye, Download, User, Lock, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MobileAppContainer } from '../components/MobileAppContainer';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { useToast } from '../hooks/use-toast';

// Mock data for the reports list, with icons updated to match the design
const reports = [
  {
    icon: User,
    title: 'Complete Blood Count',
    date: 'May 24, 2025',
    doctor: 'Dr. Aisha Patel',
  },
  {
    icon: FileText,
    title: 'Chest X-Ray',
    date: 'May 20, 2025',
    doctor: 'Dr. James Wilson',
  },
  {
    icon: Lock,
    title: 'Consultation Notes',
    date: 'May 18, 2025',
    doctor: 'Dr. Sarah Chen',
  },
  {
    icon: FileText,
    title: 'Medication Prescription',
    date: 'May 15, 2025',
    doctor: 'Dr. Michael Rodriguez',
  },
  {
    icon: FileText,
    title: 'Physical Therapy Plan',
    date: 'May 10, 2025',
    doctor: 'Dr. Emily Johnson',
  },
];

// Component for a single report item
const ReportItem = ({ 
  icon: Icon, 
  title, 
  date, 
  doctor 
}: { 
  icon: any, 
  title: string, 
  date: string, 
  doctor: string 
}) => {
  const { toast } = useToast();

  const handleView = () => {
    toast({
      title: "Viewing Report",
      description: `Opening ${title}...`,
    });
    // In a real app, this would open the report in a viewer or navigate to a detail page
    console.log(`Viewing report: ${title}`);
  };

  const handleDownload = () => {
    toast({
      title: "Download Started",
      description: `Downloading ${title}...`,
    });
    // In a real app, this would trigger the actual download
    console.log(`Downloading report: ${title}`);
  };

  return (
    <div className="bg-[#30363D] p-4 rounded-lg flex items-center space-x-4">
      <div className="bg-[#3C444C] p-3 rounded-full">
        <Icon className="text-gray-300" size={20} />
      </div>
      <div className="flex-grow">
        <p className="font-semibold text-white">{title}</p>
        <p className="text-xs text-gray-400">
          {date} &bull; {doctor}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <button 
          onClick={handleView}
          className="p-2 text-gray-300 bg-[#3C444C] rounded-full hover:bg-gray-600 transition-colors"
          aria-label={`View ${title}`}
        >
          <Eye size={18} />
        </button>
        <button 
          onClick={handleDownload}
          className="p-2 text-gray-300 bg-[#3C444C] rounded-full hover:bg-gray-600 transition-colors"
          aria-label={`Download ${title}`}
        >
          <Download size={18} />
        </button>
      </div>
    </div>
  );
};

// Main View Reports Component
export default function ViewReports() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleAddReport = () => {
    navigate('/add-reports');
  };

  return (
    <MobileAppContainer>
      <div className="bg-[#161B22] min-h-screen text-white font-inter">
        <div className="max-w-sm mx-auto min-h-screen bg-[#1C2128] flex flex-col relative">
          
          {/* Status Bar Spacing */}
          <div className="h-6"></div>
          
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center">
              <button onClick={handleBack} className="text-gray-300 hover:text-white">
                <ArrowLeft size={24} />
              </button>
              <FileText size={24} className="mx-3 text-gray-400" />
              <h1 className="text-lg font-semibold text-white">View Reports</h1>
            </div>
            <button className="text-gray-300 hover:text-white">
              <Search size={22} />
            </button>
          </header>

          {/* Search Bar */}
          <div className="p-4 flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="text-gray-500" size={20} />
              </div>
              <input
                type="text"
                placeholder="Search reports"
                className="w-full pl-10 pr-4 py-2 bg-[#2D333B] text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                aria-label="Search reports"
              />
            </div>
          </div>

          {/* Reports List */}
          <main className="flex-grow p-4 pt-0 overflow-y-auto">
            <div className="space-y-3 pb-20">
              {reports.map((report, index) => (
                <ReportItem key={index} {...report} />
              ))}
            </div>
          </main>
          
          {/* Floating Action Button */}
          <button 
            onClick={handleAddReport}
            className="absolute bottom-6 right-6 bg-teal-500 text-white rounded-full p-4 shadow-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1C2128] focus:ring-teal-500"
          >
            <Plus size={24} />
          </button>

        </div>
      </div>
    </MobileAppContainer>
  );
}
