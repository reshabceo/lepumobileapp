import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { FileText, Clock, CheckCircle, Eye, Microscope, ArrowLeft, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RadiologistRequest {
  id: string;
  patient_name: string;
  study_instance_uid: string;
  modality: string;
  body_part_examined: string;
  request_type: string;
  priority: string;
  status: string;
  symptoms: string;
  clinical_history: string;
  specific_questions: string;
  requested_at: string;
  has_report: boolean;
  report_status: string | null;
  study_id: string;
}

export default function RadiologistDashboard() {
  const navigate = useNavigate();
  const [radiologist, setRadiologist] = useState<any>(null);
  const [requests, setRequests] = useState<RadiologistRequest[]>([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRadiologistProfile();
    fetchRequests();

    const subscription = supabase
      .channel('radiologist_requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'radiologist_requests'
      }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchRadiologistProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('radiologists')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (data) setRadiologist(data);
  };

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('radiologist_assigned_requests_view')
      .select('*')
      .order('requested_at', { ascending: false });

    if (data) setRequests(data);
    if (error) toast.error('Failed to load requests');
    setLoading(false);
  };

  const updateRequestStatus = async (requestId: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    
    if (newStatus === 'in_review') {
      updates.started_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('radiologist_requests')
      .update(updates)
      .eq('id', requestId);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    toast.success(`Status updated to ${newStatus}`);
    fetchRequests();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      default: return 'secondary';
    }
  };

  const filterRequests = (status: string) => {
    switch (status) {
      case 'pending':
        return requests.filter(r => r.status === 'assigned');
      case 'active':
        return requests.filter(r => r.status === 'in_review');
      case 'completed':
        return requests.filter(r => r.status === 'completed');
      default:
        return requests;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/radiologist-auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Microscope className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold">Radiologist</h1>
              {radiologist && (
                <p className="text-xs text-muted-foreground">
                  Dr. {radiologist.full_name}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 p-4">
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">
              {requests.filter(r => r.status === 'assigned').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pending</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">
              {requests.filter(r => r.status === 'in_review').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">
              {requests.filter(r => r.status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Done</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests Tabs */}
      <div className="px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="text-xs">
              Pending ({requests.filter(r => r.status === 'assigned').length})
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs">
              Active ({requests.filter(r => r.status === 'in_review').length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">
              Done ({requests.filter(r => r.status === 'completed').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {loading ? (
              <div className="text-center py-12">Loading...</div>
            ) : filterRequests(activeTab).length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground text-sm">
                    No {activeTab} requests
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 pb-20">
                {filterRequests(activeTab).map((request) => (
                  <Card key={request.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-sm">
                              {request.patient_name}
                            </CardTitle>
                            <Badge variant={getPriorityColor(request.priority)} className="text-xs">
                              {request.priority}
                            </Badge>
                          </div>
                          <CardDescription className="text-xs mt-1">
                            {request.modality} • {request.body_part_examined}
                          </CardDescription>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(request.requested_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {request.symptoms && (
                        <div>
                          <p className="text-xs font-medium mb-1">Symptoms:</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {request.symptoms}
                          </p>
                        </div>
                      )}
                      
                      {request.clinical_history && (
                        <div>
                          <p className="text-xs font-medium mb-1">History:</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {request.clinical_history}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          className="flex-1 text-xs h-8"
                          onClick={() => {
                            // Note: On mobile, this would need a mobile-optimized DICOM viewer
                            toast.info('Opening DICOM viewer...');
                            // navigate(`/dicom-viewer/${request.study_id}`);
                          }}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1 text-xs h-8"
                          onClick={() => {
                            toast.info('Opening report editor...');
                            // navigate(`/radiologist-report/${request.id}`);
                          }}
                        >
                          <FileText className="mr-1 h-3 w-3" />
                          {request.has_report ? 'Edit' : 'Report'}
                        </Button>
                      </div>

                      {request.status === 'assigned' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-8"
                          onClick={() => updateRequestStatus(request.id, 'in_review')}
                        >
                          Start Review
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

