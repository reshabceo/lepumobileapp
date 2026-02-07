import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { payAndFulfil } from '@/lib/payment';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { User, DollarSign, Clock, Send, Star } from 'lucide-react';

interface RequestRadiologistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyId: string;
  studyInfo: {
    modality: string;
    body_part_examined: string;
  };
}

interface Radiologist {
  id: string;
  full_name: string;
  specialization: string[];
  years_experience: number;
  hospital: string;
  report_fee: number;
  currency: string;
  completed_requests: number;
  active_requests: number;
}

export default function RequestRadiologistModal({ 
  open, 
  onOpenChange, 
  studyId, 
  studyInfo 
}: RequestRadiologistModalProps) {
  const [radiologists, setRadiologists] = useState<Radiologist[]>([]);
  const [selectedRadiologist, setSelectedRadiologist] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    request_type: 'report',
    priority: 'normal',
    symptoms: '',
    clinical_history: '',
    specific_questions: ''
  });

  useEffect(() => {
    if (open) {
      fetchRadiologists();
    }
  }, [open]);

  const fetchRadiologists = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('available_radiologists')
      .select('*')
      .order('completed_requests', { ascending: false });

    if (data) setRadiologists(data);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!selectedRadiologist) {
      toast.error('Please select a radiologist');
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Not authenticated');
      setSubmitting(false);
      return;
    }

    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!patient) {
      toast.error('Patient profile not found');
      setSubmitting(false);
      return;
    }

    const selectedRad = radiologists.find(r => r.id === selectedRadiologist);
    const quotedFee = selectedRad?.report_fee ?? 0;
    // report_fee is in rupees; Razorpay expects paise
    const amountPaise = Math.round(Number(quotedFee) * 100);
    if (amountPaise < 100) {
      toast.error('Invalid radiologist fee');
      setSubmitting(false);
      return;
    }

    const requestPayload = {
      patient_id: patient.id,
      radiologist_id: selectedRadiologist,
      study_id: studyId,
      ...formData,
      quoted_fee: quotedFee,
      status: 'assigned'
    };

    try {
      await payAndFulfil({
        type: 'radiologist_review',
        amount_paise: amountPaise,
        metadata: { request: requestPayload },
        onSuccess: () => {
          toast.success('Request sent successfully! Radiologist will review your study.');
          onOpenChange(false);
          setSelectedRadiologist(null);
          setFormData({
            request_type: 'report',
            priority: 'normal',
            symptoms: '',
            clinical_history: '',
            specific_questions: ''
          });
        },
        onError: (err) => toast.error(err.message || 'Payment or request failed'),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-base">Request Radiologist</DialogTitle>
          <DialogDescription className="text-xs">
            {studyInfo.modality} • {studyInfo.body_part_examined}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 pr-4">
            {/* Request Details */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="request_type" className="text-sm">Type</Label>
                <Select
                  value={formData.request_type}
                  onValueChange={(value) => setFormData({ ...formData, request_type: value })}
                >
                  <SelectTrigger id="request_type" className="text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="report">Full Report</SelectItem>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="second_opinion">Second Opinion</SelectItem>
                    <SelectItem value="urgent_review">Urgent Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority" className="text-sm">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger id="priority" className="text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="symptoms" className="text-sm">Symptoms</Label>
                <Textarea
                  id="symptoms"
                  value={formData.symptoms}
                  onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                  placeholder="Your symptoms..."
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div>
                <Label htmlFor="clinical_history" className="text-sm">Clinical History</Label>
                <Textarea
                  id="clinical_history"
                  value={formData.clinical_history}
                  onChange={(e) => setFormData({ ...formData, clinical_history: e.target.value })}
                  placeholder="Medical history..."
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div>
                <Label htmlFor="specific_questions" className="text-sm">Questions</Label>
                <Textarea
                  id="specific_questions"
                  value={formData.specific_questions}
                  onChange={(e) => setFormData({ ...formData, specific_questions: e.target.value })}
                  placeholder="Specific questions..."
                  rows={2}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Select Radiologist */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Select Radiologist</h3>
              {loading ? (
                <div className="text-center py-8 text-sm">Loading...</div>
              ) : radiologists.length === 0 ? (
                <Card>
                  <CardContent className="py-6">
                    <div className="text-center text-sm text-muted-foreground">
                      No radiologists available
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {radiologists.slice(0, 5).map((rad) => (
                    <Card
                      key={rad.id}
                      className={`cursor-pointer transition-all ${
                        selectedRadiologist === rad.id
                          ? 'border-primary ring-1 ring-primary'
                          : ''
                      }`}
                      onClick={() => setSelectedRadiologist(rad.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-xs flex items-center gap-1">
                                Dr. {rad.full_name}
                                {rad.completed_requests > 50 && (
                                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                )}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                {rad.specialization.slice(0, 2).join(', ')}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-bold whitespace-nowrap">
                            <DollarSign className="h-3 w-3" />
                            {rad.report_fee}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {rad.years_experience}y
                          </span>
                          <span>•</span>
                          <span className="truncate">{rad.hospital}</span>
                        </div>
                        <div className="flex gap-1 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {rad.completed_requests} done
                          </Badge>
                          {rad.active_requests > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {rad.active_requests} active
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!selectedRadiologist || submitting}
          >
            {submitting ? (
              <>Opening payment...</>
            ) : (
              <>
                <Send className="mr-1 h-3 w-3" />
                Pay & Request {selectedRadiologist && radiologists.find(r => r.id === selectedRadiologist) && (
                  <span className="ml-1">(₹{radiologists.find(r => r.id === selectedRadiologist)!.report_fee})</span>
                )}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

