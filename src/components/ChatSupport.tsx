import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { chatbotService, ChatMessage, ChatContext } from '../services/chatbotService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export const ChatSupport = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('default');
  const [context, setContext] = useState<ChatContext>({
    isPatient: true,
    hasDoctor: false,
    userName: undefined
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadUserContext();
  }, [user]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage = chatbotService.getWelcomeMessage(context);
      setMessages([{
        role: 'assistant',
        content: welcomeMessage,
        timestamp: new Date()
      }]);
    }
  }, [isOpen, context]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadUserContext = async () => {
    if (!user) return;

    // Set session ID based on user ID
    setSessionId(user.id);

    try {
      const { data: patient, error } = await supabase
        .from('patients')
        .select('id, assigned_doctor_id, full_name')
        .eq('auth_user_id', user.id)
        .single();

      if (!error && patient) {
        setContext({
          isPatient: true,
          hasDoctor: !!patient.assigned_doctor_id,
          userName: patient.full_name || undefined
        });
      }
    } catch (error) {
      console.error('Error loading user context:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatbotService.getResponse(
        userMessage.content,
        context,
        messages,
        sessionId
      );

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error getting chatbot response:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or contact monitraq@gmail.com for support.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-[96px] right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg shadow-emerald-500/50"
        >
          <MessageSquare className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[96px] right-6 z-50 w-[90vw] max-w-md">
      <Card className="glass border-emerald-500/20 bg-gradient-to-br from-emerald-950/95 via-green-900/90 to-emerald-950/95 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-emerald-500/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-100">Monitraq Support</h3>
              <p className="text-xs text-emerald-300/70">AI Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMessages([]);
                chatbotService.clearMemory(sessionId);
                const welcomeMessage = chatbotService.getWelcomeMessage(context);
                setMessages([{
                  role: 'assistant',
                  content: welcomeMessage,
                  timestamp: new Date()
                }]);
              }}
              className="text-emerald-300/70 hover:bg-emerald-600/20 hover:text-emerald-200 text-xs"
              title="Clear conversation"
            >
              Clear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-emerald-300 hover:bg-emerald-600/20 hover:text-emerald-200"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="h-[400px] overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center border border-emerald-500/30 flex-shrink-0">
                    <Bot className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-emerald-600/20 text-emerald-100 border border-emerald-500/30'
                      : 'bg-emerald-950/40 text-emerald-200 border border-emerald-500/10'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs mt-1 opacity-60">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/30 flex-shrink-0">
                    <User className="w-4 h-4 text-blue-400" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
                  <Bot className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="bg-emerald-950/40 rounded-lg p-3 border border-emerald-500/10">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-emerald-500/20">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your question..."
                disabled={isLoading}
                className="flex-1 bg-emerald-950/40 border-emerald-500/30 text-emerald-100 placeholder:text-emerald-300/50 focus:border-emerald-400"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-emerald-300/60 mt-2 text-center">
              For more support, email monitraq@gmail.com
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

