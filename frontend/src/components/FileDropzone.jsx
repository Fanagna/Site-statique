import { FileText, Upload, X } from 'lucide-react';

/* Zone de dépôt réutilisable — documents uniquement (PDF, DOC, DOCX), max 5 Mo */
export default function FileDropzone({ label, required, hint, file, error, onFile, onRemove }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-arina-dark mb-1.5">
        {label} {required && <span className="text-arina-accent">*</span>}
      </label>
      <label
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all bg-gray-50 ${
          error
            ? 'border-red-300'
            : file
              ? 'border-arina-accent bg-arina-accent/5'
              : 'border-gray-300 hover:border-arina-accent/50 hover:bg-arina-warm/40'
        }`}
      >
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
          className="hidden"
        />
        {file ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-arina-accent text-white shrink-0">
              <FileText className="w-5 h-5" />
            </span>
            <div className="text-left">
              <div className="text-sm font-bold text-arina-dark break-all max-w-[280px]">{file.name}</div>
              <div className="text-xs text-arina-gray">{Math.max(1, Math.round(file.size / 1024))} Ko — cliquer pour remplacer</div>
            </div>
          </div>
        ) : (
          <>
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-arina-blue/10 text-arina-blue">
              <Upload className="w-6 h-6" />
            </span>
            <span className="text-sm font-semibold text-arina-dark">{hint}</span>
            <span className="text-xs text-arina-gray">PDF, DOC ou DOCX — maximum 5 Mo</span>
          </>
        )}
      </label>
      {file && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Retirer ce fichier
        </button>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
