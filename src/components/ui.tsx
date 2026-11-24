import { useEffect, useRef, type ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "quiet" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none";
  const styles = {
    primary: "hype-gradient text-white shadow-[0_0_24px_-6px_var(--color-keen)] hover:brightness-110",
    ghost: "border border-line bg-panel text-ink hover:bg-panel-2",
    quiet: "text-dim hover:text-ink hover:bg-panel-2",
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-dim">{label}</span>
      <input
        className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-ink placeholder:text-faint focus:border-keen focus:outline-none"
        {...props}
      />
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-lg border border-perish/40 bg-perish/10 px-3 py-2 text-sm text-perish">{children}</p>;
}

/** native <dialog> — gets focus trapping, esc-to-close and the backdrop for free */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl border border-line bg-panel p-0 text-ink shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm`}
    >
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-bold">{title}</h2>
            <button onClick={onClose} className="rounded-lg px-2 py-1 text-dim hover:bg-panel-2 hover:text-ink" aria-label="close">
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Chip({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  const cls = `inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition ${
    active ? "border-keen bg-keen/20 text-ink" : "border-line bg-panel-2/60 text-dim"
  } ${onClick ? "hover:border-keen/60 hover:text-ink cursor-pointer" : ""}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} aria-pressed={active}>
      {children}
    </button>
  ) : (
    <span className={cls}>{children}</span>
  );
}

export function Cover({ imageId, name, className = "" }: { imageId: string | null; name: string; className?: string }) {
  return imageId ? (
    <img
      src={`https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`}
      alt=""
      loading="lazy"
      className={`bg-panel-2 object-cover ${className}`}
    />
  ) : (
    <div aria-label={name || undefined} className={`grid place-items-center bg-gradient-to-br from-panel-2 to-bg text-3xl opacity-80 ${className}`}>🎮</div>
  );
}
