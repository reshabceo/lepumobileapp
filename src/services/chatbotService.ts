// Intelligent Chatbot Service for Monitraq Platform
// Handles questions about the platform, features, and functionality

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatContext {
  isPatient: boolean;
  hasDoctor: boolean;
  userName?: string;
}

interface ConversationMemory {
  topics: string[];
  lastIntent: string | null;
  contextData: Record<string, any>;
}

class ChatbotService {
  private conversationMemory: Map<string, ConversationMemory> = new Map();
  
  // Common misspellings dictionary
  private spellCorrections: Record<string, string> = {
    // Platform terms
    'monitrak': 'monitraq',
    'moniteraq': 'monitraq',
    'monitrac': 'monitraq',
    'monitraq': 'monitraq',
    'monitoraq': 'monitraq',
    
    // Features
    'appoitment': 'appointment',
    'appointmnet': 'appointment',
    'apointment': 'appointment',
    'emergancy': 'emergency',
    'emegency': 'emergency',
    'emergensy': 'emergency',
    'docter': 'doctor',
    'docktor': 'doctor',
    'dokter': 'doctor',
    'vitel': 'vital',
    'vitial': 'vital',
    'signes': 'signs',
    'presure': 'pressure',
    'preasure': 'pressure',
    'blod': 'blood',
    'bloood': 'blood',
    'analize': 'analyze',
    'analysys': 'analysis',
    'anaylsis': 'analysis',
    'reort': 'report',
    'raport': 'report',
    'reprot': 'report',
    'mesage': 'message',
    'messege': 'message',
    'availablity': 'availability',
    'avalability': 'availability',
    'schdule': 'schedule',
    'schedual': 'schedule',
    'shcedule': 'schedule',
    'monitr': 'monitor',
    'moniter': 'monitor',
    'healt': 'health',
    'helth': 'health',
    'chatt': 'chat',
    'uploade': 'upload',
    'uplod': 'upload',
    'dicom': 'dicom',
    'dicam': 'dicom',
    'ecg': 'ecg',
    'ekg': 'ecg',
    'temperture': 'temperature',
    'tempature': 'temperature',
    'hart': 'heart',
    'oxigen': 'oxygen',
    'spo2': 'spo2',
    'sp02': 'spo2',
    'contect': 'contact',
    'conect': 'connect',
  };
  
  private knowledgeBase = {
    // Platform Overview
    platform: [
      {
        keywords: ['what is', 'what does', 'monitraq', 'platform', 'system', 'about'],
        response: '🏥 Monitraq Platform Overview\n\nMonitraq is a comprehensive remote patient monitoring platform that enables:\n\n📊 Real-Time Health Tracking\n• Monitor vital signs continuously\n• Track trends and patterns\n• Get instant alerts for abnormal values\n\n🚨 Emergency Response System\n• SOS button for urgent situations\n• Automatic alert to your doctor\n• Alternative doctor suggestions if assigned doctor unavailable\n\n🏥 Medical Imaging & Reports\n• Upload medical reports (PDF, DICOM)\n• AI-powered analysis using Google Gemini\n• Receive analyzed reports from your doctor\n\n💬 Doctor-Patient Communication\n• Secure messaging\n• Video consultations\n• Appointment scheduling\n\nThe platform connects patients with their doctors 24/7, ensuring continuous care and immediate response to health emergencies.'
      },
      {
        keywords: ['how does it work', 'how it works', 'functionality', 'features'],
        response: 'Monitraq works by connecting patients with their assigned doctors. Patients can:\n• Monitor vital signs in real-time (heart rate, blood pressure, SpO2, temperature)\n• Book appointments with their doctor\n• Upload medical reports for AI analysis\n• Use emergency SOS button for urgent situations\n• Chat with their doctor\n• View their health history and trends\n\nDoctors can monitor all their patients, receive alerts, analyze reports, and respond to emergencies.'
      }
    ],

    // Patient Features
    patientFeatures: [
      {
        keywords: ['vital signs', 'monitor', 'heart rate', 'blood pressure', 'spo2', 'temperature', 'track', 'vitals', 'measurements', 'readings'],
        response: '📊 Vital Signs Monitoring\n\nAvailable Measurements:\n\n❤️ Heart Rate (ECG)\n• Real-time heart rhythm tracking\n• Beat-by-beat monitoring\n• Abnormal rhythm detection\n• ECG waveform visualization\n\n🩸 Blood Pressure\n• Systolic and diastolic readings\n• Automatic classification (normal/high/low)\n• Historical trend charts\n• Multiple readings per day support\n\n🫁 SpO2 (Oxygen Saturation)\n• Blood oxygen level percentage\n• Continuous monitoring\n• Low oxygen alerts\n• Pulse rate included\n\n🌡️ Temperature\n• Body temperature tracking\n• Fever detection\n• Historical records\n\n🩸 Blood Glucose\n• Pre/post meal readings\n• Diabetes management\n• Trend analysis\n\nHow It Works:\n1. Connect your medical devices via Bluetooth\n2. Take readings - data syncs automatically\n3. View real-time results in Health Dashboard\n4. Data is instantly shared with your doctor\n5. Receive alerts for abnormal values\n6. Access historical data and trends anytime\n\nPro Tip: Take readings at the same time daily for better trend analysis!'
      },
      {
        keywords: ['appointment', 'book', 'schedule', 'availability', 'booking', 'meeting', 'consultation time'],
        response: '📅 Booking Appointments\n\nStep-by-Step Guide:\n\n1️⃣ Navigate to Appointments\n• Tap "Book" button on dashboard\n• Or go to Appointments section\n\n2️⃣ Select Date\n• Choose from available dates\n• Can book up to 90 days in advance\n• Minimum: tomorrow (same-day not allowed)\n\n3️⃣ Check Doctor Availability\n• Green indicator = Doctor available\n• Orange indicator = Doctor unavailable\n• Alternative doctors shown if needed\n\n4️⃣ Choose Time Slot\n• Available slots shown in green\n• 30-minute appointment duration\n• Select your preferred time\n\n5️⃣ Provide Reason\n• Describe why you need the appointment\n• Be specific to help your doctor prepare\n• This is required\n\n6️⃣ Confirm Booking\n• Review details\n• Click "Book Appointment"\n• Receive confirmation\n\nImportant Notes:\n• Appointments need 24-hour advance notice\n• Emergency cases bypass scheduling\n• If your doctor is unavailable, system shows up to 5 alternative doctors with same specialty\n• You can reschedule or cancel anytime\n• Reminders sent before appointment\n\nAlternative Doctors:\nWhen your assigned doctor is unavailable:\n• System finds doctors with same specialty\n• Sorted by years of experience\n• Shows real-time availability\n• Can book immediately with them'
      },
      {
        keywords: ['emergency', 'sos', 'urgent', 'critical', 'help', 'panic', 'alert', 'crisis'],
        response: '🚨 Emergency System\n\nWhen to Use:\n• Sudden severe chest pain\n• Difficulty breathing\n• Severe allergic reaction\n• Loss of consciousness\n• Severe injury or bleeding\n• Critical vital sign readings\n• Any life-threatening situation\n\nHow It Works:\n\n1️⃣ Press SOS Button\n• Large red button on dashboard\n• Immediately triggers alert system\n\n2️⃣ System Checks Your Doctor\n• Verifies if assigned doctor is available\n• Checks real-time availability status\n\n3️⃣ If Doctor Available:\n• Doctor receives immediate alert\n• Shows your location\n• Displays your current vitals\n• Includes your medical history\n\n4️⃣ If Doctor Unavailable:\n• System finds 5 alternative doctors\n• Same specialty as your doctor\n• Sorted by years of experience\n• Shows who\'s available NOW\n\n5️⃣ Automatic Notifications:\n• Your doctor (if available)\n• Hospital emergency team\n• Shows your exact location\n• Includes vital signs data\n• Medical history attached\n\n6️⃣ Doctor Response Options:\n• Call you directly\n• Dispatch ambulance\n• Contact hospital\n• Send emergency instructions\n\nEmergency Appointments:\n• Bypass regular scheduling\n• Available 24/7\n• No advance booking needed\n• Immediate doctor connection\n\n⚠️ CRITICAL: For life-threatening emergencies, ALWAYS call 911 (or your local emergency number) FIRST, then use the app!\n\nThe app enhances care but doesn\'t replace emergency services!'
      },
      {
        keywords: ['report', 'upload', 'medical report', 'analysis', 'dicom'],
        response: 'You can upload medical reports (PDF, DICOM images, lab results):\n1. Go to "Add Report" section\n2. Select files from your device\n3. Reports are automatically analyzed by AI\n4. Your doctor receives the analysis and can review/edit it\n5. You\'ll receive notifications when analysis is complete\n6. View analyzed reports in "My Reports" section'
      },
      {
        keywords: ['chat', 'message', 'communicate', 'talk to doctor'],
        response: 'You can chat with your assigned doctor:\n1. Open the Chat section\n2. Send messages, images, or files\n3. Your doctor will respond when available\n4. All conversations are secure and encrypted\n5. You can also use video consultation for face-to-face communication'
      },
      {
        keywords: ['doctor', 'assigned', 'my doctor', 'who is my doctor'],
        response: 'Your assigned doctor is shown in your Health Dashboard. You can see their name, specialty, contact information, and availability status. If you don\'t have an assigned doctor, please contact support at monitraq@gmail.com to get assigned to one.'
      }
    ],

    // Doctor Features
    doctorFeatures: [
      {
        keywords: ['monitor patients', 'patient monitoring', 'vital signs', 'dashboard'],
        response: 'As a doctor, you can:\n• View all your assigned patients in the dashboard\n• Monitor real-time vital signs for each patient\n• See risk levels (low, moderate, high, critical)\n• Receive automatic alerts for critical values\n• View patient history and trends\n• Filter patients by risk level or search by name/condition'
      },
      {
        keywords: ['appointment', 'availability', 'schedule', 'manage appointments'],
        response: 'Manage your availability and appointments:\n• Set recurring weekly availability slots\n• Add one-time availability for specific dates\n• Copy schedules to multiple days\n• View all patient appointments\n• Mark appointments as completed or cancelled\n• Patients can only book during your available slots (except emergencies)'
      },
      {
        keywords: ['alert', 'emergency', 'sos', 'critical alert'],
        response: 'Emergency alerts appear in your dashboard:\n• SOS alerts from patients\n• Automatic vital signs alerts (critical values)\n• Device failure alerts\n• Manual emergency triggers\n\nYou can respond by:\n• Calling the patient directly\n• Contacting hospital emergency team\n• Dispatching EMS\n• Sending emergency messages\n• Viewing patient location and medical history'
      },
      {
        keywords: ['report', 'analysis', 'medical report', 'dicom', 'ai analysis'],
        response: 'Report analysis features:\n• Patients upload medical reports (PDF, DICOM, lab results)\n• AI automatically analyzes reports using Google Gemini\n• You receive notifications when analysis is complete\n• Review and edit AI-generated analysis\n• Send analyzed reports back to patients as PDF\n• View analysis history for all patients\n• Support for single and combined report analysis'
      },
      {
        keywords: ['patient chat', 'message patient', 'communicate'],
        response: 'Chat with your patients:\n• Open patient detail view\n• Access secure messaging\n• Send messages, images, or medical files\n• All conversations are encrypted\n• Use video consultation for face-to-face communication\n• Chat history is preserved for medical records'
      }
    ],

    // Technical Questions
    technical: [
      {
        keywords: ['device', 'bluetooth', 'connect', 'pair'],
        response: 'To connect medical devices:\n1. Enable Bluetooth on your device\n2. Go to Devices section\n3. Tap "Add Device"\n4. Follow pairing instructions\n5. Once connected, data syncs automatically\n\nSupported devices: Blood pressure monitors, ECG devices, pulse oximeters, glucose meters, thermometers.'
      },
      {
        keywords: ['data', 'privacy', 'security', 'hipaa', 'encrypted'],
        response: 'Monitraq takes data security seriously:\n• All data is encrypted in transit and at rest\n• HIPAA-compliant infrastructure\n• Secure authentication with Supabase\n• Only you and your assigned doctor can access your data\n• Regular security audits and updates\n• Your privacy is our top priority'
      },
      {
        keywords: ['sync', 'update', 'refresh', 'not loading'],
        response: 'If data isn\'t syncing:\n1. Check your internet connection\n2. Refresh the page/app\n3. Ensure Bluetooth is enabled for devices\n4. Check if you\'re logged in\n5. Try logging out and back in\n\nIf issues persist, contact support at monitraq@gmail.com'
      },
      {
        keywords: ['login', 'password', 'account', 'sign up', 'register'],
        response: 'Account management:\n• Sign up with your email and create a password\n• For doctors: You\'ll receive a unique doctor code\n• For patients: Use your doctor\'s code to link accounts\n• If you forgot your password, use the "Forgot Password" option\n• Contact monitraq@gmail.com for account issues'
      }
    ],

    // General Support
    general: [
      {
        keywords: ['help', 'support', 'contact', 'email'],
        response: 'For additional support:\n• Email: monitraq@gmail.com\n• Include your account details and question\n• Our support team responds within 24 hours\n• For urgent medical issues, contact your doctor or emergency services'
      },
      {
        keywords: ['how to', 'tutorial', 'guide', 'learn'],
        response: 'Here are key features to explore:\n• Health Dashboard: View your vital signs\n• Appointments: Book with your doctor\n• Reports: Upload and view medical reports\n• Emergency: Use SOS button for urgent situations\n• Chat: Communicate with your doctor\n\nFor detailed guides, check the help section or contact monitraq@gmail.com'
      }
    ]
  };

  private correctSpelling(text: string): string {
    let corrected = text.toLowerCase();
    const words = corrected.split(/\s+/);
    
    const correctedWords = words.map(word => {
      // Remove punctuation for checking
      const cleanWord = word.replace(/[^\w]/g, '');
      if (this.spellCorrections[cleanWord]) {
        return word.replace(cleanWord, this.spellCorrections[cleanWord]);
      }
      return word;
    });
    
    return correctedWords.join(' ');
  }

  private updateConversationMemory(
    sessionId: string,
    userMessage: string,
    assistantResponse: string
  ): void {
    if (!this.conversationMemory.has(sessionId)) {
      this.conversationMemory.set(sessionId, {
        topics: [],
        lastIntent: null,
        contextData: {}
      });
    }

    const memory = this.conversationMemory.get(sessionId)!;
    
    // Extract topics from user message
    const message = userMessage.toLowerCase();
    const topics = [];
    
    if (message.includes('appointment') || message.includes('book') || message.includes('schedule')) {
      topics.push('appointments');
    }
    if (message.includes('vital') || message.includes('heart') || message.includes('blood') || message.includes('temperature')) {
      topics.push('vital_signs');
    }
    if (message.includes('emergency') || message.includes('sos') || message.includes('urgent')) {
      topics.push('emergency');
    }
    if (message.includes('report') || message.includes('upload') || message.includes('analysis')) {
      topics.push('reports');
    }
    if (message.includes('doctor') || message.includes('assigned')) {
      topics.push('doctor');
    }
    if (message.includes('chat') || message.includes('message')) {
      topics.push('communication');
    }
    
    // Update memory
    topics.forEach(topic => {
      if (!memory.topics.includes(topic)) {
        memory.topics.push(topic);
      }
    });
    
    // Keep only last 5 topics
    if (memory.topics.length > 5) {
      memory.topics = memory.topics.slice(-5);
    }
    
    memory.lastIntent = topics[0] || null;
  }

  private getContextualEnhancement(
    sessionId: string,
    message: string
  ): string {
    const memory = this.conversationMemory.get(sessionId);
    if (!memory || memory.topics.length === 0) return '';

    const lowerMessage = message.toLowerCase();
    
    // If asking vague follow-up questions
    if (lowerMessage.match(/^(how|what|why|when|where|can i|tell me more)/)) {
      const lastTopic = memory.lastIntent;
      
      if (lastTopic === 'appointments' && !lowerMessage.includes('appointment')) {
        return 'I notice we were discussing appointments earlier. ';
      }
      if (lastTopic === 'vital_signs' && !lowerMessage.includes('vital')) {
        return 'Regarding vital signs monitoring, ';
      }
      if (lastTopic === 'emergency' && !lowerMessage.includes('emergency')) {
        return 'About emergency situations, ';
      }
    }
    
    return '';
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private findBestMatch(userMessage: string, context: ChatContext): string {
    const message = userMessage.toLowerCase();
    let bestMatch: { response: string; score: number } | null = null;

    // Search through all knowledge base categories
    const categories = context.isPatient 
      ? ['platform', 'patientFeatures', 'technical', 'general']
      : ['platform', 'doctorFeatures', 'technical', 'general'];

    for (const category of categories) {
      const entries = this.knowledgeBase[category as keyof typeof this.knowledgeBase];
      if (!entries) continue;

      for (const entry of entries) {
        // Check if any keyword matches
        const keywordMatch = entry.keywords.some(keyword => 
          message.includes(keyword.toLowerCase())
        );

        if (keywordMatch) {
          // Calculate similarity score
          let score = 0.5; // Base score for keyword match
          
          // Boost score for multiple keyword matches
          const matchedKeywords = entry.keywords.filter(k => 
            message.includes(k.toLowerCase())
          ).length;
          score += matchedKeywords * 0.1;

          // Boost score for exact phrase matches
          entry.keywords.forEach(keyword => {
            if (message.includes(keyword.toLowerCase())) {
              const similarity = this.calculateSimilarity(message, keyword.toLowerCase());
              score += similarity * 0.2;
            }
          });

          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { response: entry.response, score };
          }
        }
      }
    }

    return bestMatch?.response || '';
  }

  private generateContextualResponse(
    userMessage: string,
    context: ChatContext,
    sessionId: string = 'default'
  ): string {
    // Correct spelling first
    const correctedMessage = this.correctSpelling(userMessage);
    const message = correctedMessage.toLowerCase();
    
    // Get contextual enhancement based on conversation history
    const contextEnhancement = this.getContextualEnhancement(sessionId, message);

    // Greetings
    if (message.match(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)/)) {
      const greeting = context.userName 
        ? `Hello ${context.userName}! How can I help you with Monitraq today?`
        : 'Hello! I\'m the Monitraq support assistant. How can I help you today?';
      return greeting;
    }

    // Goodbyes
    if (message.match(/^(bye|goodbye|thanks|thank you|thank|see you|farewell)/)) {
      return 'You\'re welcome! If you have any more questions, feel free to ask. For additional support, contact monitraq@gmail.com.';
    }

    // Check for best match in knowledge base
    const bestMatch = this.findBestMatch(correctedMessage, context);
    if (bestMatch) {
      let response = bestMatch;
      
      // Add contextual enhancement if available
      if (contextEnhancement) {
        response = contextEnhancement + response;
      }
      
      // If spelling was corrected, acknowledge it
      if (correctedMessage !== userMessage.toLowerCase()) {
        response = `(I understood you meant "${correctedMessage}")\n\n` + response;
      }
      
      return response;
    }

    // Out of context questions
    return `I understand you're asking about "${userMessage}". While I'm specialized in helping with Monitraq platform features, functionality, and usage, I may not have the best answer for this specific question.\n\nFor more detailed assistance or questions outside the platform scope, please contact our support team at monitraq@gmail.com. They'll be happy to help you with any additional questions or concerns.`;
  }

  public async getResponse(
    userMessage: string,
    context: ChatContext,
    conversationHistory: ChatMessage[] = [],
    sessionId: string = 'default'
  ): Promise<string> {
    // Simulate thinking delay for more natural conversation
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // Generate response
    const response = this.generateContextualResponse(userMessage, context, sessionId);

    // Update conversation memory
    this.updateConversationMemory(sessionId, userMessage, response);

    return response;
  }

  public clearMemory(sessionId: string = 'default'): void {
    this.conversationMemory.delete(sessionId);
  }

  public getConversationTopics(sessionId: string = 'default'): string[] {
    return this.conversationMemory.get(sessionId)?.topics || [];
  }

  public getWelcomeMessage(context: ChatContext): string {
    if (context.isPatient) {
      return `Hello${context.userName ? ` ${context.userName}` : ''}! 👋\n\nI'm your Monitraq support assistant. I can help you with:\n\n• Understanding platform features\n• Booking appointments\n• Using vital signs monitoring\n• Emergency procedures\n• Uploading reports\n• Chatting with your doctor\n• And much more!\n\nWhat would you like to know?`;
    } else {
      return `Hello${context.userName ? ` ${context.userName}` : ''}! 👋\n\nI'm your Monitraq support assistant. I can help you with:\n\n• Patient monitoring features\n• Managing appointments and availability\n• Handling emergency alerts\n• Report analysis tools\n• Patient communication\n• Platform functionality\n• And much more!\n\nWhat would you like to know?`;
    }
  }
}

export const chatbotService = new ChatbotService();
export type { ChatMessage, ChatContext };

