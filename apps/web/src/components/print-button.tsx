'use client';

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="mt-10 h-11 rounded-lg bg-navy-700 px-6 text-[14px] font-semibold text-white print:hidden">
      Print poster
    </button>
  );
}
