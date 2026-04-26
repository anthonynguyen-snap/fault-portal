import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon size={26} className="text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-800 mb-1">{title}</p>
      {description && (
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
