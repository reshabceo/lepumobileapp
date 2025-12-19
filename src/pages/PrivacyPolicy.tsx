import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, FileText, Users, Globe, Database, Mail, Heart, User } from 'lucide-react';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

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
            <Shield className="h-5 w-5" />
            Privacy Policy
          </h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="p-4 pb-20 max-w-4xl mx-auto">
        <div className="space-y-6">
          {/* Introduction */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-6 w-6 text-emerald-400" />
              <h2 className="text-2xl font-bold text-white">Privacy Policy</h2>
            </div>
            <p className="text-emerald-200/80 text-sm leading-relaxed">
              <strong className="text-white">Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-emerald-200/80 text-sm leading-relaxed mt-4">
              Monitraq ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services (collectively, the "Service"). Please read this Privacy Policy carefully. By using our Service, you agree to the collection and use of information in accordance with this policy.
            </p>
          </div>

          {/* Information We Collect */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Database className="h-6 w-6 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">1. Information We Collect</h2>
            </div>
            
            <div className="space-y-4 text-sm text-emerald-200/80">
              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  1.1 Personal Information
                </h3>
                <p className="ml-6 leading-relaxed">
                  We collect personal information that you provide directly to us, including:
                </p>
                <ul className="ml-10 mt-2 space-y-1 list-disc">
                  <li>Name, email address, and phone number</li>
                  <li>Date of birth, gender, and address</li>
                  <li>Blood type and medical information (allergies, medical conditions, medications)</li>
                  <li>Emergency contact information</li>
                  <li>Profile picture (if provided)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  1.2 Health and Medical Data
                </h3>
                <p className="ml-6 leading-relaxed">
                  We collect health-related information to provide our medical monitoring services:
                </p>
                <ul className="ml-10 mt-2 space-y-1 list-disc">
                  <li>Blood pressure readings and measurements</li>
                  <li>ECG (electrocardiogram) data and waveforms</li>
                  <li>Blood glucose levels (CGM data)</li>
                  <li>Pulse oximetry readings</li>
                  <li>Height, weight, and other vital signs</li>
                  <li>Medical reports and documents you upload</li>
                  <li>Prescription information</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  1.3 Device and Usage Information
                </h3>
                <p className="ml-6 leading-relaxed">
                  We automatically collect certain information when you use our Service:
                </p>
                <ul className="ml-10 mt-2 space-y-1 list-disc">
                  <li>Device information (device type, operating system, unique device identifiers)</li>
                  <li>Bluetooth device connection data</li>
                  <li>Location information (with your permission) for address autofill</li>
                  <li>App usage data and interaction logs</li>
                  <li>IP address and network information</li>
                  <li>Crash reports and error logs</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  1.4 Communication Data
                </h3>
                <p className="ml-6 leading-relaxed">
                  We collect information from your communications with us:
                </p>
                <ul className="ml-10 mt-2 space-y-1 list-disc">
                  <li>Chat messages with healthcare providers</li>
                  <li>Video call recordings (if applicable and with consent)</li>
                  <li>Support requests and feedback</li>
                  <li>Appointment booking information</li>
                </ul>
              </div>
            </div>
          </div>

          {/* How We Use Your Information */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="h-6 w-6 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">2. How We Use Your Information</h2>
            </div>
            
            <div className="space-y-3 text-sm text-emerald-200/80">
              <p className="leading-relaxed">We use the information we collect for the following purposes:</p>
              <ul className="ml-6 space-y-2 list-disc">
                <li><strong className="text-white">To Provide Medical Services:</strong> Process and display your vital signs, health data, and medical information</li>
                <li><strong className="text-white">To Connect Medical Devices:</strong> Enable Bluetooth connectivity with your health monitoring devices</li>
                <li><strong className="text-white">To Facilitate Healthcare:</strong> Connect you with healthcare providers, enable video consultations, and manage appointments</li>
                <li><strong className="text-white">To Improve Our Service:</strong> Analyze usage patterns, fix bugs, and enhance app functionality</li>
                <li><strong className="text-white">To Communicate:</strong> Send you important updates, notifications, and respond to your inquiries</li>
                <li><strong className="text-white">To Ensure Security:</strong> Detect and prevent fraud, unauthorized access, and other security threats</li>
                <li><strong className="text-white">To Comply with Legal Obligations:</strong> Meet regulatory requirements and respond to legal requests</li>
                <li><strong className="text-white">For Research and Analytics:</strong> Conduct anonymized research to improve healthcare outcomes (with your consent)</li>
              </ul>
            </div>
          </div>

          {/* Data Sharing and Disclosure */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-6 w-6 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">3. Data Sharing and Disclosure</h2>
            </div>
            
            <div className="space-y-4 text-sm text-emerald-200/80">
              <p className="leading-relaxed">We do not sell your personal information. We may share your information only in the following circumstances:</p>
              
              <div>
                <h3 className="text-white font-semibold mb-2">3.1 Healthcare Providers</h3>
                <p className="ml-4 leading-relaxed">
                  We share your health data with authorized healthcare providers who are assigned to your care, enabling them to monitor your condition and provide medical advice.
                </p>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2">3.2 Service Providers</h3>
                <p className="ml-4 leading-relaxed">
                  We may share information with third-party service providers who perform services on our behalf, such as cloud hosting, data analytics, and customer support. These providers are contractually obligated to protect your information.
                </p>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2">3.3 Legal Requirements</h3>
                <p className="ml-4 leading-relaxed">
                  We may disclose information if required by law, court order, or government regulation, or to protect our rights, property, or safety, or that of our users.
                </p>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2">3.4 Business Transfers</h3>
                <p className="ml-4 leading-relaxed">
                  In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity, subject to the same privacy protections.
                </p>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2">3.5 With Your Consent</h3>
                <p className="ml-4 leading-relaxed">
                  We may share your information with other parties when you explicitly consent to such sharing.
                </p>
              </div>
            </div>
          </div>

          {/* Data Security */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="h-6 w-6 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">4. Data Security</h2>
            </div>
            
            <div className="space-y-3 text-sm text-emerald-200/80">
              <p className="leading-relaxed">
                We implement industry-standard security measures to protect your personal and health information:
              </p>
              <ul className="ml-6 space-y-2 list-disc">
                <li><strong className="text-white">Encryption:</strong> All data is encrypted in transit (TLS/SSL) and at rest</li>
                <li><strong className="text-white">Access Controls:</strong> Strict access controls limit who can view your data</li>
                <li><strong className="text-white">Secure Authentication:</strong> Multi-factor authentication and secure password requirements</li>
                <li><strong className="text-white">Regular Audits:</strong> We conduct regular security audits and vulnerability assessments</li>
                <li><strong className="text-white">HIPAA Compliance:</strong> We follow HIPAA guidelines for protected health information (PHI)</li>
                <li><strong className="text-white">Secure Infrastructure:</strong> Data is stored on secure, compliant cloud infrastructure</li>
              </ul>
              <p className="leading-relaxed mt-4">
                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
              </p>
            </div>
          </div>

          {/* Your Rights */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">5. Your Rights and Choices</h2>
            </div>
            
            <div className="space-y-3 text-sm text-emerald-200/80">
              <p className="leading-relaxed">You have the following rights regarding your personal information:</p>
              <ul className="ml-6 space-y-2 list-disc">
                <li><strong className="text-white">Access:</strong> Request access to your personal data</li>
                <li><strong className="text-white">Correction:</strong> Request correction of inaccurate or incomplete data</li>
                <li><strong className="text-white">Deletion:</strong> Request deletion of your personal data (subject to legal retention requirements)</li>
                <li><strong className="text-white">Portability:</strong> Request a copy of your data in a portable format</li>
                <li><strong className="text-white">Opt-Out:</strong> Opt out of certain data processing activities, such as marketing communications</li>
                <li><strong className="text-white">Withdraw Consent:</strong> Withdraw consent for data processing where consent is the legal basis</li>
                <li><strong className="text-white">Complaint:</strong> File a complaint with your local data protection authority</li>
              </ul>
              <p className="leading-relaxed mt-4">
                To exercise these rights, please contact us at <a href="mailto:privacy@monitraq.com" className="text-emerald-400 underline">privacy@monitraq.com</a> or through the Contact Us page in the app.
              </p>
            </div>
          </div>

          {/* Data Retention */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">6. Data Retention</h2>
            <p className="text-sm text-emerald-200/80 leading-relaxed">
              We retain your personal and health information for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. Medical records may be retained for longer periods as required by healthcare regulations. When you delete your account, we will delete or anonymize your data in accordance with applicable laws, except where retention is required for legal or regulatory purposes.
            </p>
          </div>

          {/* Children's Privacy */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">7. Children's Privacy</h2>
            <p className="text-sm text-emerald-200/80 leading-relaxed">
              Our Service is not intended for children under the age of 13 (or the applicable age of consent in your jurisdiction). We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately, and we will take steps to delete such information.
            </p>
          </div>

          {/* International Data Transfers */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">8. International Data Transfers</h2>
            <p className="text-sm text-emerald-200/80 leading-relaxed">
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy and applicable laws.
            </p>
          </div>

          {/* Changes to Privacy Policy */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">9. Changes to This Privacy Policy</h2>
            <p className="text-sm text-emerald-200/80 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy in the app and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes. Your continued use of the Service after changes become effective constitutes acceptance of the updated Privacy Policy.
            </p>
          </div>

          {/* Contact Information */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="h-6 w-6 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">10. Contact Us</h2>
            </div>
            <p className="text-sm text-emerald-200/80 leading-relaxed mb-4">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="space-y-2 text-sm text-emerald-200/80">
              <p><strong className="text-white">Email:</strong> <a href="mailto:privacy@monitraq.com" className="text-emerald-400 underline">privacy@monitraq.com</a></p>
              <p><strong className="text-white">Support Email:</strong> <a href="mailto:support@monitraq.com" className="text-emerald-400 underline">support@monitraq.com</a></p>
              <p><strong className="text-white">Address:</strong> [Your Company Address]</p>
            </div>
          </div>

          {/* Compliance Notice */}
          <div className="backdrop-blur-md bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Compliance with App Store Requirements</h2>
            <p className="text-sm text-emerald-200/80 leading-relaxed">
              This Privacy Policy complies with the requirements of both the Apple App Store and Google Play Store. We are committed to transparency about our data practices and protecting your privacy in accordance with applicable laws, including GDPR, CCPA, and HIPAA where applicable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

