"use client";
import { useEffect, useId, useRef, useState } from "react";
import { api, friendlyError, type GeoSuggestion } from "@/lib/api";
import { ProvenanceBadge } from "@/components/Provenance";

/** Accessible location autocomplete backed by /api/geo/suggest (Nominatim).
 *
 * Debounced 300ms, keyboard operable (↑/↓/Enter/Esc), aria-combobox pattern.
 * US-biased search (countrycodes=us, accept-language=en-US).
 * Suggestions are candidates only — the chosen label fills the input, and
 * users can always ignore them and type freely.
 * Query capped at 120 chars; stale requests cancelled.
 */
export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  hasError,
  describedBy,
}: {
  value: string;
  onChange: (label: string) => void;
  onSelect?: (s: GeoSuggestion) => void;
  hasError?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<GeoSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);
  const chosenRef = useRef("");

  useEffect(() => {
    const q = value.trim();
    // Skip re-querying for a value the user just picked from the list, or
    // anything too long to be a sensible search (server caps at 120 too).
    if (q.length < 3 || q.length > 120 || q === chosenRef.current) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      if (q !== chosenRef.current) setNote("");
      return;
    }
    const seq = ++seqRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.geoSuggest(q);
        if (seq !== seqRef.current) return; // stale reply — newer typing won
        if (r.status === "ok") {
          setItems(r.suggestions);
          setActive(-1);
          setOpen(r.suggestions.length > 0);
          setNote(
            r.suggestions.length === 0 && !r.note
              ? "No US place matches yet — keep typing or pick a spot on the map below."
              : r.note,
          );
        } else {
          setItems([]);
          setOpen(false);
          setNote(r.note);
        }
      } catch (err) {
        if (seq !== seqRef.current) return;
        setItems([]);
        setOpen(false);
        setNote(friendlyError(err));
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(s: GeoSuggestion) {
    chosenRef.current = s.label;
    onChange(s.label);
    onSelect?.(s);
    setItems([]);
    setOpen(false);
    setActive(-1);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        id="loc"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        maxLength={120}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        placeholder="e.g. East Austin, TX"
        className="w-full rounded-input border border-line bg-surface px-3 py-2"
        aria-invalid={!!hasError}
        aria-describedby={describedBy}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Place suggestions from OpenStreetMap"
        className={
          "absolute z-30 mt-1 w-full overflow-hidden rounded-[12px] border border-line bg-surface shadow-lg " +
          (open && items.length > 0 ? "" : "hidden")
        }
      >
        {items.map((s, i) => (
          <li key={`${s.lat},${s.lon},${i}`} role="option" aria-selected={i === active}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={
                "block w-full px-3 py-2 text-left text-[14px] " +
                (i === active ? "bg-[rgba(37,99,235,0.08)]" : "")
              }
            >
              <span className="block truncate font-medium">{s.label}</span>
              <span className="text-[12px] text-secondary">
                <ProvenanceBadge kind="geo" /> place suggestion
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="mt-1 min-h-[18px] text-[12px] text-secondary">
        {loading ? "Looking up places…" : note}
      </p>
    </div>
  );
}
