"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, ArrowRight } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface AutocompleteOption {
  id: string;
  name: string;
}

interface AutocompleteFieldProps {
  id?: string;
  label?: string;
  placeholder?: string;
  value: AutocompleteOption | null;
  onChange: (option: AutocompleteOption | null) => void;
  searchFn: (query: string) => Promise<AutocompleteOption[]>;
  createFn: (name: string) => Promise<AutocompleteOption | null>;
  disabled?: boolean;
}

export function AutocompleteField({
  id,
  label,
  placeholder,
  value,
  onChange,
  searchFn,
  createFn,
  disabled,
}: AutocompleteFieldProps) {
  const [text, setText] = useState(value?.name || "");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedText = useDebouncedValue(text, 250);

  // Keep the input text in sync when the selection is changed/reset from outside
  useEffect(() => {
    setText(value?.name || "");
  }, [value?.id]);

  const trimmed = text.trim();
  const isCurrentSelection = !!value && value.name === trimmed;

  // Fetch options: search when debounced text changes and dropdown is open
  useEffect(() => {
    let cancelled = false;
    const term = debouncedText.trim();

    // If dropdown is not open, do not search or set loading
    if (!open) {
      setLoading(false);
      return;
    }

    // If user has a selected value and hasn't edited the text, do not search
    if (value && value.name.toLowerCase() === term.toLowerCase()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    searchFn(term)
      .then((results) => {
        if (!cancelled) setOptions(results);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedText, open, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const exactMatch = options.find(
    (o) => o.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const showAddOption =
    trimmed.length > 0 && !exactMatch && !loading && !isCurrentSelection;

  type Row = { type: "option"; option: AutocompleteOption } | { type: "add" };
  const rows: Row[] = [
    ...options.map((option): Row => ({ type: "option", option })),
    ...(showAddOption ? ([{ type: "add" }] as Row[]) : []),
  ];

  // Show dropdown whenever opened, unless exact selection is already set and not typing
  const showDropdown = open && (!isCurrentSelection || rows.length > 0);

  function selectOption(option: AutocompleteOption) {
    setLoading(false);
    onChange(option);
    setText(option.name);
    setOpen(false);
  }

  async function handleAdd() {
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const created = await createFn(trimmed);
      if (created) {
        setJustAdded(created.name);
        toast.success(`"${created.name}" added successfully!`);
        selectOption(created);
        setTimeout(() => setJustAdded(null), 3500);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create item");
    } finally {
      setCreating(false);
    }
  }

  function handleSelectRow(row: Row) {
    if (row.type === "option") selectOption(row.option);
    else void handleAdd();
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center justify-between mb-2">
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block"
          >
            {label}
          </label>
        )}
        {justAdded && (
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in duration-300">
            <ArrowRight className="w-3 h-3 text-emerald-500" />
            Added &quot;{justAdded}&quot;
          </span>
        )}
      </div>

      <div className="relative">
        <input
          id={id}
          type="text"
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            setLoading(true);
            searchFn(trimmed)
              .then(setOptions)
              .finally(() => setLoading(false));
          }}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setHighlighted(0);
            if (value) onChange(null);
          }}
          onKeyDown={(e) => {
            if (!showDropdown || rows.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((h) => Math.min(h + 1, rows.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const row = rows[highlighted];
              if (row) handleSelectRow(row);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className={cn(
            "w-full bg-foreground/5 border rounded-xl px-4 py-2.5 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand transition disabled:opacity-60",
            justAdded
              ? "border-emerald-500 ring-2 ring-emerald-500/20"
              : "border-foreground/10",
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : value ? (
            <Check className="w-4 h-4 text-emerald-500 transition-colors" />
          ) : loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </div>

      {showDropdown && (
        <div className="absolute z-20 mt-1.5 w-full max-h-64 overflow-y-auto rounded-xl border border-[var(--pos-stroke)] bg-[var(--pos-panel)] shadow-xl">
          {rows.length === 0 && !loading && (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              {trimmed
                ? "No matches found. Press Add below to create."
                : "No saved records found. Type a name to add one."}
            </div>
          )}
          {rows.map((row, index) => (
            <button
              key={row.type === "option" ? row.option.id : "__add__"}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectRow(row)}
              className={cn(
                "w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition",
                index === highlighted
                  ? "bg-[var(--pos-brand)]/10 text-foreground font-medium"
                  : "text-foreground/80 hover:bg-foreground/5",
              )}
            >
              {row.type === "option" ? (
                <span className="truncate">{row.option.name}</span>
              ) : (
                <div className="flex items-center gap-2 text-[var(--pos-brand-text)] font-semibold">
                  <Plus className="w-4 h-4 text-[var(--pos-brand)] shrink-0" />
                  <span>Add &quot;{trimmed}&quot; to database</span>
                </div>
              )}
              {row.type === "option" && value?.id === row.option.id && (
                <Check className="w-4 h-4 text-[var(--pos-brand)] shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
