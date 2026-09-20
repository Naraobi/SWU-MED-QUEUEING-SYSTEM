import React from 'react'

export default function TrackerShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EAF3FB] px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-lg sm:max-w-lg md:max-w-xl">
        <div className="px-6 pt-6 pb-4 text-center">
          <p className="text-xl font-bold sm:text-2xl">
            <span className="text-[#9D0A0E]">SWU</span>
            <span className="text-[#1F2937]">Med</span>
          </p>

          {title && (
            <p className="mt-2 text-sm font-bold text-[#1F2937] sm:text-base">
              {title}
            </p>
          )}

          {subtitle && (
            <p className="mt-1 text-xs text-[#6B7280]">
              {subtitle}
            </p>
          )}
        </div>

        <div className="px-4 pb-6 sm:px-6">{children}</div>

        {footer && (
          <div className="border-t border-[#E5E7EB] bg-[#F8FAFC] px-6 py-3 text-center text-xs leading-relaxed text-[#6B7280]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}