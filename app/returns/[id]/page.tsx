'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Mail, Save, CheckCircle, ExternalLink } from 'lucide-react';
import { Return, ReturnStatus, FollowUpStatus } from '@/types';

const STATUS_OPTIONS: ReturnStatus[] = ['Received', 'Inspected', 'Processed', 'Closed'];
const FOLLOW_UP_OPTIONS: FollowUpStatus[] = ['N/A', 'Pending', 'Completed'];

function badge(label: string, className: string) {
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}>{label}</span>;
}

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Return | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState<FollowUpStatus>('N/A');
  const [status, setStatus] = useState<ReturnStatus>('Received');
  const [refundAmount, setRefundAmount] = useState<string>('');

  useEffect(() => {
    fetch(`/api/returns/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          setData(json.data);
          setFollowUpNotes(json.data.followUpNotes || '');
          setFollowUpStatus(json.data.followUpStatus || 'N/A');
          setStatus(json.data.status || 'Received');
          setRefundAmount(json.data.refundAmount > 0 ? String(json.data.refundAmount) : '');
        }
        setLoading(false);
      });
  }, [id]);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/returns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followUpNotes, followUpStatus, status, refundAmount: parseFloat(refundAmount) || 0 }),
    });
    const json = await res.json();
    if (json.data) { setData(json.data); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setSaving(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="text-center py-20 text-slate-500">Return not found. <Link href="/returns" className="text-brand-600 hover:underline">Back to returns</Link></div>
  );

  const conditionColour: Record<string, string> = {
    'Sealed':                  'bg-blue-100 text-blue-700',
    'Open - Good Condition':   'bg-emerald-100 text-emerald-700',
    'Open - Damaged Packaging':'bg-amber-100 text-amber-700',
    'Faulty':                  'bg-red-100 text-red-700',
  };
  const decisionColour: Record<string, string> = {
    'Full Refund':              'bg-emerald-100 text-emerald-700',
    'Exchange':                 'bg-blue-100 text-blue-700',
    'Refund + Restocking Fee':  'bg-amber-100 text-amber-700',
    'Refund - Return Label Fee':'bg-orange-100 text-orange-700',
    'Replacement':              'bg-purple-100 text-purple-700',
    'Pending':                  'bg-slate-100 text-slate-600',
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/returns" className="btn-ghost -ml-2 mb-4 inline-flex">
        <ChevronLeft size={16} /> Back to Returns
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">{data.id}</h1>
          <p className="text-slate-400 text-sm">Received {data.date} · Order {data.orderNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          {badge(data.condition, conditionColour[data.condition] || 'bg-slate-100 text-slate-600')}
          {badge(data.decision, decisionColour[data.decision] || 'bg-slate-100 text-slate-600')}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — details */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Customer</h3>
            <p className="font-medium text-slate-900">{data.customerName}</p>
            {data.customerEmail && (
              <a href={`mailto:${data.customerEmail}`}
                className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline mt-1">
                <Mail size={13} />{data.customerEmail}
              </a>
            )}
            <p className="text-sm text-slate-500 mt-2">Order: <span className="font-mono font-medium text-slate-700">{data.orderNumber}</span></p>
            <p className="text-sm text-slate-500">Product: <span className="font-medium text-slate-700">{data.product}</span></p>
            {data.conversationLink && (
              <a href={data.conversationLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-brand-600 hover:underline font-medium">
                <ExternalLink size={13} /> View Conversation
              </a>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Inspection Notes</h3>
            {data.notes ? (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{data.notes}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">No inspection notes recorded.</p>
            )}
            {data.restockingFee > 0 && (
              <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-medium text-amber-700">{data.restockingFee}% restocking fee applied</p>
              </div>
            )}
            {data.processedBy && (
              <p className="text-xs text-slate-400 mt-3">Processed by {data.processedBy}</p>
            )}
          </div>

          {/* Follow-up notes — editable by team */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Follow-up Notes</h3>
            {data.assignedTo && (
              <p className="text-xs text-slate-400 mb-3">Assigned to <span className="font-medium text-slate-600">{data.assignedTo}</span></p>
            )}
            <textarea
              value={followUpNotes}
              onChange={e => setFollowUpNotes(e.target.value)}
              rows={4}
              placeholder="Add follow-up notes here — what was communicated to the customer, next steps..."
              className="form-input resize-none text-sm"
            />
          </div>
        </div>

        {/* Right — status */}
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Return Status</h3>
            <div className="space-y-1.5">
              {STATUS_OPTIONS.map(s => (
                <button key={s} type="button"
                  onClick={() => setStatus(s)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm text-left font-medium transition-all ${
                    status === s ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Follow-up Status</h3>
            <div className="space-y-1.5">
              {FOLLOW_UP_OPTIONS.map(f => (
                <button key={f} type="button"
                  onClick={() => setFollowUpStatus(f)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm text-left font-medium transition-all ${
                    followUpStatus === f ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Refund Amount</h3>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
                placeholder="0.00"
                className="form-input pl-7 text-sm"
              />
            </div>
            {data.refundAmount > 0 && refundAmount === '' && (
              <p className="text-xs text-slate-400 mt-1.5">Currently: ${data.refundAmount.toFixed(2)}</p>
            )}
          </div>

          <button onClick={save} disabled={saving}
            className={`w-full btn-primary flex items-center justify-center gap-2 ${saved ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
          >
            {saved ? <><CheckCircle size={15} />Saved</> : saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</> : <><Save size={15} />Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
