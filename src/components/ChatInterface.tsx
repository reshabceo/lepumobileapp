import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Paperclip, Phone, Video, MoreVertical, Check, CheckCheck, Clock, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRealTimeChat } from '@/hooks/useRealTimeChat';
import { useRealTimeVitals } from '@/hooks/useRealTimeVitals';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
// Removed date-fns import - using native JS instead

export const ChatInterface = () => {
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { patientProfile } = useRealTimeVitals();
  const {
    messages,
    conversations,
    currentConversation,
    typingIndicators,
    userProfile,
    loading,
    sending,
    sendMessage,
    getOrCreateConversation,
    handleTyping,
    isTyping,
    typingUsers,
    manualRefresh
  } = useRealTimeChat(conversationId || undefined);

  // Initialize conversation when patient profile is loaded
  useEffect(() => {
    const initializeChat = async () => {
      if (!patientProfile?.assigned_doctor_id || conversationId) return;

      try {
        const convId = await getOrCreateConversation(
          patientProfile.id,
          patientProfile.assigned_doctor_id
        );
        setConversationId(convId);
      } catch (error) {
        console.error('Failed to initialize chat:', error);
      }
    };

    initializeChat();
  }, [patientProfile, conversationId, getOrCreateConversation]);

  // Effect to scroll to the bottom of the chat on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId || sending) return;

    const messageText = newMessage;
    setNewMessage('');

    try {
      await sendMessage(conversationId, messageText);
    } catch (error) {
      // Error is handled in the hook
      setNewMessage(messageText); // Restore message on error
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (conversationId) {
      handleTyping(conversationId);
    }
  };

  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    try {
      // Validate file
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 10MB",
          variant: "destructive"
        });
        return;
      }

      // Upload file to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `chat-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      console.log('📎 Uploading file:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ File upload error:', uploadError);
        toast({
          title: "Upload failed",
          description: "Failed to upload file. Please try again.",
          variant: "destructive"
        });
        return;
      }

      console.log('✅ File uploaded successfully:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-files')
        .getPublicUrl(fileName);

      // Determine message type
      const messageType = file.type.startsWith('image/') ? 'image' : 'file';

      // Send message with file attachment
      await sendMessage(conversationId, file.name, messageType, {
        url: publicUrl,
        name: file.name,
        size: file.size,
        mimeType: file.type
      });

      toast({
        title: "File sent",
        description: `${file.name} has been sent successfully`,
        variant: "default"
      });

    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getMessageStatus = (message: any) => {
    if (message.sender_id !== userProfile?.id) return null;

    if (message.is_read) {
      return <CheckCheck className="w-4 h-4 text-blue-400" />;
    } else if (message.is_delivered) {
      return <CheckCheck className="w-4 h-4 text-gray-400" />;
    } else {
      return <Check className="w-4 h-4 text-gray-400" />;
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  if (loading && !conversationId) {
    return (
      <div className="bg-[#080D1A] min-h-screen text-white flex items-center justify-center font-inter select-none">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500/30 border-t-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400 text-xs font-semibold">Loading chat...</p>
        </div>
      </div>
    );
  }

  const doctorName = currentConversation?.doctor_name || 'Doctor';
  const doctorAvatar = currentConversation?.doctor_avatar;

  return (
    <div className="bg-[#080D1A] h-screen text-white font-inter flex flex-col select-none">
      {/* Top spacing */}
      <div className="h-6 flex-shrink-0"></div>

      {/* Header */}
      <header className="bg-[#1A243D]/95 backdrop-blur-md border-b border-slate-700/40 px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-md">
        <div className="flex items-center">
          <button
            onClick={handleBack}
            className="mr-3 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center">
            {doctorAvatar ? (
              <img
                src={doctorAvatar}
                alt={doctorName}
                className="w-10 h-10 rounded-full mr-3 object-cover border border-slate-700"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-900/70 border border-blue-400/50 flex items-center justify-center mr-3">
                <span className="text-blue-300 font-semibold text-sm">
                  {doctorName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            <div>
              <h1 className="text-sm font-extrabold text-white leading-tight">{doctorName}</h1>
              <p className="text-[11px] text-slate-400">
                {isTyping ? (
                  <span className="text-emerald-400 animate-pulse font-medium">typing...</span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Online
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* <button className="p-2 bg-[#1A243D] hover:bg-[#121B32]/95 border border-slate-800/40 rounded-xl transition-all duration-200">
            <Phone className="w-4 h-4 text-slate-300" />
          </button>
          <button className="p-2 bg-[#1A243D] hover:bg-[#121B32]/95 border border-slate-800/40 rounded-xl transition-all duration-200">
            <Video className="w-4 h-4 text-slate-300" />
          </button> */}

          <button className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-slate-300">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Chat Body */}
      <main className="flex-1 px-4 overflow-y-auto py-4 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500/30 border-t-blue-500 mx-auto mb-2"></div>
              <p className="text-slate-400 text-xs font-medium">Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6 bg-[#1A243D] border border-slate-700/40 rounded-3xl max-w-xs mx-auto shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3 border border-blue-500/20">
                <MessageSquare className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-white text-sm font-extrabold">Start a conversation</p>
              <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">Send a message to update your primary care doctor.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 h-full">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_type === 'patient' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex items-end space-x-2 max-w-xs lg:max-w-md">
                  {message.sender_type === 'doctor' && (
                    <div className="flex-shrink-0">
                      {message.sender_avatar ? (
                        <img
                          src={message.sender_avatar}
                          alt={message.sender_name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-700"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-900/70 border border-blue-400/50 flex items-center justify-center">
                          <span className="text-blue-300 font-semibold text-xs">
                            {(message.sender_name || 'D').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={`px-4 py-3 rounded-2xl ${message.sender_type === 'patient'
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-br-md shadow-md shadow-indigo-950/20'
                      : 'bg-[#1A243D] text-white rounded-bl-md border border-slate-700/40 shadow-sm'
                      }`}
                  >
                    {/* Render different content based on message type */}
                    {message.message_type === 'image' && message.file_url ? (
                      <div className="space-y-2">
                        <img
                          src={message.file_url}
                          alt={message.content}
                          className="max-w-xs rounded-lg cursor-pointer"
                          onClick={() => window.open(message.file_url, '_blank')}
                        />
                        <p className="text-sm">{message.content}</p>
                      </div>
                    ) : message.message_type === 'file' && message.file_url ? (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 bg-black/20 rounded-lg p-3">
                          <Paperclip className="w-4 h-4" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{message.content}</p>
                            {message.file_size && (
                              <p className="text-xs opacity-70">
                                {(message.file_size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => window.open(message.file_url, '_blank')}
                            className="text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30"
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    )}

                    <div className="flex items-center justify-between mt-1.5 gap-4">
                      <p className="text-[10px] text-slate-300 opacity-70">
                        {formatMessageTime(message.created_at)}
                      </p>
                      {getMessageStatus(message)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-end space-x-2">
                  {doctorAvatar ? (
                    <img
                      src={doctorAvatar}
                      alt={doctorName}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-900/70 border border-blue-400/50 flex items-center justify-center">
                      <span className="text-blue-300 font-semibold text-xs">
                        {doctorName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="bg-[#1A243D] border border-slate-700/40 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                    <div className="flex space-x-1.5 items-center h-2">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}
      </main>

      {/* Message Input Footer */}
      <footer className="p-3 flex-shrink-0 bg-[#0F172A]/90 backdrop-blur-md border-t border-slate-800/60">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleAttachFile}
            className="p-2.5 bg-[#1A243D] hover:bg-[#1A243D]/80 border border-slate-700/40 rounded-xl transition-all duration-200 text-slate-300 hover:text-white"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="w-full px-4 py-2.5 bg-[#121B32] border border-slate-700/40 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 text-sm"
              disabled={sending}
            />
          </div>

          <button
            type="submit"
            disabled={!newMessage.trim() || sending || !conversationId}
            className={`p-2.5 rounded-xl transition-all duration-200 ${newMessage.trim() && !sending && conversationId
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md shadow-indigo-950/30'
              : 'bg-[#1A243D] border border-slate-800/60 text-slate-500 cursor-not-allowed'
              }`}
          >
            {sending ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-slate-300 border-t-white"></div>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          accept="image/*,application/pdf,.doc,.docx"
          className="hidden"
        />
      </footer>
    </div>
  );
};