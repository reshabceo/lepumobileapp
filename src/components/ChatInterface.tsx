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
      <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading chat...</p>
        </div>
      </div>
    );
  }

  const doctorName = currentConversation?.doctor_name || 'Doctor';
  const doctorAvatar = currentConversation?.doctor_avatar;

  return (
    <div className="bg-[#101010] h-full text-white font-inter flex flex-col">
      {/* Header */}
      <header className="bg-[#1A1A1A] px-4 py-3 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center">
          <button
            onClick={handleBack}
            className="mr-4 p-1 hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="flex items-center">
            {doctorAvatar ? (
              <img
                src={doctorAvatar}
                alt={doctorName}
                className="w-10 h-10 rounded-full mr-3 object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mr-3">
                <span className="text-white font-semibold text-sm">
                  {doctorName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            <div>
              <h1 className="text-lg font-semibold">{doctorName}</h1>
              {isTyping && (
                <p className="text-sm text-green-400">
                  {typingUsers.length > 0 ? `${typingUsers.join(', ')} typing...` : 'Typing...'}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-gray-700 rounded-full transition-colors">
            <Phone className="w-5 h-5 text-gray-300" />
          </button>
          <button className="p-2 hover:bg-gray-700 rounded-full transition-colors">
            <Video className="w-5 h-5 text-gray-300" />
          </button>
          <button className="p-2 hover:bg-gray-700 rounded-full transition-colors">
            <MoreVertical className="w-5 h-5 text-gray-300" />
          </button>
        </div>
      </header>

      {/* Chat Body */}
      <main className="flex-grow px-4 overflow-y-auto pb-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500 mx-auto mb-2"></div>
              <p className="text-gray-400 text-sm">Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-400 text-lg font-medium">Start a conversation</p>
              <p className="text-gray-500 text-sm mt-1">Send a message to your doctor</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                          <span className="text-white font-semibold text-xs">
                            {(message.sender_name || 'D').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={`px-4 py-3 rounded-2xl ${message.sender_type === 'patient'
                      ? 'bg-green-500 text-white rounded-br-md'
                      : 'bg-[#1E1E1E] text-white rounded-bl-md border border-gray-700'
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

                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-300 opacity-70">
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
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-white font-semibold text-xs">D</span>
                  </div>
                  <div className="bg-[#1E1E1E] border border-gray-700 px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
      <footer className="p-4 flex-shrink-0 border-t border-gray-800">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleAttachFile}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
          >
            <Paperclip className="w-5 h-5 text-gray-400" />
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="w-full px-4 py-3 bg-[#1E1E1E] border border-gray-700 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              disabled={sending}
            />
          </div>

          <button
            type="submit"
            disabled={!newMessage.trim() || sending || !conversationId}
            className={`p-3 rounded-full transition-all duration-200 ${newMessage.trim() && !sending && conversationId
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
          >
            {sending ? (
              <div className="w-5 h-5 animate-spin rounded-full border-2 border-gray-300 border-t-white"></div>
            ) : (
              <Send className="w-5 h-5" />
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