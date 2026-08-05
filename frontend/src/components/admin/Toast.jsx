import { Icon } from './icons';

/* Notification toast partagé de l'espace admin (le hook useToast vit dans ../../hooks/useToast). */
export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  const isWarn = toast.type === 'warning';
  return (
    <div
      key={toast.key}
      role="status"
      className={`fixed top-20 right-4 z-[120] w-[calc(100vw-2rem)] max-w-sm card-apple px-4 py-3 rounded-2xl shadow-2xl animate-pop flex items-start gap-3 border ${
        isError ? 'border-red-300 dark:border-red-500/40' : isWarn ? 'border-amber-300 dark:border-amber-500/40' : 'border-emerald-300 dark:border-emerald-500/40'
      }`}
    >
      <span
        className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isError ? 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400' : isWarn ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        }`}
      >
        <Icon name={isError ? 'alertCircle' : isWarn ? 'alertCircle' : 'check'} className="w-4 h-4" />
      </span>
      <p className="text-[13px] text-ios-text leading-snug flex-1">{toast.msg}</p>
      <button onClick={onClose} className="text-ios-text3 hover:text-ios-text transition-colors" title="Fermer">
        <Icon name="x" className="w-4 h-4" />
      </button>
    </div>
  );
}
