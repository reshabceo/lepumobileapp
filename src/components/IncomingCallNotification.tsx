import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, X, Video, PhoneCall } from 'lucide-react';

interface IncomingCallNotificationProps {
  doctorName: string;
  callType: 'video' | 'audio';
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallNotification: React.FC<IncomingCallNotificationProps> = ({
  doctorName,
  callType,
  onAccept,
  onDecline
}) => {
  return (
    <div className="fixed top-4 left-4 right-4 z-50 animate-in slide-in-from-top duration-300">
      <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-2xl border-0">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                {callType === 'video' ? (
                  <Video className="w-6 h-6" />
                ) : (
                  <PhoneCall className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="font-semibold text-lg">{doctorName}</p>
                <p className="text-sm text-blue-100">
                  Incoming {callType} call
                </p>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <Button
              className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              onClick={onDecline}
            >
              <X className="w-4 h-4 mr-2" />
              Decline
            </Button>
            <Button
              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
              onClick={onAccept}
            >
              <Phone className="w-4 h-4 mr-2" />
              Accept
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default IncomingCallNotification;
