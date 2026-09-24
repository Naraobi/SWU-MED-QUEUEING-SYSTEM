import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';

import { createKiosk } from '../../services/backendApi';

export default function AddKioskModal({ open, onClose, onSuccess }) {
  const [kioskName, setKioskName] = useState('');
  const [kioskStatus, setKioskStatus] = useState('active');

  const [savingKiosk, setSavingKiosk] = useState(false);
  const [kioskError, setKioskError] = useState(null);

  function handleClose() {
    if (savingKiosk) return;

    setKioskError(null);
    setKioskName('');
    setKioskStatus('active');

    onClose?.();
  }

  async function handleSaveKiosk() {
    const trimmedName = kioskName.trim();

    if (!trimmedName) {
      setKioskError('Kiosk name is required.');
      return;
    }

    try {
      setSavingKiosk(true);
      setKioskError(null);

      const newKiosk = await createKiosk({
        name: trimmedName,
        status: kioskStatus,
      });

      const formattedKiosk = {
        ...newKiosk,
        name: trimmedName,
        location: '',
        status: kioskStatus,
      };

      setKioskName('');
      setKioskStatus('active');

      onSuccess?.(formattedKiosk);
      onClose?.();
    } catch (err) {
      console.error('SAVE KIOSK ERROR:', err);

      setKioskError(err.message || 'Failed to add kiosk.');
    } finally {
      setSavingKiosk(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-[#1F2937]">
              Add Kiosk
            </h3>

            <p className="mt-0.5 text-sm text-[#6B7280]">
              Create a new kiosk.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={savingKiosk}
            className="rounded-lg p-2 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#4B5563] disabled:cursor-not-allowed disabled:opacity-60"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {kioskError && (
            <div className="rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-sm text-[#9D0A0E]">
              {kioskError}
            </div>
          )}

          {/* Kiosk Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#374151]">
              Kiosk Name <span className="text-[#9D0A0E]">*</span>
            </label>

            <input
              type="text"
              value={kioskName}
              onChange={(event) => setKioskName(event.target.value)}
              placeholder="e.g. Main Lobby"
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          {/* Status Segmented Control */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#374151]">
              Status
            </label>

            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#F1F3F5] p-1">
              <button
                type="button"
                onClick={() => setKioskStatus('active')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                  kioskStatus === 'active'
                    ? 'border border-[#86EFAC] bg-[#E8F8F0] text-[#0D8A4E] shadow-xs'
                    : 'text-[#4B5563] hover:text-[#1F2937]'
                }`}
              >
                {kioskStatus === 'active' && <Check size={16} />}
                Active
              </button>

              <button
                type="button"
                onClick={() => setKioskStatus('inactive')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                  kioskStatus === 'inactive'
                    ? 'bg-white text-[#1F2937] shadow-xs'
                    : 'text-[#4B5563] hover:text-[#1F2937]'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={savingKiosk}
            className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#1F2937] transition hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveKiosk}
            disabled={savingKiosk}
            className="inline-flex items-center gap-2 rounded-lg bg-[#9D0A0E] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingKiosk ? (
              'Saving...'
            ) : (
              <>
                <Plus size={16} />
                Add Kiosk
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}