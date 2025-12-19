import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, MessageSquare, Send, Clock, Globe, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

const ContactUs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    // Simulate form submission - in production, this would send to your backend
    setTimeout(() => {
      toast({
        title: "Message Sent",
        description: "Thank you for contacting us. We'll get back to you within 24-48 hours.",
        variant: "default",
      });
      setFormData({ name: '', email: '', subject: '', message: '' });
      setIsSubmitting(false);
    }, 1000);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
            <MessageSquare className="h-5 w-5" />
            Contact Us
          </h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="p-4 pb-20 max-w-4xl mx-auto">
        <div className="space-y-6">
          {/* Introduction */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-3">Get in Touch</h2>
            <p className="text-emerald-200/80 text-sm leading-relaxed">
              We're here to help! Whether you have questions about our services, need technical support, or want to provide feedback, our team is ready to assist you. Please use the contact methods below or fill out the form.
            </p>
          </div>

          {/* Contact Information Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Mail className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Email Support</h3>
              </div>
              <p className="text-emerald-200/80 text-sm mb-3">
                For general inquiries, support requests, or feedback:
              </p>
              <a 
                href="mailto:support@monitraq.com" 
                className="text-emerald-400 hover:text-emerald-300 underline text-sm font-medium"
              >
                support@monitraq.com
              </a>
              <p className="text-emerald-200/60 text-xs mt-2">
                Response time: 24-48 hours
              </p>
            </div>

            {/* Phone */}
            <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Phone className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Phone Support</h3>
              </div>
              <p className="text-emerald-200/80 text-sm mb-3">
                For urgent matters or immediate assistance:
              </p>
              <a 
                href="tel:+1-800-MONITRAQ" 
                className="text-emerald-400 hover:text-emerald-300 underline text-sm font-medium"
              >
                +1 (800) 666-4872
              </a>
              <p className="text-emerald-200/60 text-xs mt-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Mon-Fri: 9 AM - 6 PM EST
              </p>
            </div>

            {/* Address */}
            {/* <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <MapPin className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Mailing Address</h3>
              </div>
              <p className="text-emerald-200/80 text-sm leading-relaxed">
                Monitraq Inc.<br />
                123 Healthcare Avenue<br />
                Suite 456<br />
                New York, NY 10001<br />
                United States
              </p>
            </div> */}

            {/* Website */}
            <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Globe className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Website</h3>
              </div>
              <p className="text-emerald-200/80 text-sm mb-3">
                Visit our website for more information:
              </p>
              <a 
                href="https://www.monitraq.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 underline text-sm font-medium"
              >
                www.monitraq.com
              </a>
            </div>
          </div>

          {/* Contact Form */}
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <HelpCircle className="h-6 w-6 text-emerald-400" />
              <h2 className="text-2xl font-bold text-white">Send Us a Message</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-emerald-200/80 mb-2">
                  Your Name <span className="text-red-400">*</span>
                </label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter your full name"
                  className="bg-slate-800/50 border-emerald-500/30 text-white placeholder:text-emerald-300/50 focus:border-emerald-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-emerald-200/80 mb-2">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="your.email@example.com"
                  className="bg-slate-800/50 border-emerald-500/30 text-white placeholder:text-emerald-300/50 focus:border-emerald-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-emerald-200/80 mb-2">
                  Subject <span className="text-red-400">*</span>
                </label>
                <Input
                  id="subject"
                  type="text"
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  placeholder="What is this regarding?"
                  className="bg-slate-800/50 border-emerald-500/30 text-white placeholder:text-emerald-300/50 focus:border-emerald-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-emerald-200/80 mb-2">
                  Message <span className="text-red-400">*</span>
                </label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  placeholder="Please provide details about your inquiry..."
                  rows={6}
                  className="bg-slate-800/50 border-emerald-500/30 text-white placeholder:text-emerald-300/50 focus:border-emerald-400 resize-none"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold py-6 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Additional Information */}
          <div className="backdrop-blur-md bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Additional Information</h3>
            <div className="space-y-2 text-sm text-emerald-200/80">
              <p><strong className="text-white">Business Hours:</strong> Monday - Friday, 9:00 AM - 6:00 PM EST</p>
              <p><strong className="text-white">Emergency Support:</strong> For medical emergencies, please call 911 or your local emergency services immediately.</p>
              <p><strong className="text-white">Privacy:</strong> All communications are confidential and handled in accordance with our Privacy Policy.</p>
              <p><strong className="text-white">Response Time:</strong> We aim to respond to all inquiries within 24-48 hours during business days.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;

