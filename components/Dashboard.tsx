"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { FaultEntry } from "@/lib/types";
import { FaultDetailModal } from "./FaultDetailModal";
import { StatusBadge } from "./StatusBadge";

export function Dashboard() {
  const [faults, setFaults]     = useState<FaultEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [filterStatus, setFilterStatus]     = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState("");
  const [filterFaultType, setFilterFaultType]       = useState("");
  const [selected, setSelected] = useState<FaultEntry | null>(null);

  const fetchFaults = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/faults");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setFaults(data);
    } catch {
      setError("Could not load faults. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFaults(); }, [fetchFaults]);

  // ── Derived filter options ──
  const manufacturers = Array.from(new Set(faults.map((f) => f.manufacturer).filter(Boolean))).sort();
  const faultTypes    = Array.from(new Set(faults.map((f) => f.faultType).filter(Boolean))).sort();

  // ── Filtered list ──
  const visible = faults.filter((f) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      f.orderNumber?.toLowerCase().includes(q) ||
      f.customerName?.toLowerCase().includes(q) ||
      f.productName?.toLowerCase().includes(q) ||
      f.description?.toLowerCase().includes(q) ||
      f.staffMember?.toLowerCase().includes(q);

    return (
      matchSearch &&
      (!filterStatus        || f.status === filterStatus) &&
      (!filterManufacturer  || f.manufacturer === filterManufacturer) &&
      (!filterFaultType     || f.faultType === filterFaultType)
    );
  });

  // ── Summary stats ──
  const stats = {
    total:    faults.length,
    open:     faults.filter((f) => f.status === "Open").length,
    progress: faults.filter((f) => f.status === "In Progress").length,
    resolved: faults.filter((f) => f.status === "Resolved").length,
  };

  async function handleStatusChange(faultId: string, newStatus: string) {
    await fetch("/api/faults", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ faultId, status: newStatus }),
    });
    setFaults((prev) =>
      prev.map((f) => (f.id === faultId ? { ...f, status: newStatus } : f))
    );
    if (selected?.id === faultId) setSelected((s) => s ? { ...s, status: newStatus } : s);
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fault Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">All submitted fault cases</p>
        </div>
        <Link href="/new" className="btn-primary">
          + Log New Fault
        </Link>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Cases", value: stats.total, color: "text-gray-700", bg: "bg-gray-50 border-gray-200" },
          { label: "Open",        value: stats.open,     color: "text-blue-700",  bg: "bg-blue-50 border-blue-200" },
          { label: "In Progress", value: stats.progress, color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
          { label: "Resolved",    value: stats.resolved, color: "text-green-700", bg: "bg-green-50 border-green-200" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search order #, customer, product..."
            className="input-field flex-1 min-w-48"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input-field w-40" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option>Open</option>
            <option>In Progress</option>
            <option>Resolved</option>
          </select>
          <select className="input-field w-44" value={filterManufacturer} onChange={(e) => setFilterManufacturer(e.target.value)}>
            <option value="">All Manufacturers</option>
            {manufacturers.map((m) => <option key={m}>{m}</option>)}
          </select>
          <select className="input-field w-44" value={filterFaultType} onChange={(e) => setFilterFaultType(e.target.value)}>
            <option value="">All Fault Types</option>
            {faultTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
          <button onClick={fetchFaults} className="btn-secondary">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading faults...
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-600 text-sm">{error}</div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-medium">{faults.length === 0 ? "No faults logged yet." : "No results match your filters."}</p>
            {faults.length === 0 && (
              <Link href="/new" className="mt-4 inline-block btn-primary text-sm">Log your first fault</Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Date", "Order #", "Customer", "Product", "Manufacturer", "Fault Type", "Staff", "Status", "Evidence"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((fault) => (
                  <tr
                    key={fault.id}
                    onClick={() => setSelected(fault)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fault.faultDate}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800 whitespace-nowrap">{fault.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-700">{fault.customerName}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-36 truncate" title={fault.productName}>{fault.productName}</td>
                    <td className="px-4 py-3 text-gray-600">{fault.manufacturer}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fault.faultType}</td>
                    <td className="px-4 py-3 text-gray-600">{fault.staffMember}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={fault.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {fault.evidenceUrls.length > 0 ? (
                        <span className="text-blue-500 font-medium">📎 {fault.evidenceUrls.length}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Showing {visible.length} of {faults.length} fault{faults.length !== 1 ? "s" : ""}
        {" · "}Data synced from Google Sheets
      </p>

      {/* ── Detail Modal ── */}
      {selected && (
        <FaultDetailModal
          fault={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
