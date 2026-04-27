import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PatientChatMessage {
  id: string;
  conversation_id: string;
  sender_type: 'patient' | 'doctor';
  sender_id: string;
  message_type: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

export interface PatientChatConversation {
  id: string;
  patient_id: string;
  doctor_id: string;
  last_message_at: string;
  last_message_preview?: string;
  unread_count_patient: number;
  doctor_name?: string;
}

export function usePatientChat(patientId: string | null, conversationId?: string | null) {
  const [conversations, setConversations] = useState<PatientChatConversation[]>([]);
  const [messages, setMessages] = useState<PatientChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      const enriched = await Promise.all(
        (data || []).map(async (c: any) => {
          const { data: doc } = await supabase
            .from('doctors')
            .select('full_name')
            .eq('id', c.doctor_id)
            .maybeSingle();
          return { ...c, doctor_name: doc?.full_name };
        })
      );
      setConversations(enriched as PatientChatConversation[]);
    } catch (e) {
      console.error('usePatientChat conversations', e);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const fetchMessages = useCallback(
    async (convId: string) => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });
        if (error) throw error;

        const formatted = await Promise.all(
          (data || []).map(async (m: any) => {
            let sender_name = 'Unknown';
            if (m.sender_type === 'doctor') {
              const { data: d } = await supabase
                .from('doctors')
                .select('full_name')
                .eq('id', m.sender_id)
                .maybeSingle();
              sender_name = d?.full_name || 'Doctor';
            } else {
              const { data: p } = await supabase
                .from('patients')
                .select('full_name')
                .eq('id', m.sender_id)
                .maybeSingle();
              sender_name = p?.full_name || 'You';
            }
            return { ...m, sender_name };
          })
        );
        setMessages(formatted as PatientChatMessage[]);

        await supabase.rpc('mark_messages_as_read', {
          p_conversation_id: convId,
          p_user_type: 'patient',
          p_user_id: patientId,
        });
      } catch (e) {
        console.error('usePatientChat messages', e);
      } finally {
        setLoading(false);
      }
    },
    [patientId]
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!conversationId || !patientId) return;

    fetchMessages(conversationId);

    const ch = supabase
      .channel(`patient-chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const row = payload.new as any;
          let sender_name = 'Unknown';
          if (row.sender_type === 'doctor') {
            const { data: d } = await supabase
              .from('doctors')
              .select('full_name')
              .eq('id', row.sender_id)
              .maybeSingle();
            sender_name = d?.full_name || 'Doctor';
          } else {
            const { data: p } = await supabase
              .from('patients')
              .select('full_name')
              .eq('id', row.sender_id)
              .maybeSingle();
            sender_name = p?.full_name || 'You';
          }
          const msg = { ...row, sender_name } as PatientChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
      )
      .subscribe();

    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [conversationId, patientId, fetchMessages]);

  const sendMessage = useCallback(
    async (convId: string, content: string) => {
      if (!patientId || !content.trim()) return;
      setSending(true);
      try {
        const { data, error } = await supabase.rpc('send_chat_message', {
          p_conversation_id: convId,
          p_sender_type: 'patient',
          p_sender_id: patientId,
          p_content: content.trim(),
          p_message_type: 'text',
          p_file_url: null,
          p_file_name: null,
          p_file_size: null,
          p_mime_type: null,
        });
        if (error) throw error;
        if (data && !data.success) throw new Error(data.error || 'Send failed');
      } finally {
        setSending(false);
      }
    },
    [patientId]
  );

  return {
    conversations,
    messages,
    loading,
    sending,
    refreshConversations: fetchConversations,
    fetchMessages,
    sendMessage,
  };
}

export function usePatientUnreadMessages(patientId: string | null) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!patientId) {
      setUnread(0);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from('chat_conversations')
        .select('unread_count_patient')
        .eq('patient_id', patientId)
        .eq('is_active', true);
      const n = (data || []).reduce((s: number, r: any) => s + (r.unread_count_patient || 0), 0);
      setUnread(n);
    };

    load();

    const ch = supabase
      .channel(`patient-unread-${patientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_conversations' },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (row?.patient_id === patientId) load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [patientId]);

  return unread;
}
