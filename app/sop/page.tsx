'use client';

import { useState, useEffect, useRef } from 'react';
import { BookOpen, ChevronRight, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import {
  SOP_META,
  SOP_SECTIONS,
  SOP_TOP_LEVEL,
  getSubsections,
  type SOPBlock,
  type SOPSection,
} from '@/lib/sop';
import { useAuth } from '@/components/auth/AuthProvider';

// ── Inline text renderer (bold, code, links) ───────────────────────────────
function InlineText({ text }: { text: string }) {
  // Split on **bold**, `code`, and plain text
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="text-[11px] font-mono bg-slate-100 text-slate-700 px-1 py-0.5 rounded">
              {part.slice(1, -1)}
            </code>
          );
        }
        // Render URLs as links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        if (urlRegex.test(part)) {
          return (
            <span key={i}>
              {part.split(urlRegex).map((seg, j) =>
                seg.match(/^https?:\/\//) ? (
                  <a
                    key={j}
                    href={seg}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    {seg} <ExternalLink size={10} className="flex-shrink-0" />
                  </a>
                ) : seg
              )}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Block renderer ─────────────────────────────────────────────────────────
function BlockRenderer({ block }: { block: SOPBlock }) {
  switch (block.type) {
    case 'p':
      return (
        <p className="text-sm text-slate-700 leading-relaxed">
          <InlineText text={block.content} />
        </p>
      );
    case 'h3':
      return (
        <h3 className="text-sm font-bold text-brand-600 uppercase tracking-wide mt-1">
          <InlineText text={block.content} />
        </h3>
      );
    case 'h4':
      return (
        <h4 className="text-sm font-semibold text-slate-800">
          <InlineText text={block.content} />
        </h4>
      );
    case 'info':
      return (
        <div className="flex gap-3 bg-sky-50 border border-sky-200 rounded-lg px-4 py-3">
          <Info size={15} className="text-sky-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-sky-800 leading-relaxed">
            <InlineText text={block.content} />
          </p>
        </div>
      );
    case 'warning':
      return (
        <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            <InlineText text={block.content} />
          </p>
        </div>
      );
    case 'quote':
      return (
        <blockquote className="border-l-4 border-slate-300 pl-4 py-1 bg-slate-50 rounded-r-lg">
          <p className="text-sm text-slate-600 italic leading-relaxed whitespace-pre-line">
            <InlineText text={block.content} />
          </p>
        </blockquote>
      );
    case 'ul':
      return (
        <ul className="space-y-1.5 ml-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0 mt-2" />
              <span><InlineText text={item} /></span>
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="space-y-1.5 ml-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-700 leading-relaxed">
              <span className="text-xs font-bold text-brand-500 flex-shrink-0 w-4 mt-0.5">{i + 1}.</span>
              <span><InlineText text={item} /></span>
            </li>
          ))}
        </ol>
      );
    case 'checklist':
      return (
        <ul className="space-y-1.5 ml-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
              <span className="w-4 h-4 rounded border-2 border-slate-300 flex-shrink-0 mt-0.5" />
              <span><InlineText text={item} /></span>
            </li>
          ))}
        </ul>
      );
    case 'table':
      return (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-white">
                {block.headers.map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-slate-700 align-top">
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

// ── Section renderer ───────────────────────────────────────────────────────
function SectionContent({ section }: { section: SOPSection }) {
  const subsections = getSubsections(section.id);
  const isTop = !section.parentId;

  return (
    <div id={section.id} className={isTop ? 'scroll-mt-6' : 'scroll-mt-4'}>
      {/* Section heading */}
      {isTop ? (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black text-brand-100 font-mono leading-none select-none w-10 flex-shrink-0">
            {section.number}
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
          </div>
        </div>
      ) : (
        <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span className="text-xs font-mono text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded">{section.number}</span>
          {section.title}
        </h3>
      )}

      {/* Blocks */}
      {section.blocks.length > 0 && (
        <div className="space-y-3 mb-4">
          {section.blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      )}

      {/* Subsections */}
      {subsections.length > 0 && (
        <div className="space-y-6 mt-4">
          {subsections.map(sub => (
            <div key={sub.id} id={sub.id} className="pl-4 border-l-2 border-slate-100 scroll-mt-4">
              <SectionContent section={sub} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TOC ────────────────────────────────────────────────────────────────────
function TOC({ activeId }: { activeId: string }) {
  return (
    <nav className="space-y-0.5">
      {SOP_TOP_LEVEL.map(section => {
        const subsections = getSubsections(section.id);
        const isActive = activeId === section.id || subsections.some(s => s.id === activeId);
        return (
          <div key={section.id}>
            <a
              href={`#${section.id}`}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <span className="font-mono text-[10px] w-7 flex-shrink-0 text-slate-400">{section.number}</span>
              <span className="truncate">{section.title}</span>
            </a>
            {isActive && subsections.length > 0 && (
              <div className="ml-9 mt-0.5 space-y-0.5">
                {subsections.map(sub => (
                  <a
                    key={sub.id}
                    href={`#${sub.id}`}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors ${
                      activeId === sub.id
                        ? 'text-brand-600 font-semibold'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <ChevronRight size={10} className="flex-shrink-0" />
                    <span className="truncate">{sub.title}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function SOPPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeId, setActiveId] = useState(SOP_TOP_LEVEL[0]?.id ?? '');
  const contentRef = useRef<HTMLDivElement>(null);

  // Intersection observer to highlight active section in TOC
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    SOP_SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="max-w-7xl mx-auto">

      {/* Header */}
      <div className="page-header mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="page-title">CC&E Standard Operating Procedure</h1>
            <span className="text-[10px] font-bold bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full">
              {SOP_META.version}
            </span>
          </div>
          <p className="page-subtitle">
            Last updated {SOP_META.updated} · Owner: {SOP_META.owner} · Review: {SOP_META.reviewCadence}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 italic">Editing coming soon</span>
          </div>
        )}
      </div>

      <div className="flex gap-6 items-start">

        {/* Sticky TOC sidebar */}
        <aside className="hidden lg:block w-52 flex-shrink-0 sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
          <div className="card p-3">
            <div className="flex items-center gap-2 mb-3 px-2">
              <BookOpen size={13} className="text-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Contents</span>
            </div>
            <TOC activeId={activeId} />
          </div>
        </aside>

        {/* Content */}
        <div ref={contentRef} className="flex-1 min-w-0 space-y-10">
          {/* Intro callout */}
          <div className="card px-5 py-4 border-l-4 border-brand-500">
            <p className="text-sm text-slate-600 italic leading-relaxed">
              This is the operating manual for the CC&E team. It tells you what to do, when to do it, and how to do it well.
              If something in here is wrong or out of date, fix it — don&apos;t work around it.
            </p>
          </div>

          {/* Sections */}
          {SOP_TOP_LEVEL.map((section, i) => (
            <div
              key={section.id}
              className={`card px-6 py-5 ${i < SOP_TOP_LEVEL.length - 1 ? '' : ''}`}
            >
              <SectionContent section={section} />
            </div>
          ))}

          <p className="text-center text-xs text-slate-300 pb-6">
            Confidential — Internal use only · SnapWireless CC&E SOP {SOP_META.version}
          </p>
        </div>

      </div>
    </div>
  );
}
