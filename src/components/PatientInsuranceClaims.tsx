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
  ArrowLeft,
  Loader2,
  FileCheck,
  AlertTriangle,
  RefreshCw
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
  denial_reason: string | null;
  denied_at: string | null;
  resubmit_count: number;
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
          denial_reason,
          denied_at,
          resubmit_count,
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
            tax_amount: taxAmount,
            denial_reason: claim.denial_reason ?? null,
            denied_at: claim.denied_at ?? null,
            resubmit_count: claim.resubmit_count ?? 0,
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
    const statusConfig: Record<string, { icon: React.ReactNode; className: string }> = {
      pending: { icon: <Clock className="h-3 w-3 mr-1" />, className: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30' },
      submitted: { icon: <Clock className="h-3 w-3 mr-1" />, className: 'bg-blue-500/20 text-blue-200 border-blue-500/30' },
      approved: { icon: <CheckCircle2 className="h-3 w-3 mr-1" />, className: 'bg-green-500/20 text-green-200 border-green-500/30' },
      paid: { icon: <CheckCircle2 className="h-3 w-3 mr-1" />, className: 'bg-green-500/20 text-green-200 border-green-500/30' },
      denied: { icon: <XCircle className="h-3 w-3 mr-1" />, className: 'bg-red-500/20 text-red-200 border-red-500/30' },
      rejected: { icon: <XCircle className="h-3 w-3 mr-1" />, className: 'bg-red-500/20 text-red-200 border-red-500/30' },
      processing: { icon: <Clock className="h-3 w-3 mr-1" />, className: 'bg-blue-500/20 text-blue-200 border-blue-500/30' },
    };

    const config = statusConfig[status] ?? statusConfig.pending;

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
      <div className="min-h-screen bg-[#080D1A] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-white/60">Loading claims...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none p-4 pt-safe-top">
      <div className="max-w-4xl mx-auto pb-20">
        {/* Standardized Header */}
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-cyan-900/70 flex items-center justify-center border border-cyan-400/50">
              <FileCheck className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Insurance Claims</h1>
              <p className="text-xs text-gray-400">View your submitted insurance claims and their status</p>
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Claims</p>
                  <p className="text-2xl font-bold text-white">{claims.length}</p>
                </div>
                <FileText className="h-8 w-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Pending</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {claims.filter(c => c.status === 'pending' || c.status === 'submitted').length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Approved</p>
                  <p className="text-2xl font-bold text-green-400">
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
          <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl">
            <CardContent className="py-12 text-center">
              <FileText className="h-16 w-16 text-white/40 mx-auto mb-4" />
              <p className="text-white text-lg mb-2">No Insurance Claims</p>
              <p className="text-gray-400 text-sm">You don't have any insurance claims yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => (
              <Card key={claim.id} className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-white text-lg">Claim #{claim.claim_number}</CardTitle>
                        {getStatusBadge(claim.status)}
                        {isNewClaim(claim.created_at) && (
                          <Badge className="bg-red-500/20 text-red-200 border-red-500/30 animate-pulse">
                            NEW
                          </Badge>
                        )}
                        {claim.resubmit_count > 0 && (
                          <Badge className="bg-blue-500/20 text-blue-200 border-blue-500/30 flex items-center gap-1">
                            <RefreshCw className="h-2.5 w-2.5" /> Resubmitted {claim.resubmit_count}×
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
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
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Insurance Provider</p>
                      <p className="text-white font-medium">{claim.insurance_provider_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Country</p>
                      <p className="text-white font-medium">{claim.country}</p>
                    </div>
                  </div>

                  {/* Diagnosis */}
                  {(claim.primary_diagnosis || claim.diagnosis_codes) && (
                    <div className="mb-4 text-sm">
                      <p className="text-xs text-gray-400 mb-1">Diagnosis</p>
                      <p className="text-white font-medium">
                        {claim.primary_diagnosis || (claim.diagnosis_codes && claim.diagnosis_codes.length > 0 ? claim.diagnosis_codes.join(', ') : 'Not specified')}
                      </p>
                    </div>
                  )}

                  {/* Expanded Details */}
                  {expandedClaim === claim.id && (
                    <div className="border-t border-white/10 pt-4 mt-4 space-y-4">
                      {/* Procedures */}
                      <div>
                        <p className="text-sm font-semibold text-white mb-2">Procedures</p>
                        <div className="space-y-2">
                          {claim.procedures.map((proc, idx) => (
                            <div key={idx} className="bg-[#121B32] border border-slate-700/40 rounded-xl p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-white font-semibold">{proc.code}</p>
                                  <p className="text-sm text-gray-400">{proc.description}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Quantity: {proc.quantity}
                                  </p>
                                </div>
                                <p className="text-white font-semibold text-sm">
                                  {getCurrencySymbol(claim.currency)} {proc.unit_charge.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Financial Breakdown */}
                      <div className="bg-[#121B32] border border-slate-700/40 rounded-xl p-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-gray-400">
                            <span>Total Charge:</span>
                            <span className="text-white font-medium">{getCurrencySymbol(claim.currency)} {claim.total_charge.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>Tax:</span>
                            <span className="text-white font-medium">{getCurrencySymbol(claim.currency)} {claim.tax_amount.toFixed(2)}</span>
                          </div>
                          {claim.insurance_payment && (
                            <div className="flex justify-between text-green-400">
                              <span>Insurance Payment:</span>
                              <span className="font-medium">- {getCurrencySymbol(claim.currency)} {claim.insurance_payment.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="border-t border-white/15 pt-2 mt-2">
                            <div className="flex justify-between text-white font-bold text-base">
                              <span>You Pay:</span>
                              <span className="flex items-center text-cyan-400">
                                {getCurrencySymbol(claim.currency)} {claim.patient_due.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Timestamps */}
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <p>Submitted: {formatDate(claim.created_at)}</p>
                        <p>Last Updated: {formatDate(claim.updated_at)}</p>
                      </div>
                    </div>
                  )}

                  {/* Quick Summary */}
                  {expandedClaim !== claim.id && (
                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <span className="text-sm text-gray-400">Amount You Pay:</span>
                      <span className="text-base font-bold text-cyan-400 flex items-center">
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
  );
};

export default PatientInsuranceClaims;

