import {
  X,
  Check,
  ChevronDown,
  Monitor,
  MapPin,
} from 'lucide-react';

const STATUS_OPTIONS = [
  'active',
  'deactivated',
];

export default function AddDepartmentModal({
  open,
  onClose,
  onSave,
  form,
  setForm,
  saving,
  kiosks,
  isEditing,
  onAddKiosk,
}) {
  if (!open) {
    return null;
  }
const activeKiosks = kiosks.filter(
  (kiosk) =>
    String(kiosk.status || '').toLowerCase() ===
    'active'
);

const selectedKiosk = kiosks.find(
  (kiosk) =>
    String(kiosk.id) ===
    String(form.kiosk_id)
);

const selectableKiosks = [
  ...activeKiosks,
  ...(selectedKiosk &&
  String(selectedKiosk.status || '').toLowerCase() !==
    'active' &&
  !activeKiosks.some(
    (kiosk) =>
      String(kiosk.id) ===
      String(selectedKiosk.id)
  )
    ? [selectedKiosk]
    : []),
];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-6 py-4">

          <div>
            <h2 className="text-lg font-bold text-[#1F2937]">
              {isEditing
                ? 'Edit Department'
                : 'Add New Department'}
            </h2>

            <p className="mt-1 text-xs text-[#4B5563]">
              {isEditing
                ? 'Update the department configuration below.'
                : 'Create a department and assign it to a kiosk.'}
            </p>

            <p className="mt-0.5 text-xs text-[#4B5563]">
              Fields marked{' '}
              <span className="text-[#9D0A0E]">*</span>
              {' '}are required.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded text-[#9CA3AF] transition hover:text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30 disabled:opacity-40"
            aria-label="Close"
          >
            <X size={18} />
          </button>

        </div>

        {/* ===================================================
            BODY
        =================================================== */}

        <div className="space-y-5 px-6 py-5">

          {/* =================================================
              KIOSK
          ================================================= */}

          <div className="space-y-2">

            {/* Kiosk label + Add kiosk */}

            <div className="flex items-center justify-between">

              <label
                htmlFor="department-kiosk"
                className="text-sm font-semibold text-[#1F2937]"
              >
                Kiosk
                <span className="ml-0.5 text-[#9D0A0E]">*</span>
              </label>

              <button
                type="button"
                onClick={onAddKiosk}
                disabled={saving}
                className="text-xs font-semibold text-[#9D0A0E] transition hover:text-[#7D080B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Add kiosk
              </button>

            </div>

            {/* Kiosk dropdown */}

            <div className="relative w-full">

              <Monitor
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
              />

           <select
  id="department-kiosk"
  value={form.kiosk_id || ''}
  onChange={(e) =>
    setForm((current) => ({
      ...current,
      kiosk_id: e.target.value,
    }))
  }
  disabled={true}
                className="w-full appearance-none rounded-lg border border-[#D1D5DB] bg-white py-2.5 pl-10 pr-10 text-sm text-[#1F2937] outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
              >

                <option value="">
                  Select a kiosk
                </option>

                {selectableKiosks.map((kiosk) => (
  <option
    key={kiosk.id}
    value={kiosk.id}
  >
    {kiosk.name}
  </option>
))}

              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
              />

            </div>

            {/* Assigning to information */}

            {selectedKiosk && (
              <div className="w-full rounded-lg border border-[#F3C6C7] bg-[#FFF5F5] px-3 py-2">

                <div className="flex items-start gap-2">

                  <span className="mt-0.5 shrink-0 text-[#9D0A0E]">
                    <MapPin size={14} />
                  </span>

                  <div className="min-w-0 text-xs">

                    <span className="block font-semibold text-[#9D0A0E]">
                      Assigning to: {selectedKiosk.name}
                    </span>

                    <p className="mt-0.5 text-[#4B5563]">
                      Select the kiosk where this department will be assigned.
                    </p>

                  </div>

                </div>

              </div>
            )}

          </div>

          {/* =================================================
              DEPARTMENT NAME
          ================================================= */}

          <div>

            <label
              htmlFor="department-name"
              className="mb-1 block text-sm font-semibold text-[#1F2937]"
            >
              Department Name
              <span className="ml-0.5 text-[#9D0A0E]">*</span>
            </label>

            <input
              id="department-name"
              type="text"
              value={form.department_name}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  department_name: e.target.value,
                }))
              }
              disabled={
                !form.kiosk_id ||
                saving
              }
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1F2937] transition placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:cursor-not-allowed disabled:bg-[#F1F3F5] disabled:text-[#9CA3AF]"
              placeholder={
                form.kiosk_id
                  ? 'e.g. Laboratory, Pharmacy, Billing'
                  : 'Select a kiosk first'
              }
            />

            {!form.kiosk_id && (
              <p className="mt-1.5 text-xs text-[#4B5563]">
                Department name becomes available after selecting a kiosk.
              </p>
            )}

          </div>

          {/* =================================================
              PREFIX + STATUS
          ================================================= */}

          <div className="grid grid-cols-2 gap-4">

            {/* PREFIX */}

            <div>

              <label
                htmlFor="department-prefix"
                className="mb-1 block text-sm font-semibold text-[#1F2937]"
              >
                Department Prefix
                <span className="ml-0.5 text-[#9D0A0E]">*</span>
              </label>

              <input
                id="department-prefix"
                type="text"
                value={form.prefix}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    prefix: e.target.value.toUpperCase(),
                  }))
                }
                disabled={
                  !form.kiosk_id ||
                  saving
                }
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1F2937] transition placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:cursor-not-allowed disabled:bg-[#F1F3F5] disabled:text-[#9CA3AF]"
                placeholder="e.g. L or P"
              />

              <p className="mt-1.5 text-xs text-[#4B5563]">
                Tickets will show as{' '}
                {form.prefix
                  ? `${form.prefix}-001`
                  : 'ML-001'}
              </p>

            </div>

            {/* STATUS */}

            <div>

              <label className="mb-1 block text-sm font-semibold text-[#1F2937]">
                Status
              </label>

              <div className="inline-flex rounded-lg border border-[#E5E7EB] p-1">

                {STATUS_OPTIONS.map((status) => {

                  const isSelected =
                    form.status === status;

                  const isDisabled =
                    !form.kiosk_id ||
                    saving;

                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={isDisabled}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          status,
                        }))
                      }
                      aria-pressed={isSelected}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-[#4B5563] hover:bg-[#F1F3F5]'
                      }`}
                    >
                      {isSelected && (
                        <Check size={14} />
                      )}

                      {status}
                    </button>
                  );

                })}

              </div>

            </div>

          </div>

        </div>

        {/* ===================================================
            FOOTER
        =================================================== */}

        <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-[#F8F9FA] px-6 py-4">

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-2 text-sm font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={
              saving ||
              !form.kiosk_id ||
              !form.department_name.trim()
            }
            className="flex items-center gap-1.5 rounded-lg bg-[#9D0A0E] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving
              ? 'Saving...'
              : isEditing
                ? 'Save Changes'
                : '+ Add Department'}
          </button>

        </div>

      </div>
    </div>
  );
}