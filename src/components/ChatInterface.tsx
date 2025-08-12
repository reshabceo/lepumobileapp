
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MessageSquare, Paperclip, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Mock data for chat messages
const initialMessages = [
  { id: 1, sender: 'doctor', text: 'Hello Dr. Singh, how are you today?', time: '09:30 AM' },
  { id: 2, sender: 'user', text: "I'm doing well, thank you. How are you feeling today? Any changes in your condition?", time: '09:32 AM' },
  { id: 3, sender: 'doctor', text: "I've been experiencing some tingling in my left hand this morning.", time: '09:35 AM' },
];

export const ChatInterface = () => {
  const [messages, setMessages] = useState(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Effect to scroll to the bottom of the chat on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    const newMsg = {
      id: messages.length + 1,
      sender: 'user' as const,
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([...messages, newMsg]);
    setNewMessage('');
  };

  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newMsg = {
        id: messages.length + 1,
        sender: 'user' as const,
        text: `📎 ${file.name}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...messages, newMsg]);
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <div className="bg-[#101010] h-full text-white font-inter flex flex-col">
      {/* Status Bar Spacing */}
      <div className="h-6"></div>
      
      {/* Chat Header */}
      <header className="flex items-center p-4 flex-shrink-0">
        <button 
          onClick={handleBack}
          className="text-gray-300 hover:text-white transition-colors duration-200"
        >
          <ArrowLeft size={24} />
        </button>
        <MessageSquare size={24} className="mx-3 text-gray-400" />
        <h1 className="text-lg font-semibold text-white">Chat</h1>
      </header>

      {/* Chat Body */}
      <main className="flex-grow px-4 overflow-y-auto pb-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Chat with Dr. Singh</h2>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                  msg.sender === 'user'
                    ? 'bg-green-500 text-white rounded-br-md'
                    : 'bg-[#1E1E1E] text-white rounded-bl-md'
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                <p className="text-xs text-gray-300 mt-1 text-right">{msg.time}</p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Message Input Footer */}
      <footer className="p-4 flex-shrink-0 border-t border-gray-800">
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleAttachFile}
            className="p-2 text-gray-400 hover:text-white transition-colors duration-200 flex-shrink-0"
          >
            <Paperclip size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          <div className="flex-grow flex items-center bg-[#1E1E1E] rounded-full px-4 py-2">
            <form onSubmit={handleSendMessage} className="flex-grow flex items-center">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none"
                aria-label="Type a message"
              />
              <button
                type="submit"
                className="ml-3 flex-shrink-0 bg-green-500 text-white rounded-full p-2 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-200"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </footer>
    </div>
  );
};
