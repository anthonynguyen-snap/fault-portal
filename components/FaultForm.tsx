"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FAULT_TYPES } from "@/lib/types";
import { useAuth } from "@/components/auth/AuthProvider";

interface Props {
  staffName?: string;
}

interface FormState {
  faultDate: string;
  orderNumber: string;
  customerName: string;
  productName: string;
  manufacturer: string;
  faultType: string;
  description: string;
  internalCost: string;
  staffMember: string;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function FaultForm({ staffName = "" }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // Staff always use their own name; admin can type freely
  const resolvedName = isAdmin ? staffName : (user?.name ?? staffName);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    faultDate:    today(),
    orderNumber:  "",
    customerName: "",
    productName:  "",
    manufacturer: "",
    faultType:    FAULT_TYPES[0],
    description:  "",
    internalCost: "",
    staffMember:  resolvedName,
  });

  const [files, setFiles]         = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);

  function setField(k: keyof FormState, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const oversized = selected.filter((f) => f.size > 100 * 1024 * 1024);
    if (oversized.length > 0) {
      setError(`"${oversized[0].name}" is over 100 MB. Please choose a smaller file.`);
      return;
    }
    setFiles(selected);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!form.orderNumber.trim()) { setError("Order number is required."); return; }
    if (!form.customerName.trim()) { setError("Customer name is required."); return; }
    if (!form.productName.trim()) { setError("Product name is required."); return; }
    if (!form.staffMember.trim()) { setError("Staff member name is required."); return; }

    setSubmitting(true);

    try {
      // ── Step 1: Upload evidence files ──
      const evidenceUrls: string[] = [];
      let driveFolderUrl = "";

      if (files.length > 0) {
        setUploading(true);
        for (let i = 0; i < files.length; i++) {
          const fd = new FormData();
          fd.append("file", files[i]);
          fd.append("orderNumber", form.orderNumber || "UNKNOWN");

          const res = await fetch("/api/upload", { method: "POST", body: fd });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "File upload failed");
          }

          const data = await res.json();
          evidenceUrls.push(data.fileUrl);
          driveFolderUrl = data.folderUrl;
          setUploadProgress(Math.round(((i + 1) / files.length) * 100));
        }
        setUploading(false);
      }

      // ── Step 2: Submit fault record ──
      const payload = { ...form, evidenceUrls, driveFolderUrl };
      const res = await fetch("/api/faults", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save fault");
      }

      setSuccess(true);

      // Reset after 3 seconds and redirect to dashboard
      setTimeout(() => {
        setSuccess(false);
        setForm({ ...form, orderNumber: "", customerName: "", productName: "", description: "", internalCost: "", faultDate: today() });
        setFiles([]);
        setUploadProgress(0);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setUploading(false);
    } finally {
      setSubmitting(false);
    }
  }

  const isLoading = submitting || uploading;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Card 1: Basic Info ── */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-base border-b pb-2">Case Details</h2>

          <div>
            <label className="label">Date of Fault <span className="text-red-500">*</span></label>
            <input type="date" className="input-field" required
              value={form.faultDate} onChange={(e) => setField("faultDate", e.target.value)} />
          </div>

          <div>
            <label className="label">Order Number <span className="text-red-500">*</span></label>
            <input type="text" className="input-field" placeholder="e.g. ORD-12345" required
              value={form.orderNumber} onChange={(e) => setField("orderNumber", e.target.value)} />
          </div>

          <div>
            <label className="label">Customer Name <span className="text-red-500">*</span></label>
            <input type="text" className="input-field" placeholder="Full name" required
              value={form.customerName} onChange={(e) => setField("customerName", e.target.value)} />
          </div>

          <div>
            <label className="label">Staff Member <span className="text-red-500">*</span></label>
            {isAdmin ? (
              <input type="text" className="input-field" placeholder="Your name" required
                value={form.staffMember} onChange={(e) => setField("staffMember", e.target.value)} />
            ) : (
              <div className="input-field bg-slate-50 text-slate-700 cursor-default select-none">
                {form.staffMember || '—'}
              </div>
            )}
          </div>

          <div>
            <label className="label">Internal Cost (optional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" className="input-field pl-7"
                placeholder="0.00"
                value={form.internalCost} onChange={(e) => setField("internalCost", e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Card 2: Product Info ── */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-base border-b pb-2">Product & Fault</h2>

          <div>
            <label className="label">Product Name <span className="text-red-500">*</span></label>
            <input type="text" className="input-field" placeholder="e.g. Cordless Drill 18V" required
              value={form.productName} onChange={(e) => setField("productName", e.target.value)} />
          </div>

          <div>
            <label className="label">Manufacturer <span className="text-red-500">*</span></label>
            <input type="text" className="input-field" placeholder="e.g. Makita" required
              value={form.manufacturer} onChange={(e) => setField("manufacturer", e.target.value)} />
          </div>

          <div>
            <label className="label">Fault Type <span className="text-red-500">*</span></label>
            <select className="input-field" required
              value={form.faultType} onChange={(e) => setField("faultType", e.target.value)}>
              {FAULT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Notes / Description</label>
            <textarea
              className="input-field resize-none"
              rows={4}
              placeholder="Describe the fault in detail — what the customer reported, any observations..."
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Evidence Upload ── */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-gray-800 text-base border-b pb-2">
          Evidence Upload <span className="text-gray-400 font-normal text-sm">(optional)</span>
        </h2>

        <p className="text-sm text-gray-500">
          Attach photos or videos of the fault. Files are automatically uploaded to Google Drive in a monthly folder.
          Max 100 MB per file.
        </p>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFiles}
          className="block w-full text-sm text-gray-500
            file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
            file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100 transition-colors cursor-pointer"
        />

        {files.length > 0 && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 divide-y divide-gray-200">
            {files.map((f) => (
              <div key={f.name} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-700 truncate">{f.name}</span>
                <span className="text-gray-400 ml-3 shrink-0">
                  {(f.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
            ))}
          </div>
        )}

        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Uploading evidence to Google Drive...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Error / Success ── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠ {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 font-medium">
          ✅ Fault logged successfully! The record has been saved to Google Sheets.
        </div>
      )}

      {/* ── Submit ── */}
      <div className="flex gap-3">
        <button type="submit" disabled={isLoading} className="btn-primary">
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {uploading ? "Uploading files..." : "Saving..."}
            </>
          ) : (
            "Submit Fault"
          )}
        </button>

        <button type="button" className="btn-secondary"
          onClick={() => router.push("/dashboard")} disabled={isLoading}>
          Cancel
        </button>
      </div>
    </form>
  );
}
