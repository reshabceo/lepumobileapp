import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usePatientChat } from '@/hooks/usePatientChat';
import { PatientChatThread } from '@/components/PatientChatThread';
import { ArrowLeft, MessageSquare } from 'lucide-react';

export default function PatientMessages() {
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const { conversations, loading, refreshConversations } = usePatientChat(patientId, activeConv);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: row } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (!cancelled) setPatientId(row?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!patientId) {
    return (
      <div className="min-h-screen bg-[#101010] text-white flex items-center justify-center p-4">
        <p className="text-gray-400">Sign in as a patient to view messages.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101010] text-white">
      <div className="flex items-center gap-3 p-4 border-b border-gray-800">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <MessageSquare className="w-6 h-6 text-emerald-400" />
        <h1 className="text-lg font-semibold">Doctor messages</h1>
      </div>

      <div className="flex flex-col md:flex-row md:h-[calc(100vh-64px)]">
        <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-gray-800 overflow-y-auto max-h-[40vh] md:max-h-none">
          {loading && conversations.length === 0 ? (
            <p className="p-4 text-gray-500">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-gray-500">No conversations yet. Your doctor will appear here.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveConv(c.id)}
                className={`w-full text-left p-4 border-b border-gray-800 hover:bg-gray-900/80 ${
                  activeConv === c.id ? 'bg-emerald-900/30' : ''
                }`}
              >
                <div className="font-medium">{c.doctor_name || 'Doctor'}</div>
                <div className="text-sm text-gray-400 truncate">{c.last_message_preview || '—'}</div>
                {c.unread_count_patient > 0 && (
                  <span className="inline-block mt-1 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                    {c.unread_count_patient} new
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="flex-1 min-h-[50vh] md:min-h-0">
          {activeConv ? (
            <PatientChatThread
              conversationId={activeConv}
              patientId={patientId}
              onSent={refreshConversations}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 p-8">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
