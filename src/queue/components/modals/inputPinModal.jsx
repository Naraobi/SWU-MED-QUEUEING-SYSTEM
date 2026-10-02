import { useEffect, useState } from 'react';

import { ArrowRight, Check, CircleAlert, Shield, ShieldCheck, X } from 'lucide-react';

export default function InputPinModal({
  open,
  onClose,
  onVerify, // async (pin) => void. Throw an Error to show it in the modal.
  onSuccess, // called when the flow is finished
  title = 'Enter Security PIN',
  description = 'Enter your Security PIN to authorize this action.',
  confirmLabel = 'Verify',
  successMessage = '', // if set, a success screen is shown after verifying
  successNote = '',
}) {
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  // Reset every time the modal opens
  useEffect(() => {
    if (open) {
      setPin('');
      setSubmitting(false);
      setError(null);
      setDone(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleVerify() {
    if (!/^\d{6}$/.test(pin)) {
      setError('Enter a valid 6-digit Security PIN.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await onVerify(pin);

      setPin('');

      if (successMessage) {
        setDone(true);
      } else {
        onSuccess?.();
      }
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    onClose?.();
  }

  return (
    <div className="swu-enter-fade fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
      {/* ========== SUCCESS VIEW ========== */}
      {done ? (
        <div className="swu-pop w-full max-w-sm rounded-2xl bg-white px-6 py-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8F8F0]">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0D8A4E] text-white">
              <Check size={18} strokeWidth={3} />
            </span>
          </div>

          <p className="mt-5 text-sm font-semibold text-[#1F2937]">
            {successMessage}
          </p>

          {successNote && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-[#6B7280]">
              <CircleAlert size={13} className="shrink-0 text-[#9D0A0E]" />
              {successNote}
            </p>
          )}

          <button
            type="button"
            onClick={() => onSuccess?.()}
            className="swu-press mt-6 w-full rounded-lg bg-[#9D0A0E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
          >
            DONE
          </button>
        </div>
      ) : (
        /* ========== PIN VIEW ========== */
        <div className="swu-pop relative w-full max-w-sm rounded-2xl bg-white px-6 pb-6 pt-8 shadow-2xl">
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#4B5563]"
            title="Close"
          >
            <X size={18} />
          </button>

          {/* ICON */}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FBF1F1] text-[#9D0A0E]">
            <Shield size={26} />
          </div>

          {/* TITLE */}
          <h3 className="mt-4 text-center text-lg font-semibold text-[#1F2937]">
            {title}
          </h3>
          <p className="mt-1 text-center text-xs leading-5 text-[#6B7280]">
            {description}
          </p>

          {/* ERROR */}
          {error && (
            <div className="mt-4 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-sm text-[#9D0A0E]">
              {error}
            </div>
          )}

          {/* INPUT */}
          <div className="mt-5">
            <label className="mb-1.5 block text-xs font-medium text-[#374151]">
              Security PIN
            </label>

            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              maxLength={6}
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' && pin.length === 6 && !submitting) {
                  handleVerify();
                }
              }}
              placeholder="Enter security PIN"
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none transition placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          {/* PRIVACY NOTE */}
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#F8F9FA] px-3 py-2.5 text-xs text-[#6B7280]">
            <ShieldCheck size={15} className="shrink-0 text-[#9CA3AF]" />
            Keep your Security PIN private. Do not share it with other users.
          </div>

          {/* ACTIONS */}
          <button
            type="button"
            onClick={handleVerify}
            disabled={pin.length !== 6 || submitting}
            className="swu-press mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#9D0A0E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              'Verifying...'
            ) : (
              <>
                {confirmLabel}
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="swu-press mt-2 w-full rounded-lg border border-[#E5E7EB] px-4 py-2.5 text-sm font-medium text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}