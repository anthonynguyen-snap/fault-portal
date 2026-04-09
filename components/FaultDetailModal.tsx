"use client";
import { useEffect, useRef } from "react";
import type { FaultEntry } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { STATUS_OPTIONS } from "@/lib/types";

interface Props {
  fault: FaultEntry;
  onClose: () => void;
  onStatusChange: (faultId: string, newStatus: string) => Promise<void>;
}

export function FaultDetailModal({ fault, onClose, onStatusChange }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function isImage(url: string) {
    return /\.(jpg|jpeg|png|gif|webp|heic)/i.test(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdrop}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* ── Modal Header ── */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between rounded-t-2xl">
          <div>
            <p className="text-xs text-gray-400 font-mono mb-0.5">{fault.id}</p>
            <h2 className="text-lg font-bold text-gray-900">{fault.customerName}</h2>
            <p className="text-sm text-gray-500">Order: <span className="font-mono font-semibold">{fault.orderNumber}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={fault.status} />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ── Status update ── */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Update Status:</span>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(fault.id, s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    fault.status === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ── Detail grid ── */}
          <div className="grid grid-cols-2 gap-3">
            <Detail label="Fault Date"   value={fault.faultDate} />
            <Detail label="Submitted At" value={new Date(fault.submittedAt).toLocaleString("en-AU")} />
            <Detail label="Product"      value={fault.productName} />
            <Detail label="Manufacturer" value={fault.manufacturer} />
            <Detail label="Fault Type"   value={fault.faultType} />
            <Detail label="Staff Member" value={fault.staffMember} />
            {fault.internalCost && (
              <Detail label="Internal Cost" value={`$${parseFloat(fault.internalCost).toFixed(2)}`} />
            )}
          </div>

          {/* ── Description ── */}
          {fault.description && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes / Description</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap border border-gray-200">
                {fault.description}
              </p>
            </div>
          )}

          {/* ── Evidence ── */}
          {fault.evidenceUrls.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Evidence ({fault.evidenceUrls.length} file{fault.evidenceUrls.length !== 1 ? "s" : ""})
              </p>
              <div className="space-y-2">
                {fault.evidenceUrls.map((url, i) => {
                  const fileName = url.split("/").pop()?.split("?")[0] ?? `File ${i + 1}`;
                  return (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 hover:bg-blue-50 hover:border-blue-300 transition-colors group"
                    >
                      <span className="text-xl">{isImage(url) ? "🖼" : "🎥"}</span>
                      <span className="text-sm text-gray-700 group-hover:text-blue-700 truncate flex-1">{fileName}</span>
                      <span className="text-xs text-blue-500 shrink-0">Open ↗</span>
                    </a>
                  );
                })}
              </div>

              {fault.driveFolderUrl && (
                <a
                  href={fault.driveFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                >
                  📁 View Drive folder ↗
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value || "—"}</p>
    </div>
  );
}
