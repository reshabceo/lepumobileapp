import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import {
  ArrowLeft,
  Receipt,
  Video,
  Phone,
  Stethoscope,
  Siren,
  FileSearch,
  Mic,
  Keyboard,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  CreditCard,
  ArrowUpDown,
  Filter,
  X,
  Download,
} from "lucide-react";

interface Invoice {
  id: string;
  invoice_number: string;
  payment_type: string;
  amount_paise: number;
  currency: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  reference_id: string | null;
  description: string | null;
  doctor_name: string | null;
  status: string;
  paid_at: string;
  created_at: string;
}

type FilterTab = "all" | "appointments" | "ai_doctor" | "emergency" | "radiologist";
type SortField = "paid_at" | "amount_paise" | "payment_type";
type SortDir = "asc" | "desc";

const TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ElementType }> = {
  appointment_video: { label: "Video Consultation", color: "text-blue-300", bgColor: "bg-blue-900/40", borderColor: "border-blue-500/30", icon: Video },
  appointment_audio: { label: "Audio Consultation", color: "text-indigo-300", bgColor: "bg-indigo-900/40", borderColor: "border-indigo-500/30", icon: Phone },
  ai_doctor_text: { label: "AI Doctor – Text", color: "text-emerald-300", bgColor: "bg-emerald-900/40", borderColor: "border-emerald-500/30", icon: Keyboard },
  ai_doctor_voice: { label: "AI Doctor – Voice", color: "text-teal-300", bgColor: "bg-teal-900/40", borderColor: "border-teal-500/30", icon: Mic },
  emergency: { label: "Emergency", color: "text-red-300", bgColor: "bg-red-900/40", borderColor: "border-red-500/30", icon: Siren },
  radiologist_review: { label: "Radiologist Review", color: "text-purple-300", bgColor: "bg-purple-900/40", borderColor: "border-purple-500/30", icon: FileSearch },
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "appointments", label: "Appointments" },
  { key: "ai_doctor", label: "AI Doctor" },
  { key: "emergency", label: "Emergency" },
  { key: "radiologist", label: "Radiologist" },
];

function formatAmount(paise: number, currency: string): string {
  const rupees = paise / 100;
  if (currency === "INR") {
    return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${currency} ${rupees.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function filterMatches(type: string, tab: FilterTab): boolean {
  if (tab === "all") return true;
  if (tab === "appointments") return type === "appointment_video" || type === "appointment_audio";
  if (tab === "ai_doctor") return type === "ai_doctor_text" || type === "ai_doctor_voice";
  if (tab === "emergency") return type === "emergency";
  if (tab === "radiologist") return type === "radiologist_review";
  return true;
}

const PatientInvoices: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [sortField, setSortField] = useState<SortField>("paid_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadInvoices();
  }, [user]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("auth_user_id", user!.id)
        .single();

      if (!patient) {
        toast({ title: "Error", description: "Patient profile not found", variant: "destructive" });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("payment_invoices")
        .select("*")
        .eq("patient_id", patient.id)
        .order("paid_at", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err: any) {
      console.error("Failed to load invoices:", err);
      toast({ title: "Error", description: "Failed to load invoices", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = invoices.filter((inv) => filterMatches(inv.payment_type, activeTab));

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === "paid_at") {
      cmp = new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime();
    } else if (sortField === "amount_paise") {
      cmp = a.amount_paise - b.amount_paise;
    } else {
      cmp = a.payment_type.localeCompare(b.payment_type);
    }
    return sortDir === "desc" ? -cmp : cmp;
  });

  const totalAmount = filtered.reduce((sum, inv) => sum + inv.amount_paise, 0);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const downloadInvoicePdf = async (inv: Invoice) => {
    try {
      setDownloadingId(inv.id);
      const config = TYPE_CONFIG[inv.payment_type] || TYPE_CONFIG.emergency;
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      let y = 20;

      // Header
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("MonitraQ", margin, y);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text("Healthcare Platform", margin, y + 6);

      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text("INVOICE", pageWidth - margin, y, { align: "right" });
      y += 20;

      // Divider
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 12;

      // Invoice details - left column
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80);
      doc.text("Invoice Number", margin, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text(inv.invoice_number, margin, y + 5);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(80);
      doc.text("Date", margin, y + 14);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text(`${formatDate(inv.paid_at)} at ${formatTime(inv.paid_at)}`, margin, y + 19);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(80);
      doc.text("Status", margin, y + 28);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text(inv.status === "paid" ? "PAID" : "REFUNDED", margin, y + 33);

      // Invoice details - right column
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80);
      doc.text("Service Type", pageWidth / 2, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text(config.label, pageWidth / 2, y + 5);

      if (inv.doctor_name) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(80);
        doc.text("Doctor", pageWidth / 2, y + 14);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        doc.text(
          inv.doctor_name.startsWith("Dr.") ? inv.doctor_name : `Dr. ${inv.doctor_name}`,
          pageWidth / 2, y + 19
        );
      }

      y += 48;

      // Divider
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Description
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Description", margin, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(inv.description || config.label, margin, y);
      y += 14;

      // Amount box
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 20, 3, 3, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Total Amount", margin + 8, y + 13);
      doc.setFontSize(14);
      doc.text(formatAmount(inv.amount_paise, inv.currency), pageWidth - margin - 8, y + 13, { align: "right" });
      y += 30;

      // Payment details
      if (inv.razorpay_payment_id || inv.razorpay_order_id) {
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.setFont("helvetica", "bold");
        doc.text("Payment Details", margin, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        if (inv.razorpay_payment_id) {
          doc.text(`Payment ID: ${inv.razorpay_payment_id}`, margin, y);
          y += 5;
        }
        if (inv.razorpay_order_id) {
          doc.text(`Order ID: ${inv.razorpay_order_id}`, margin, y);
          y += 5;
        }
        y += 8;
      }

      // Footer
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("This is a computer-generated invoice. No signature required.", margin, y);
      doc.text("Powered by MonitraQ Healthcare Platform", margin, y + 4);

      const fileName = `${inv.invoice_number}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const pdfBase64 = doc.output("datauristring").split(",")[1];
        await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Documents,
        });
        const uri = await Filesystem.getUri({ path: fileName, directory: Directory.Documents });
        try {
          await Share.share({
            title: `Invoice ${inv.invoice_number}`,
            text: `MonitraQ Invoice - ${config.label}`,
            url: (uri as any).uri || String(uri),
            dialogTitle: "Share Invoice",
          });
        } catch {
          toast({ title: "Saved", description: `Invoice saved to Documents/${fileName}` });
        }
      } else {
        doc.save(fileName);
      }

      toast({ title: "Downloaded", description: `Invoice ${inv.invoice_number} downloaded` });
    } catch (err) {
      console.error("PDF generation error:", err);
      toast({ title: "Error", description: "Failed to download invoice", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D1117] via-[#161B22] to-[#0D1117] text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#161B22]/95 backdrop-blur-md border-b border-[#30363D] px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-lg hover:bg-[#30363D] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Receipt className="w-5 h-5 text-amber-400" />
          <h1 className="text-lg font-bold">Invoices</h1>
          {!loading && (
            <span className="ml-auto text-xs text-gray-400">
              {filtered.length} invoice{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTER_TABS.map((tab) => {
            const count = invoices.filter((inv) => filterMatches(inv.payment_type, tab.key)).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-[#21262D] text-gray-400 border border-[#30363D] hover:text-gray-200"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className="ml-1.5 opacity-70">({count})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary Bar */}
      {!loading && filtered.length > 0 && (
        <div className="mx-4 mb-3 px-4 py-2.5 bg-gradient-to-r from-amber-900/20 to-orange-900/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
          <span className="text-xs text-amber-200/70">Total Paid</span>
          <span className="text-sm font-bold text-amber-300">{formatAmount(totalAmount, "INR")}</span>
        </div>
      )}

      {/* Sort Controls */}
      {!loading && filtered.length > 1 && (
        <div className="px-4 mb-3 flex gap-2 items-center">
          <Filter className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs text-gray-500 mr-1">Sort:</span>
          {([
            { field: "paid_at" as SortField, label: "Date" },
            { field: "amount_paise" as SortField, label: "Amount" },
            { field: "payment_type" as SortField, label: "Type" },
          ]).map(({ field, label }) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                sortField === field
                  ? "bg-[#30363D] text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
              {sortField === field && (
                <ArrowUpDown className="w-3 h-3" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-amber-400" />
            <span className="text-sm">Loading invoices...</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Receipt className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm font-medium mb-1">No invoices found</p>
            <p className="text-xs text-center max-w-xs">
              {activeTab === "all"
                ? "Invoices will appear here after you make a payment."
                : "No invoices in this category yet."}
            </p>
            {activeTab !== "all" && (
              <button
                onClick={() => setActiveTab("all")}
                className="mt-3 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear filter
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((inv) => {
              const config = TYPE_CONFIG[inv.payment_type] || TYPE_CONFIG.emergency;
              const Icon = config.icon;
              const isExpanded = expandedId === inv.id;

              return (
                <div
                  key={inv.id}
                  className={`rounded-xl border transition-all ${config.borderColor} ${config.bgColor} overflow-hidden`}
                >
                  {/* Invoice Card */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                    className="w-full text-left px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-semibold ${config.color}`}>
                            {config.label}
                          </span>
                          <span className="text-sm font-bold text-white">
                            {formatAmount(inv.amount_paise, inv.currency)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 truncate mt-0.5">
                          {inv.description || config.label}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(inv.paid_at)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTime(inv.paid_at)}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              inv.status === "paid"
                                ? "border-green-500/40 text-green-400"
                                : "border-yellow-500/40 text-yellow-400"
                            }`}
                          >
                            {inv.status === "paid" ? "Paid" : "Refunded"}
                          </Badge>
                        </div>
                      </div>
                      <div className="ml-1 text-gray-500">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-[#30363D]/50 pt-3 space-y-2.5">
                      <DetailRow label="Invoice No." value={inv.invoice_number} />
                      {inv.doctor_name && (
                        <DetailRow label="Doctor" value={inv.doctor_name.startsWith("Dr.") ? inv.doctor_name : `Dr. ${inv.doctor_name}`} />
                      )}
                      <DetailRow label="Amount" value={formatAmount(inv.amount_paise, inv.currency)} />
                      <DetailRow label="Date & Time" value={`${formatDate(inv.paid_at)} at ${formatTime(inv.paid_at)}`} />
                      {inv.razorpay_payment_id && (
                        <DetailRow
                          label="Payment ID"
                          value={inv.razorpay_payment_id}
                          mono
                        />
                      )}
                      {inv.razorpay_order_id && (
                        <DetailRow
                          label="Order ID"
                          value={inv.razorpay_order_id}
                          mono
                        />
                      )}
                      <DetailRow label="Status" value={inv.status === "paid" ? "Paid" : "Refunded"} />
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadInvoicePdf(inv); }}
                        disabled={downloadingId === inv.id}
                        className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {downloadingId === inv.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        {downloadingId === inv.id ? "Generating PDF..." : "Download Invoice PDF"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className={`text-xs text-gray-200 text-right break-all ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export default PatientInvoices;
