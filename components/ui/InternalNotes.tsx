'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { InternalNote } from '@/types';

interface InternalNotesProps {
  notes: InternalNote[];
  onAdd: (text: string) => Promise<void>;
  entityLabel?: string; // e.g. "case", "return", "refund request"
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// Consistent colour per author name
const AVATAR_COLOURS = [
  'bg-brand-100 text-brand-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
];
function avatarColour(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length];
}

export function InternalNotes({ notes, onAdd, entityLabel = 'item' }: InternalNotesProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when notes change
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onAdd(text.trim());
      setText('');
      textareaRef.current?.focus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        <MessageSquare size={15} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">Internal Notes</h3>
        {notes.length > 0 && (
          <span className="ml-auto text-xs text-slate-400">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Notes timeline */}
      <div className={`px-5 ${notes.length > 0 ? 'py-4 space-y-4 max-h-72 overflow-y-auto' : 'py-3'}`}>
        {notes.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No notes yet. Add the first note for this {entityLabel}.</p>
        ) : (
          notes.map(note => (
            <div key={note.id} className="flex items-start gap-3">
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${avatarColour(note.author)}`}>
                {initials(note.author)}
              </div>
              {/* Bubble */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-700">{note.author}</span>
                  <span className="text-[10px] text-slate-400">{timeAgo(note.createdAt)}</span>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {note.text}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={listEndRef} />
      </div>

      {/* Composer */}
      <div className="px-5 pb-5 pt-3 border-t border-slate-100">
        <form onSubmit={handleSubmit}>
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Add an internal note… (⌘↵ to submit)"
              className="form-input resize-none text-sm flex-1"
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={!text.trim() || submitting}
              className="btn-primary px-3 py-2 flex-shrink-0 self-end"
              title="Add note (⌘↵)"
            >
              {submitting
                ? <Loader2 size={15} className="animate-spin" />
                : <Send size={15} />
              }
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-600 mt-1.5">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
