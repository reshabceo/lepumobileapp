import { useState } from 'react';
import { usePatientChat } from '@/hooks/usePatientChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  conversationId: string;
  patientId: string;
  onSent?: () => void;
}

export function PatientChatThread({ conversationId, patientId, onSent }: Props) {
  const { messages, loading, sending, sendMessage, fetchMessages } = usePatientChat(
    patientId,
    conversationId
  );
  const [text, setText] = useState('');

  const onSend = async () => {
    if (!text.trim()) return;
    await sendMessage(conversationId, text);
    setText('');
    onSent?.();
    await fetchMessages(conversationId);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && messages.length === 0 ? (
          <p className="text-gray-500 text-sm">Loading messages…</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.sender_type === 'patient'
                  ? 'ml-auto bg-emerald-700 text-white'
                  : 'mr-auto bg-gray-800 text-gray-100'
              }`}
            >
              <div className="text-xs opacity-70 mb-1">{m.sender_name}</div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))
        )}
      </div>
      <div className="p-3 border-t border-gray-800 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="bg-gray-900 border-gray-700 text-white"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSend();
          }}
        />
        <Button type="button" onClick={onSend} disabled={sending}>
          Send
        </Button>
      </div>
    </div>
  );
}
