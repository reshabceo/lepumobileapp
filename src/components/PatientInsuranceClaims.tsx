import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  DollarSign, 
  Calendar,
  User,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Claim {
  id: string;
  claim_number: string;
  service_date: string;
  primary_diagnosis: string | null;
  diagnosis_codes: string[] | null;
  total_charge: number;
  insurance_payment: number | null;
  patient_due: number;
  status: string;
  currency: string;
  country: string;
  tax_amount: number;
  doctor_name: string;
  insurance_provider_name: string;
  procedures: {
    code: string;
    description: string;
    quantity: number;
    unit_charge: number;
  }[];
  created_at: string;
  updated_at: string;
}

const PatientInsuranceClaims = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    try {
      setLoading(true);
      
      // Get current patient
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: 'Error',
          description: 'Please login to view claims',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Resolve auth UID → patients.id
      const { data: patientRow } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!patientRow) {
        setLoading(false);
        return;
      }

      // Get insurance claims for this patient with billing info
      const { data: claimsData, error: claimsError } = await supabase
        .from('insurance_claims')
        .select(`
          id,
          claim_number,
          service_date,
          primary_diagnosis,
          diagnosis_codes,
          total_charge,
          insurance_payment,
          status,
          currency,
          country,
          created_at,
          updated_at,
          patient_insurance_id,
          doctors!doctor_id(full_name)
        `)
        .eq('patient_id', patientRow.id)
        .order('created_at', { ascending: false });

      if (claimsError) {
        console.error('Error loading claims:', claimsError);
        toast({
          title: 'Error',
          description: 'Failed to load insurance claims',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Get procedures, insurance provider, and billing details for each claim
      const claimsWithDetails = await Promise.all(
        (claimsData || []).map(async (claim: any) => {
          let procedures: any[] = [];
          let insuranceProviderName = 'Unknown Provider';
          let patientDue = 0;
          let taxAmount = 0;
          
          // Try to load procedures
          try {
            const { data: proceduresData, error: proceduresError } = await supabase
              .from('claim_procedures')
              .select(`
                procedure_codes!procedure_code_id(code, description),
                quantity,
                unit_charge
              `)
              .eq('claim_id', claim.id);

            if (!proceduresError && proceduresData) {
              procedures = proceduresData.map((p: any) => ({
                code: p.procedure_codes?.code || 'N/A',
                description: p.procedure_codes?.description || 'N/A',
                quantity: p.quantity || 1,
                unit_charge: p.unit_charge || 0
              }));
            }
          } catch (error) {
            console.warn('Could not load procedures for claim:', claim.id, error);
          }

          // Try to load insurance provider through patient_insurance
          if (claim.patient_insurance_id) {
            try {
              const { data: patientInsurance } = await supabase
                .from('patient_insurance')
                .select(`
                  insurance_providers!provider_id(name)
                `)
                .eq('id', claim.patient_insurance_id)
                .single();

              if (patientInsurance?.insurance_providers) {
                const providers: any = patientInsurance.insurance_providers;
                insuranceProviderName = providers.name || 'Unknown Provider';
              }
            } catch (error) {
              console.warn('Could not load insurance provider for claim:', claim.id, error);
            }
          }

          // Get patient billing info (patient_due and tax_amount)
          try {
            const { data: billingData } = await supabase
              .from('patient_billing')
              .select('patient_due, tax_amount')
              .eq('claim_id', claim.id)
              .single();

            if (billingData) {
              patientDue = billingData.patient_due || 0;
              taxAmount = billingData.tax_amount || 0;
            }
          } catch (error) {
            console.warn('Could not load billing for claim:', claim.id, error);
            // If no billing record, estimate from claim
            patientDue = claim.total_charge || 0;
            taxAmount = 0;
          }

          return {
            ...claim,
            doctor_name: claim.doctors?.full_name || 'Unknown Doctor',
            insurance_provider_name: insuranceProviderName,
            procedures: procedures,
            patient_due: patientDue,
            tax_amount: taxAmount
          };
        })
      );

      setClaims(claimsWithDetails);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load claims',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        icon: <Clock className="h-3 w-3 mr-1" />,
        className: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30'
      },
      approved: {
        icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
        className: 'bg-green-500/20 text-green-200 border-green-500/30'
      },
      rejected: {
        icon: <XCircle className="h-3 w-3 mr-1" />,
        className: 'bg-red-500/20 text-red-200 border-red-500/30'
      },
      processing: {
        icon: <Clock className="h-3 w-3 mr-1" />,
        className: 'bg-blue-500/20 text-blue-200 border-blue-500/30'
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <Badge variant="outline" className={`${config.className} flex items-center w-fit`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getCurrencySymbol = (currency: string) => {
    return currency === 'INR' ? '₹' : 'AED';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isNewClaim = (createdAt: string) => {
    const claimDate = new Date(createdAt);
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    return claimDate > twentyFourHoursAgo;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading claims...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-950">
      {/* Header with Back Button */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="relative flex items-center justify-between p-4 pt-safe-top">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 text-white bg-blue-600 hover:bg-blue-700 transition-colors touch-manipulation rounded-lg"
            style={{ minHeight: '40px', minWidth: '70px' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-semibold text-white">Insurance Claims</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="p-6 pb-20">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <p className="text-emerald-200/80">View your submitted insurance claims and their status</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-200/80">Total Claims</p>
                  <p className="text-2xl font-bold text-white">{claims.length}</p>
                </div>
                <FileText className="h-8 w-8 text-emerald-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-200/80">Pending</p>
                  <p className="text-2xl font-bold text-yellow-200">
                    {claims.filter(c => c.status === 'pending' || c.status === 'submitted').length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-200/80">Approved</p>
                  <p className="text-2xl font-bold text-green-200">
                    {claims.filter(c => c.status === 'approved' || c.status === 'paid').length}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Claims List */}
          {claims.length === 0 ? (
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="py-12 text-center">
              <FileText className="h-16 w-16 text-white/40 mx-auto mb-4" />
              <p className="text-white text-lg mb-2">No Insurance Claims</p>
              <p className="text-emerald-200/60">You don't have any insurance claims yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => (
              <Card key={claim.id} className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-white">Claim #{claim.claim_number}</CardTitle>
                        {getStatusBadge(claim.status)}
                        {isNewClaim(claim.created_at) && (
                          <Badge className="bg-red-500/20 text-red-200 border-red-500/30 animate-pulse">
                            NEW
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-emerald-200/80">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(claim.service_date)}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          Dr. {claim.doctor_name}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedClaim(expandedClaim === claim.id ? null : claim.id)}
                      className="text-white hover:bg-white/10"
                    >
                      {expandedClaim === claim.id ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Summary Info */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-emerald-200/60 mb-1">Insurance Provider</p>
                      <p className="text-white">{claim.insurance_provider_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-emerald-200/60 mb-1">Country</p>
                      <p className="text-white">{claim.country}</p>
                    </div>
                  </div>

                  {/* Diagnosis */}
                  {(claim.primary_diagnosis || claim.diagnosis_codes) && (
                    <div className="mb-4">
                      <p className="text-xs text-emerald-200/60 mb-1">Diagnosis</p>
                      <p className="text-white">
                        {claim.primary_diagnosis || (claim.diagnosis_codes && claim.diagnosis_codes.length > 0 ? claim.diagnosis_codes.join(', ') : 'Not specified')}
                      </p>
                    </div>
                  )}

                  {/* Expanded Details */}
                  {expandedClaim === claim.id && (
                    <div className="border-t border-white/10 pt-4 mt-4 space-y-4">
                      {/* Procedures */}
                      <div>
                        <p className="text-sm font-semibold text-emerald-200 mb-2">Procedures</p>
                        <div className="space-y-2">
                          {claim.procedures.map((proc, idx) => (
                            <div key={idx} className="bg-white/5 rounded p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-white font-medium">{proc.code}</p>
                                  <p className="text-sm text-emerald-200/70">{proc.description}</p>
                                  <p className="text-xs text-emerald-200/50 mt-1">
                                    Quantity: {proc.quantity}
                                  </p>
                                </div>
                                <p className="text-white font-medium">
                                  {getCurrencySymbol(claim.currency)} {proc.unit_charge.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Financial Breakdown */}
                      <div className="bg-emerald-500/10 rounded-lg p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-emerald-200/80">
                            <span>Total Charge:</span>
                            <span>{getCurrencySymbol(claim.currency)} {claim.total_charge.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-200/80">
                            <span>Tax:</span>
                            <span>{getCurrencySymbol(claim.currency)} {claim.tax_amount.toFixed(2)}</span>
                          </div>
                          {claim.insurance_payment && (
                            <div className="flex justify-between text-green-200">
                              <span>Insurance Payment:</span>
                              <span>- {getCurrencySymbol(claim.currency)} {claim.insurance_payment.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="border-t border-white/20 pt-2 mt-2">
                            <div className="flex justify-between text-white font-bold text-lg">
                              <span>You Pay:</span>
                              <span className="flex items-center">
                                <DollarSign className="h-5 w-5 mr-1" />
                                {getCurrencySymbol(claim.currency)} {claim.patient_due.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Timestamps */}
                      <div className="text-xs text-emerald-200/50">
                        <p>Submitted: {formatDate(claim.created_at)}</p>
                        <p>Last Updated: {formatDate(claim.updated_at)}</p>
                      </div>
                    </div>
                  )}

                  {/* Quick Summary */}
                  {expandedClaim !== claim.id && (
                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <span className="text-sm text-emerald-200/70">Amount You Pay:</span>
                      <span className="text-lg font-bold text-white flex items-center">
                        <DollarSign className="h-4 w-4 mr-1" />
                        {getCurrencySymbol(claim.currency)} {claim.patient_due.toFixed(2)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default PatientInsuranceClaims;

