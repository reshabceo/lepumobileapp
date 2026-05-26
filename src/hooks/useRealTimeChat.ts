import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
    id: string;
    conversation_id: string;
    sender_type: 'patient' | 'doctor';
    sender_id: string;
    message_type: 'text' | 'image' | 'file' | 'voice';
    content: string;
    file_url?: string;
    file_name?: string;
    file_size?: number;
    mime_type?: string;
    is_read: boolean;
    is_delivered: boolean;
    created_at: string;
    updated_at: string;

    // Populated fields
    sender_name?: string;
    sender_avatar?: string;
}

export interface ChatConversation {
    id: string;
    patient_id: string;
    doctor_id: string;
    created_at: string;
    updated_at: string;
    last_message_at: string;
    last_message_preview?: string;
    unread_count_patient: number;
    unread_count_doctor: number;
    is_active: boolean;

    // Populated fields
    patient_name?: string;
    patient_avatar?: string;
    doctor_name?: string;
    doctor_avatar?: string;
}

export interface TypingIndicator {
    conversation_id: string;
    user_type: 'patient' | 'doctor';
    user_id: string;
    is_typing: boolean;
    user_name?: string;
}

export const useRealTimeChat = (conversationId?: string) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [currentConversation, setCurrentConversation] = useState<ChatConversation | null>(null);
    const [typingIndicators, setTypingIndicators] = useState<TypingIndicator[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { user } = useAuth();
    const { toast } = useToast();

    // Refs for subscriptions
    const messageSubscriptionRef = useRef<any>(null);
    const typingSubscriptionRef = useRef<any>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Get user profile info
    const [userProfile, setUserProfile] = useState<{
        id: string;
        type: 'patient' | 'doctor';
        name: string;
        avatar?: string;
    } | null>(null);

    // Fetch user profile on mount
    useEffect(() => {
        if (!user) return;

        const fetchUserProfile = async () => {
            try {
                // Try patient first
                const { data: patientData } = await supabase
                    .from('patients')
                    .select('id, full_name, profile_picture_url')
                    .eq('auth_user_id', user.id)
                    .single();

                if (patientData) {
                    setUserProfile({
                        id: patientData.id,
                        type: 'patient',
                        name: patientData.full_name,
                        avatar: patientData.profile_picture_url
                    });
                    return;
                }

                // Try doctor
                const { data: doctorData } = await supabase
                    .from('doctors')
                    .select('id, full_name, profile_picture_url')
                    .eq('auth_user_id', user.id)
                    .single();

                if (doctorData) {
                    setUserProfile({
                        id: doctorData.id,
                        type: 'doctor',
                        name: doctorData.full_name,
                        avatar: doctorData.profile_picture_url
                    });
                }
            } catch (err) {
                console.error('Error fetching user profile:', err);
            }
        };

        fetchUserProfile();
    }, [user]);

    // Fetch conversations for the current user
    const fetchConversations = useCallback(async () => {
        if (!userProfile) return;

        try {
            setLoading(true);

            let query = supabase
                .from('chat_conversations')
                .select('*')
                .eq('is_active', true)
                .order('last_message_at', { ascending: false });

            // Filter based on user type
            if (userProfile.type === 'patient') {
                query = query.eq('patient_id', userProfile.id);
            } else {
                query = query.eq('doctor_id', userProfile.id);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Batch patient + doctor lookups into 2 queries total (was 2 per
            // conversation → N+1, the slow load). Build maps and join locally.
            const rows = data || [];
            const patientIds = [...new Set(rows.map((c: any) => c.patient_id).filter(Boolean))];
            const doctorIds = [...new Set(rows.map((c: any) => c.doctor_id).filter(Boolean))];
            const [patsRes, docsRes] = await Promise.all([
                patientIds.length
                    ? supabase.from('patients').select('id, full_name, profile_picture_url').in('id', patientIds)
                    : Promise.resolve({ data: [] as any[] }),
                doctorIds.length
                    ? supabase.from('doctors').select('id, full_name, profile_picture_url').in('id', doctorIds)
                    : Promise.resolve({ data: [] as any[] }),
            ]);
            const patMap = new Map((patsRes.data || []).map((p: any) => [p.id, p]));
            const docMap = new Map((docsRes.data || []).map((d: any) => [d.id, d]));

            const formattedConversations = rows.map((conv: any) => {
                const p = patMap.get(conv.patient_id);
                const d = docMap.get(conv.doctor_id);
                return {
                    ...conv,
                    patient_name: p?.full_name,
                    patient_avatar: p?.profile_picture_url,
                    doctor_name: d?.full_name,
                    doctor_avatar: d?.profile_picture_url,
                };
            });

            setConversations(formattedConversations);
        } catch (err) {
            console.error('Error fetching conversations:', err);
            setError('Failed to load conversations');
        } finally {
            setLoading(false);
        }
    }, [userProfile]);

    // Fetch messages for a specific conversation
    const fetchMessages = useCallback(async (convId: string) => {
        if (!userProfile) return;

        try {
            setLoading(true);

            const { data: messagesData, error: messagesError } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('conversation_id', convId)
                .order('created_at', { ascending: true });

            if (messagesError) throw messagesError;

            // A 1:1 chat has only two senders. Batch ALL patient + doctor names in
            // 2 queries total (was one query PER message → the slow load).
            const rows = messagesData || [];
            const patientIds = [...new Set(rows.filter((m: any) => m.sender_type === 'patient').map((m: any) => m.sender_id))];
            const doctorIds = [...new Set(rows.filter((m: any) => m.sender_type === 'doctor').map((m: any) => m.sender_id))];
            const [patsRes, docsRes] = await Promise.all([
                patientIds.length
                    ? supabase.from('patients').select('id, full_name, profile_picture_url').in('id', patientIds)
                    : Promise.resolve({ data: [] as any[] }),
                doctorIds.length
                    ? supabase.from('doctors').select('id, full_name, profile_picture_url').in('id', doctorIds)
                    : Promise.resolve({ data: [] as any[] }),
            ]);
            const patMap = new Map((patsRes.data || []).map((p: any) => [p.id, p]));
            const docMap = new Map((docsRes.data || []).map((d: any) => [d.id, d]));

            const formattedMessages = rows.map((msg: any) => {
                const info = msg.sender_type === 'patient' ? patMap.get(msg.sender_id) : docMap.get(msg.sender_id);
                return {
                    ...msg,
                    sender_name: info?.full_name || 'Unknown',
                    sender_avatar: info?.profile_picture_url || '',
                };
            });

            setMessages(formattedMessages);

            // Mark messages as read
            await markMessagesAsRead(convId);
        } catch (err) {
            console.error('Error fetching messages:', err);
            setError('Failed to load messages');
        } finally {
            setLoading(false);
        }
    }, [userProfile]);

    // Get or create conversation
    const getOrCreateConversation = useCallback(async (patientId: string, doctorId: string) => {
        try {
            const { data, error } = await supabase.rpc('get_or_create_conversation', {
                p_patient_id: patientId,
                p_doctor_id: doctorId
            });

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Error getting/creating conversation:', JSON.stringify(err, null, 2));
            throw err;
        }
    }, []);

    // Send message
    const sendMessage = useCallback(async (
        convId: string,
        content: string,
        messageType: 'text' | 'image' | 'file' | 'voice' = 'text',
        fileData?: {
            url: string;
            name: string;
            size: number;
            mimeType: string;
        }
    ) => {
        if (!userProfile || !content.trim()) return;

        // Create optimistic message
        const optimisticMessage = {
            id: `temp-${Date.now()}`,
            conversation_id: convId,
            sender_type: userProfile.type,
            sender_id: userProfile.id,
            message_type: messageType,
            content: content,
            file_url: fileData?.url || null,
            file_name: fileData?.name || null,
            file_size: fileData?.size || null,
            mime_type: fileData?.mimeType || null,
            is_read: false,
            is_delivered: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sender_name: userProfile.name,
            sender_avatar: userProfile.avatar
        };

        // Add optimistic message immediately
        setMessages(prev => [...prev, optimisticMessage]);

        try {
            setSending(true);

            const { data, error } = await supabase.rpc('send_chat_message', {
                p_conversation_id: convId,
                p_sender_type: userProfile.type,
                p_sender_id: userProfile.id,
                p_content: content,
                p_message_type: messageType,
                p_file_url: fileData?.url || null,
                p_file_name: fileData?.name || null,
                p_file_size: fileData?.size || null,
                p_mime_type: fileData?.mimeType || null
            });

            if (error) throw error;

            if (!data.success) {
                throw new Error(data.error || 'Failed to send message');
            }

            // Update the optimistic message with the real message ID
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === optimisticMessage.id
                        ? { ...msg, id: data.message_id, is_delivered: true }
                        : msg
                )
            );

            // Stop typing indicator
            await updateTypingStatus(convId, false);

            return data.message_id;
        } catch (err) {
            console.error('Error sending message:', err);

            // Remove optimistic message on error
            setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));

            toast({
                title: "Failed to send message",
                description: err instanceof Error ? err.message : "Please try again",
                variant: "destructive"
            });
            throw err;
        } finally {
            setSending(false);
        }
    }, [userProfile, toast]);

    // Mark messages as read
    const markMessagesAsRead = useCallback(async (convId: string) => {
        if (!userProfile) return;

        try {
            await supabase.rpc('mark_messages_as_read', {
                p_conversation_id: convId,
                p_user_type: userProfile.type,
                p_user_id: userProfile.id
            });
        } catch (err) {
            console.error('Error marking messages as read:', err);
        }
    }, [userProfile]);

    // Update typing status
    const updateTypingStatus = useCallback(async (convId: string, isTyping: boolean) => {
        if (!userProfile) return;

        try {
            await supabase.rpc('update_typing_status', {
                p_conversation_id: convId,
                p_user_type: userProfile.type,
                p_user_id: userProfile.id,
                p_is_typing: isTyping
            });
        } catch (err) {
            console.error('Error updating typing status:', err);
        }
    }, [userProfile]);

    // Handle typing with debounce
    const handleTyping = useCallback((convId: string) => {
        if (!userProfile) return;

        updateTypingStatus(convId, true);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set typing to false after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            updateTypingStatus(convId, false);
        }, 2000);
    }, [userProfile, updateTypingStatus]);

    // Set up real-time subscriptions
    useEffect(() => {
        if (!conversationId || !userProfile) return;

        // Subscribe to new messages
        const messageChannel = supabase
            .channel(`messages-${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                async (payload) => {
                    if (payload.eventType !== 'INSERT') return;

                    const newMessage = payload.new as any;

                    // Get sender information
                    let senderName = 'Unknown';
                    let senderAvatar = '';

                    if (newMessage.sender_type === 'patient') {
                        const { data: patientData } = await supabase
                            .from('patients')
                            .select('full_name, profile_picture_url')
                            .eq('id', newMessage.sender_id)
                            .single();

                        if (patientData) {
                            senderName = patientData.full_name;
                            senderAvatar = patientData.profile_picture_url;
                        }
                    } else if (newMessage.sender_type === 'doctor') {
                        const { data: doctorData } = await supabase
                            .from('doctors')
                            .select('full_name, profile_picture_url')
                            .eq('id', newMessage.sender_id)
                            .single();

                        if (doctorData) {
                            senderName = doctorData.full_name;
                            senderAvatar = doctorData.profile_picture_url;
                        }
                    }

                    const formattedMessage = {
                        ...newMessage,
                        sender_name: senderName,
                        sender_avatar: senderAvatar
                    };

                    setMessages(prev => {
                        // Deduplicate by ID
                        if (prev.some(msg => msg.id === formattedMessage.id)) return prev;

                        // Replace matching optimistic message if present
                        const tempIndex = prev.findIndex(msg =>
                            msg.id.startsWith('temp-') &&
                            msg.content === formattedMessage.content &&
                            msg.sender_id === formattedMessage.sender_id &&
                            Math.abs(new Date(msg.created_at).getTime() - new Date(formattedMessage.created_at).getTime()) < 5000
                        );

                        if (tempIndex !== -1) {
                            const next = [...prev];
                            next[tempIndex] = formattedMessage;
                            return next;
                        }

                        return [...prev, formattedMessage];
                    });

                    // Mark as read if not from current user
                    if (newMessage.sender_id !== userProfile.id) {
                        markMessagesAsRead(conversationId);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    const updatedMessage = payload.new as any;
                    setMessages(prev =>
                        prev.map(msg =>
                            msg.id === updatedMessage.id
                                ? { ...msg, ...updatedMessage }
                                : msg
                        )
                    );
                }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.error('Message subscription error for conversation:', conversationId);
                } else if (status === 'TIMED_OUT') {
                    console.error('Message subscription timed out for conversation:', conversationId);
                }
            });

        messageSubscriptionRef.current = messageChannel;

        // Subscribe to typing indicators
        const typingChannel = supabase
            .channel(`typing-${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_typing_indicators',
                    filter: `conversation_id=eq.${conversationId}`
                },
                async (payload) => {
                    const indicator = payload.new as any;

                    // Don't show typing indicator for current user
                    if (indicator && indicator.user_id === userProfile.id) return;

                    // Get user name for typing indicator
                    let userName = 'Someone';
                    if (indicator) {
                        if (indicator.user_type === 'patient') {
                            const { data: patientData } = await supabase
                                .from('patients')
                                .select('full_name')
                                .eq('id', indicator.user_id)
                                .single();
                            userName = patientData?.full_name || 'Patient';
                        } else {
                            const { data: doctorData } = await supabase
                                .from('doctors')
                                .select('full_name')
                                .eq('id', indicator.user_id)
                                .single();
                            userName = doctorData?.full_name || 'Doctor';
                        }
                    }

                    setTypingIndicators(prev => {
                        const filtered = prev.filter(t =>
                            !(t.conversation_id === indicator?.conversation_id &&
                                t.user_id === indicator?.user_id)
                        );

                        if (indicator && indicator.is_typing) {
                            return [...filtered, { ...indicator, user_name: userName }];
                        } else {
                            return filtered;
                        }
                    });
                }
            )
            .subscribe();

        typingSubscriptionRef.current = typingChannel;

        // Cleanup subscriptions
        return () => {
            if (messageSubscriptionRef.current) {
                supabase.removeChannel(messageSubscriptionRef.current);
            }
            if (typingSubscriptionRef.current) {
                supabase.removeChannel(typingSubscriptionRef.current);
            }
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [conversationId, userProfile, markMessagesAsRead]);

    // Fetch conversations on mount
    useEffect(() => {
        if (userProfile) {
            fetchConversations();
        }
    }, [userProfile, fetchConversations]);

    // Fetch messages when conversation changes
    useEffect(() => {
        if (conversationId) {
            fetchMessages(conversationId);

            // Find and set current conversation
            const conv = conversations.find(c => c.id === conversationId);
            setCurrentConversation(conv || null);
        }
    }, [conversationId, fetchMessages, conversations]);

    return {
        // Data
        messages,
        conversations,
        currentConversation,
        typingIndicators,
        userProfile,

        // State
        loading,
        sending,
        error,

        // Actions
        sendMessage,
        fetchConversations,
        fetchMessages,
        getOrCreateConversation,
        markMessagesAsRead,
        handleTyping,
        updateTypingStatus,

        // Utils
        isTyping: typingIndicators.some(t => t.conversation_id === conversationId),
        typingUsers: typingIndicators
            .filter(t => t.conversation_id === conversationId)
            .map(t => t.user_name || 'Someone')
    };
};
