import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Info, RefreshCw, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxXPRU4bkEFvUUFXoyMKasP1HMxn1XsEJoc9KDczaRLJlgmpkjU1M9oW3ReWqk13wTlnw/exec";

const STUDIOS = ["Studio Utama", "Studio VO"];
const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00",
];
const DEPARTMENTS = ["Monkey Melody", "Kummara", "Ludenara"];
const POLL_INTERVAL_MS = 30000; // background sync with Google Sheets

const IS_PLACEHOLDER =
  !GOOGLE_SCRIPT_URL || !GOOGLE_SCRIPT_URL.startsWith("https://script.google.com/");

const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const EMPTY_FORM = { fullName: "", department: "", project: "", notes: "" };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function StudioBooking() {
  const [reservations, setReservations] = useState([]); // [{ studio, date, slots[] }]
  const [loading, setLoading] = useState(!IS_PLACEHOLDER);
  const [loadError, setLoadError] = useState("");

  const [date, setDate] = useState(todayISO());
  const [studio, setStudio] = useState("");
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error' | 'info', text }
  const toastTimer = useRef(null);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ----- Load reservations from Google Sheets -----
  // silent = background refresh without the loading overlay
  const loadReservations = useCallback(async ({ silent = false } = {}) => {
    if (IS_PLACEHOLDER) return;
    if (!silent) setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL, { method: "GET", cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to read reservations.");
      setReservations(Array.isArray(data.reservations) ? data.reservations : []);
    } catch (err) {
      setLoadError("Could not load reservations from the spreadsheet. Booked slots may be out of date.");
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load, then poll the sheet and refresh when the tab becomes visible
  useEffect(() => {
    loadReservations();
    const id = setInterval(() => loadReservations({ silent: true }), POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") loadReservations({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadReservations]);

  // ----- Derived: booked slots per studio for the selected date -----
  const bookedMap = useMemo(() => {
    const map = {};
    STUDIOS.forEach((s) => (map[s] = new Set()));
    reservations.forEach((r) => {
      if (r.date === date && map[r.studio]) r.slots.forEach((t) => map[r.studio].add(t));
    });
    return map;
  }, [reservations, date]);

  // Drop selected slots that were booked by someone else since selection
  useEffect(() => {
    if (studio) setSelected((prev) => prev.filter((t) => !bookedMap[studio].has(t)));
  }, [bookedMap, studio]);

  // ----- Grid interaction -----
  const toggleSlot = (s, t) => {
    if (bookedMap[s].has(t)) return;
    if (s !== studio) {
      setStudio(s);
      setSelected([t]);
      return;
    }
    setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort()));
  };

  const changeDate = (value) => {
    setDate(value);
    setStudio("");
    setSelected([]);
  };

  const updateField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // ----- Submit -----
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!studio || selected.length === 0) {
      setFormError("Select at least one time slot in the grid.");
      return;
    }
    if (!form.fullName.trim() || !form.department || !form.project.trim()) {
      setFormError("Full name, department, and project / purpose are required.");
      return;
    }

    const payload = {
      studio,
      date,
      slots: [...selected].sort(),
      fullName: form.fullName.trim(),
      department: form.department,
      project: form.project.trim(),
      notes: form.notes.trim(),
    };

    const commitLocal = () => {
      setReservations((prev) => [...prev, { studio, date, slots: payload.slots }]);
      setSelected([]);
      setStudio("");
      setForm(EMPTY_FORM);
    };

    setSubmitting(true);
    try {
      // Fallback: placeholder URL -> keep the preview functional with local state
      if (IS_PLACEHOLDER) {
        await new Promise((r) => setTimeout(r, 700));
        commitLocal();
        showToast("info", "Demo mode: booking saved locally only. Set GOOGLE_SCRIPT_URL to save to Google Sheets.");
        return;
      }

      // Content-Type text/plain keeps this a "simple request" (no CORS preflight).
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.ok) {
        commitLocal();
        showToast("success", `Booking saved to the spreadsheet: ${payload.studio}, ${payload.date}, ${payload.slots.join(", ")}.`);
      } else if (data.error === "conflict") {
        showToast("error", `${data.message || "Selected slots were just booked by someone else."} Grid refreshed.`);
        setSelected([]);
        await loadReservations();
      } else {
        throw new Error(data.error || "Unknown error.");
      }
    } catch (err) {
      console.error(err);
      showToast("error", "Booking not saved. Check the connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const toastStyles = {
    success: "bg-emerald-50 border-emerald-300 text-emerald-900",
    error: "bg-red-50 border-red-300 text-red-900",
    info: "bg-sky-50 border-sky-300 text-sky-900",
  };
  const ToastIcon = toast
    ? { success: CheckCircle2, error: AlertTriangle, info: Info }[toast.type]
    : null;

  const inputCls =
    "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Studio booking</h1>
          <p className="mt-1 text-sm text-stone-600">
            Pick a date, select slots in the grid, then fill in the booking details.
          </p>
        </header>

        {/* Toast / status banners */}
        <div aria-live="polite" className="space-y-3">
          {toast && (
            <div className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${toastStyles[toast.type]}`}>
              <ToastIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1">{toast.text}</p>
              <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {IS_PLACEHOLDER && !toast && (
            <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Demo mode: GOOGLE_SCRIPT_URL is not set. Bookings stay in local state and reset on reload.</p>
            </div>
          )}
          {loadError && (
            <div className="flex items-start gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1">{loadError}</p>
              <button type="button" onClick={() => loadReservations()} className="underline">
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Date + refresh */}
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="booking-date" className="mb-1 block text-sm font-medium">
              Booking date
            </label>
            <input
              id="booking-date"
              type="date"
              min={todayISO()}
              value={date}
              onChange={(e) => changeDate(e.target.value)}
              className={inputCls}
            />
          </div>
          {!IS_PLACEHOLDER && (
            <button
              type="button"
              onClick={() => loadReservations()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm hover:bg-stone-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh bookings
            </button>
          )}
        </div>

        {/* Cinema grid */}
        <section className="mt-4 rounded-xl bg-indigo-950 p-4 sm:p-6" aria-label="Studio availability grid">
          <div className="mx-auto mb-5 max-w-md">
            <div className="h-1.5 rounded-full bg-amber-300/80" />
            <p className="mt-2 text-center text-xs text-indigo-200">Studios / time slots</p>
          </div>

          <div className="relative overflow-x-auto">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-indigo-950/70">
                <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
                <span className="sr-only">Loading reservations</span>
              </div>
            )}
            <table className="mx-auto border-separate border-spacing-1.5">
              <thead>
                <tr>
                  <th />
                  {TIME_SLOTS.map((t) => (
                    <th key={t} className="px-1 text-xs font-normal text-indigo-200">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STUDIOS.map((s) => (
                  <tr key={s}>
                    <th scope="row" className="whitespace-nowrap pr-2 text-left text-sm font-medium text-indigo-50">
                      {s}
                    </th>
                    {TIME_SLOTS.map((t) => {
                      const booked = bookedMap[s].has(t);
                      const isSel = s === studio && selected.includes(t);
                      return (
                        <td key={t}>
                          <button
                            type="button"
                            disabled={booked || loading}
                            aria-pressed={isSel}
                            aria-label={`${s} ${t} ${booked ? "booked" : isSel ? "selected" : "available"}`}
                            onClick={() => toggleSlot(s, t)}
                            className={[
                              "h-9 w-11 rounded-t-lg rounded-b-sm text-xs transition-colors",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
                              booked
                                ? "cursor-not-allowed bg-indigo-900 text-indigo-500 line-through"
                                : isSel
                                ? "bg-amber-300 font-semibold text-indigo-950"
                                : "bg-indigo-300 text-indigo-950 hover:bg-indigo-200",
                            ].join(" ")}
                          >
                            {booked ? "x" : isSel ? "\u2713" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-4 text-xs text-indigo-100">
            <span className="flex items-center gap-2"><i className="inline-block h-3 w-4 rounded-t bg-indigo-300" />Available</span>
            <span className="flex items-center gap-2"><i className="inline-block h-3 w-4 rounded-t bg-amber-300" />Selected</span>
            <span className="flex items-center gap-2"><i className="inline-block h-3 w-4 rounded-t bg-indigo-900" />Booked</span>
          </div>
        </section>

        {/* Booking form */}
        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-stone-200 bg-white p-4 sm:p-6" noValidate>
          <h2 className="text-lg font-semibold">Booking details</h2>
          <p className="mt-1 text-sm text-stone-600">
            {studio && selected.length
              ? `${studio}, ${date}, ${selected.join(", ")}`
              : "No slots selected."}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fullName" className="mb-1 block text-sm font-medium">Full name</label>
              <input id="fullName" value={form.fullName} onChange={updateField("fullName")} className={inputCls} autoComplete="name" />
            </div>
            <div>
              <label htmlFor="department" className="mb-1 block text-sm font-medium">Department</label>
              <select id="department" value={form.department} onChange={updateField("department")} className={inputCls}>
                <option value="">Select department</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="project" className="mb-1 block text-sm font-medium">Project / purpose</label>
              <input id="project" value={form.project} onChange={updateField("project")} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="notes" className="mb-1 block text-sm font-medium">Notes (optional)</label>
              <textarea id="notes" rows={3} value={form.notes} onChange={updateField("notes")} className={inputCls} />
            </div>
          </div>

          {formError && (
            <p role="alert" className="mt-4 text-sm text-red-700">{formError}</p>
          )}

          <button
            type="submit"
            disabled={submitting || loading}
            className="mt-5 inline-flex min-w-40 items-center justify-center gap-2 rounded-md bg-indigo-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving booking
              </>
            ) : (
              "Book studio"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
