'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SearchableOption {
  id: number | string;
  name: string;
  subtitle?: string;
}

interface SearchableSelectProps {
  label: string;
  value: number | string | null;
  options: SearchableOption[];
  onChange: (option: SearchableOption | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  hint?: string;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
    .trim();
}

export default function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'اختر من القائمة',
  searchPlaceholder = 'اكتب للبحث...',
  disabled,
  required,
  loading,
  hint,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find(option => String(option.id) === String(value)) || null;

  const filtered = useMemo(() => {
    const query = normalize(search);
    if (!query) return options;
    return options.filter(option => normalize(`${option.name} ${option.subtitle || ''}`).includes(query));
  }, [options, search]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <label className="block text-xs font-bold text-zinc-300">
        {label}{required ? <span className="text-red-400"> *</span> : null}
      </label>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(current => !current)}
        className="swiss-input min-h-11 w-full px-3 py-2 text-right flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-expanded={open}
      >
        <ChevronDown className={`w-4 h-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        <span className={`flex-1 truncate text-sm ${selected ? 'text-zinc-100' : 'text-zinc-500'}`}>
          {loading ? 'جاري التحميل...' : selected?.name || placeholder}
        </span>
        {selected && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            onClick={event => {
              event.stopPropagation();
              onChange(null);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') onChange(null);
            }}
            className="p-1 text-zinc-500 hover:text-zinc-200"
            aria-label={`إزالة ${label}`}
          >
            <X className="w-3.5 h-3.5" />
          </span>
        ) : null}
      </button>
      {hint ? <p className="text-[11px] text-zinc-500">{hint}</p> : null}

      {open && !disabled ? (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-2xl">
          <div className="p-2 border-b border-zinc-800">
            <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5">
              <Search className="w-4 h-4 text-zinc-500" />
              <input
                autoFocus
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">لا توجد نتيجة مطابقة.</div>
            ) : filtered.map(option => {
              const active = String(option.id) === String(value);
              return (
                <button
                  key={String(option.id)}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full rounded-md px-3 py-2.5 text-right flex items-center gap-2 transition-colors ${
                    active ? 'bg-swiss-lavender/15 text-swiss-lavender' : 'text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <span className="w-4 shrink-0">{active ? <Check className="w-4 h-4" /> : null}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{option.name}</span>
                    {option.subtitle ? <span className="block truncate text-[10px] text-zinc-500">{option.subtitle}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
