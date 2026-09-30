import {
  Check,
  X,
  Info,
  AlertTriangle,
} from 'lucide-react';

export default function AddPositionModal({
  draft,
  setDraft,
  onClose,
  onSave,
  saving,
  error,
}) {
  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-position-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="swu-pop w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="add-position-modal-title"
              className="text-base font-bold text-[#1F2937]"
            >
              Add Position
            </h2>

            <p className="mt-0.5 text-xs text-[#4B5563]">
              Create a position that staff can be assigned to.
            </p>

            <p className="mt-0.5 text-xs text-[#9CA3AF]">
              Fields marked <span className="text-[#9D0A0E]">*</span> are
              required.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#1F2937] disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* BODY */}
        <div className="px-5 py-5">
          <div className="grid grid-cols-[minmax(0,1fr)_200px] gap-4">
            {/* POSITION NAME */}
            <div>
              <label
                htmlFor="add-position-name"
                className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
              >
                Position Name <span className="text-[#9D0A0E]">*</span>
              </label>

              <input
                id="add-position-name"
                autoFocus
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Head Nurse"
                className="h-10 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
              />
            </div>

            {/* STATUS */}
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-[#1F2937]">
                Status
              </span>

              <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#F1F3F5] p-1">
                {['Active', 'Inactive'].map((value) => {
                  const active = draft.status === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          status: value,
                        }))
                      }
                      aria-pressed={active}
                      className={`flex h-8 items-center justify-center gap-1 rounded-md text-xs font-medium transition ${
                        active
                          ? value === 'Active'
                            ? 'border border-[#86EFAC] bg-[#E8F8F0] text-[#0D8A4E] shadow-sm'
                            : 'border border-[#E5E7EB] bg-white text-[#1F2937] shadow-sm'
                          : 'text-[#4B5563] hover:text-[#1F2937]'
                      }`}
                    >
                      {active && value === 'Active' && <Check size={12} />}
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* INFO */}
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#FBF1F1] px-3 py-2 text-xs leading-5 text-[#4B5563]">
            <Info
              size={12}
              className="mt-0.5 shrink-0 text-[#9D0A0E]"
            />

            <span>
              Position identifies the employee&apos;s job title. System access
              is controlled by Role.
            </span>
          </div>

          {/* ERROR */}
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2 text-xs text-[#9D0A0E]">
              <AlertTriangle
                size={12}
                className="mt-0.5 shrink-0"
              />

              <span>{error}</span>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving || !draft.name.trim()}
            className="swu-press h-9 rounded-lg bg-[#9D0A0E] px-4 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            {saving ? 'Saving...' : 'Save Position'}
          </button>
        </div>
      </div>
    </div>
  );
}