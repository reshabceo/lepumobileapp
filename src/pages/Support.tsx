import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Book, 
  Video, 
  FileText, 
  MessageSquare,
  Phone,
  Mail,
  ExternalLink,
  Smartphone,
  Bluetooth,
  Heart,
  Activity,
  AlertCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const Support = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const faqItems: FAQItem[] = [
    // Getting Started
    {
      category: 'Getting Started',
      question: 'How do I create an account?',
      answer: 'To create an account, open the app and tap "Sign Up" on the login screen. You\'ll need to provide your email address, create a password, and verify your email through the OTP code sent to your email. Then complete your profile with personal and medical information.'
    },
    {
      category: 'Getting Started',
      question: 'What devices are compatible with the app?',
      answer: 'Monitraq supports various medical devices including Wellue BP2 blood pressure monitors, ECG devices, CGM (Continuous Glucose Monitors), and pulse oximeters. Check the Devices page in the app for a complete list of supported devices.'
    },
    {
      category: 'Getting Started',
      question: 'Is the app free to use?',
      answer: 'Monitraq offers a free tier with basic features. Premium features may require a subscription. Check the app settings or our website for current pricing information.'
    },
    
    // Device Connection
    {
      category: 'Device Connection',
      question: 'How do I connect my blood pressure monitor?',
      answer: '1. Ensure Bluetooth is enabled on your device. 2. Go to the Devices page in the app. 3. Tap "Scan for Devices" or "Add Device". 4. Select your BP monitor from the list. 5. Follow the on-screen instructions to pair. Make sure your device is in pairing mode and within range.'
    },
    {
      category: 'Device Connection',
      question: 'Why can\'t I find my device during scanning?',
      answer: 'Make sure your device is: turned on, in pairing/discovery mode, within 10 feet of your phone, and has sufficient battery. Also ensure Bluetooth permissions are granted to the app in your device settings. Try restarting the app and your device if issues persist.'
    },
    {
      category: 'Device Connection',
      question: 'How do I disconnect a device?',
      answer: 'Go to the Devices page, find the device you want to disconnect, and tap the device card. You\'ll see options to disconnect or remove the device. Disconnecting will stop automatic data collection, but your historical data will be preserved.'
    },
    
    // Measurements & Data
    {
      category: 'Measurements & Data',
      question: 'How do I take a blood pressure reading?',
      answer: '1. Connect your BP monitor to the app. 2. Go to the Live BP Monitor page. 3. Follow the on-screen instructions to start a measurement. 4. The app will guide you through the process and display your results once complete.'
    },
    {
      category: 'Measurements & Data',
      question: 'Where can I view my measurement history?',
      answer: 'You can view your measurement history by going to the BP Readings page or Measurement Reports section. The app stores all your historical data, which you can filter by date, device, or measurement type.'
    },
    {
      category: 'Measurements & Data',
      question: 'Can I manually enter health data?',
      answer: 'Yes! Go to the Manual Vitals section in the app to manually enter blood pressure, heart rate, weight, and other vital signs. This is useful if you don\'t have a connected device or want to add data from other sources.'
    },
    {
      category: 'Measurements & Data',
      question: 'How accurate are the measurements?',
      answer: 'The accuracy depends on your connected medical device. Monitraq displays data as received from your device. We recommend using FDA-approved or CE-marked medical devices for the most accurate readings. Always consult with healthcare professionals about your measurements.'
    },
    
    // Account & Profile
    {
      category: 'Account & Profile',
      question: 'How do I update my profile information?',
      answer: 'Go to the Profile page from the main menu. Tap on any field you want to update and make your changes. Don\'t forget to save your updates. Some information like email may require verification.'
    },
    {
      category: 'Account & Profile',
      question: 'How do I change my password?',
      answer: 'Go to the Profile page, then tap on Account Settings. Select "Change Password" and follow the instructions. You\'ll need to enter your current password and create a new one. Make sure your new password is strong and secure.'
    },
    {
      category: 'Account & Profile',
      question: 'Can I delete my account?',
      answer: 'Yes. Open Profile, tap Delete Account above Sign Out, and confirm. This permanently deletes your account and associated data in accordance with our Privacy Policy.'
    },
    
    // Healthcare Features
    {
      category: 'Healthcare Features',
      question: 'How do I book an appointment with a doctor?',
      answer: 'Go to the Appointments page in the app. Tap "Book Appointment" and select your preferred date and time. You can also view available doctors and their specialties. Once booked, you\'ll receive a confirmation and reminder notifications.'
    },
    {
      category: 'Healthcare Features',
      question: 'How do video consultations work?',
      answer: 'When you have a scheduled video consultation, you\'ll receive a notification. At the appointment time, go to the Video Call section and join the call. Make sure you have a stable internet connection and have granted camera and microphone permissions.'
    },
    {
      category: 'Healthcare Features',
      question: 'Can I share my health data with my doctor?',
      answer: 'Yes! Your assigned healthcare providers can view your health data through the app. You can also manually share reports by going to the Reports section and using the share feature. All data sharing is secure and HIPAA-compliant.'
    },
    
    // Technical Issues
    {
      category: 'Technical Issues',
      question: 'The app is crashing or freezing. What should I do?',
      answer: 'Try these steps: 1. Close and restart the app. 2. Restart your phone. 3. Check if there\'s an app update available. 4. Clear the app cache (Android) or reinstall the app. 5. If issues persist, contact support with details about when the crash occurs.'
    },
    {
      category: 'Technical Issues',
      question: 'I\'m not receiving notifications. How do I fix this?',
      answer: '1. Check your phone\'s notification settings for Monitraq. 2. Ensure notifications are enabled in the app settings. 3. Make sure you\'re not in Do Not Disturb mode. 4. Check that the app has permission to send notifications. 5. Try logging out and back in.'
    },
    {
      category: 'Technical Issues',
      question: 'My data isn\'t syncing. What\'s wrong?',
      answer: 'Ensure you have an active internet connection. Check if the app has permission to use mobile data or Wi-Fi. Try manually refreshing by pulling down on the screen. If syncing still fails, log out and log back in, or contact support.'
    },
    
    // Privacy & Security
    {
      category: 'Privacy & Security',
      question: 'How is my health data protected?',
      answer: 'We use industry-standard encryption for all data in transit and at rest. Access to your data is strictly controlled and logged. We comply with HIPAA regulations for protected health information. See our Privacy Policy for complete details.'
    },
    {
      category: 'Privacy & Security',
      question: 'Who can see my health information?',
      answer: 'Only you and healthcare providers assigned to your care can view your health data. We never sell your data to third parties. You control what information is shared. See our Privacy Policy for full details on data sharing.'
    },
    {
      category: 'Privacy & Security',
      question: 'Can I export my data?',
      answer: 'Yes, you can request a copy of your data by contacting support@monitraq.com. We can provide your data in a portable format. This is also available through the Profile settings under Data Export.'
    },
  ];

  const categories = ['all', 'Getting Started', 'Device Connection', 'Measurements & Data', 'Account & Profile', 'Healthcare Features', 'Technical Issues', 'Privacy & Security'];

  const filteredFAQs = faqItems.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Getting Started': return <Book className="h-4 w-4" />;
      case 'Device Connection': return <Bluetooth className="h-4 w-4" />;
      case 'Measurements & Data': return <Activity className="h-4 w-4" />;
      case 'Account & Profile': return <Smartphone className="h-4 w-4" />;
      case 'Healthcare Features': return <Heart className="h-4 w-4" />;
      case 'Technical Issues': return <AlertCircle className="h-4 w-4" />;
      case 'Privacy & Security': return <FileText className="h-4 w-4" />;
      default: return <HelpCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      {/* Header with Back Button */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-10">
        <div className="relative flex items-center justify-between p-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 text-white bg-blue-600 hover:bg-blue-700 transition-colors touch-manipulation rounded-lg"
            style={{ minHeight: '40px', minWidth: '70px' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-semibold text-white flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Support
          </h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="p-4 pb-20 max-w-4xl mx-auto">
        <div className="space-y-6">
          {/* Introduction */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-3">How Can We Help?</h2>
            <p className="text-emerald-200/80 text-sm leading-relaxed">
              Find answers to common questions, learn how to use features, and get help with technical issues. If you can't find what you're looking for, contact our support team.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              onClick={() => navigate('/contact-us')}
              className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 h-auto p-4 flex flex-col items-center gap-2"
            >
              <MessageSquare className="h-6 w-6 text-emerald-400" />
              <span className="text-white font-semibold">Contact Support</span>
            </Button>
            <Button
              onClick={() => navigate('/medical-disclaimer')}
              className="backdrop-blur-md bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 h-auto p-4 flex flex-col items-center gap-2"
            >
              <AlertCircle className="h-6 w-6 text-yellow-400" />
              <span className="text-white font-semibold">Medical Disclaimer</span>
            </Button>
            <Button
              onClick={() => window.open('https://www.monitraq.com/docs', '_blank')}
              className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 h-auto p-4 flex flex-col items-center gap-2"
            >
              <Video className="h-6 w-6 text-emerald-400" />
              <span className="text-white font-semibold">Video Tutorials</span>
            </Button>
            <Button
              onClick={() => window.open('mailto:support@monitraq.com', '_blank')}
              className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 h-auto p-4 flex flex-col items-center gap-2"
            >
              <Mail className="h-6 w-6 text-emerald-400" />
              <span className="text-white font-semibold">Email Support</span>
            </Button>
          </div>

          {/* Search */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-emerald-400" />
              <Input
                type="text"
                placeholder="Search for help..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800/50 border-emerald-500/30 text-white placeholder:text-emerald-300/50 focus:border-emerald-400"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">Filter by Category</h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-800/50 text-emerald-200 hover:bg-slate-700/50'
                  }`}
                >
                  {category === 'all' ? 'All Categories' : category}
                </button>
              ))}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-emerald-400" />
              Frequently Asked Questions
            </h2>
            
            {filteredFAQs.length === 0 ? (
              <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6 text-center">
                <p className="text-emerald-200/80">No results found. Try adjusting your search or filter.</p>
              </div>
            ) : (
              filteredFAQs.map((item, index) => {
                const isExpanded = expandedItems.has(index);
                return (
                  <div
                    key={index}
                    className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleItem(index)}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-emerald-500/10 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {getCategoryIcon(item.category)}
                        <span className="text-white font-semibold">{item.question}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-emerald-500/20">
                        <p className="text-emerald-200/80 text-sm leading-relaxed whitespace-pre-line">
                          {item.answer}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Still Need Help */}
          <div className="backdrop-blur-md bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Still Need Help?</h3>
            <p className="text-emerald-200/80 text-sm mb-4">
              If you couldn't find the answer you're looking for, our support team is here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => navigate('/contact-us')}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
              <Button
                onClick={() => window.open('tel:+1-800-666-4872', '_blank')}
                variant="outline"
                className="flex-1 border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/20"
              >
                <Phone className="h-4 w-4 mr-2" />
                Call Us
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;

