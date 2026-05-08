"use client";

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-zinc-700">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </span>
        {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function ModalShell({
  onClose,
  busy,
  wide,
  children,
}: {
  onClose: () => void;
  busy: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} mx-4 border border-zinc-200`}
      >
        {children}
      </div>
    </div>
  );
}
