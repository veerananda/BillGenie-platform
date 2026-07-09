'use client';

import { useRef, useState } from 'react';
import {
  BulkMenuResult,
  BulkRecipesResult,
  downloadMenuTemplate,
  downloadRecipesTemplate,
  parseMenuExcel,
  parseRecipesExcel,
} from '@/lib/bulkImport';
import { bulkUploadMenu, bulkUploadRecipes } from '@/lib/api';

type UploadKind = 'menu' | 'recipes';

export function BulkImportPanel({ restaurantId }: { restaurantId: string }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<UploadKind | ''>('');
  const [error, setError] = useState('');
  const [menuResult, setMenuResult] = useState<BulkMenuResult | null>(null);
  const [recipesResult, setRecipesResult] = useState<BulkRecipesResult | null>(null);
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [recipesFile, setRecipesFile] = useState<File | null>(null);
  const menuInputRef = useRef<HTMLInputElement>(null);
  const recipesInputRef = useRef<HTMLInputElement>(null);

  const runUpload = async (kind: UploadKind) => {
    const file = kind === 'menu' ? menuFile : recipesFile;
    if (!file) {
      setError('Please choose an Excel file first');
      return;
    }
    if (!reason.trim()) {
      setError('Please enter a reason for audit log');
      return;
    }

    setBusy(kind);
    setError('');
    if (kind === 'menu') setMenuResult(null);
    else setRecipesResult(null);

    try {
      if (kind === 'menu') {
        const items = await parseMenuExcel(file);
        const res = await bulkUploadMenu(restaurantId, {
          reason: reason.trim(),
          items,
        });
        setMenuResult(res.result);
        setMenuFile(null);
        if (menuInputRef.current) menuInputRef.current.value = '';
      } else {
        const items = await parseRecipesExcel(file);
        const res = await bulkUploadRecipes(restaurantId, {
          reason: reason.trim(),
          items,
        });
        setRecipesResult(res.result);
        setRecipesFile(null);
        if (recipesInputRef.current) recipesInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-lg font-medium text-white">Bulk import (Excel)</h2>
      <p className="mt-1 text-sm text-slate-400">
        Upload menu first, then recipes. Ingredients are created automatically for inventory.
        Choose a file, enter a reason, then click Upload.
      </p>

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required for audit log)"
        className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <UploadCard
          title="Menu items"
          description="Columns: category, type, price, isVeg, isAvailable, isReadilyAvailable"
          onDownloadTemplate={downloadMenuTemplate}
          inputRef={menuInputRef}
          selectedFile={menuFile}
          busy={busy === 'menu'}
          canUpload={Boolean(menuFile && reason.trim())}
          onChooseFile={(file) => {
            setError('');
            setMenuFile(file);
          }}
          onClearFile={() => {
            setMenuFile(null);
            if (menuInputRef.current) menuInputRef.current.value = '';
          }}
          onUpload={() => runUpload('menu')}
        />
        <UploadCard
          title="Recipes / ingredients"
          description="Columns: category, type, Ingredient name, unit, quantity"
          onDownloadTemplate={downloadRecipesTemplate}
          inputRef={recipesInputRef}
          selectedFile={recipesFile}
          busy={busy === 'recipes'}
          canUpload={Boolean(recipesFile && reason.trim())}
          onChooseFile={(file) => {
            setError('');
            setRecipesFile(file);
          }}
          onClearFile={() => {
            setRecipesFile(null);
            if (recipesInputRef.current) recipesInputRef.current.value = '';
          }}
          onUpload={() => runUpload('recipes')}
        />
      </div>

      {menuResult ? (
        <ResultBox
          title="Menu upload result"
          lines={[
            `Created: ${menuResult.created}`,
            `Updated: ${menuResult.updated}`,
            `Skipped: ${menuResult.skipped}`,
            `Errors: ${menuResult.errors.length}`,
          ]}
          errors={menuResult.errors}
        />
      ) : null}

      {recipesResult ? (
        <ResultBox
          title="Recipes upload result"
          lines={[
            `Menus updated: ${recipesResult.menus_updated}`,
            `Ingredients created: ${recipesResult.ingredients_created}`,
            `Recipe lines: ${recipesResult.recipe_lines_created}`,
            `Errors: ${recipesResult.errors.length}`,
          ]}
          errors={recipesResult.errors}
        />
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
    </section>
  );
}

function UploadCard({
  title,
  description,
  onDownloadTemplate,
  inputRef,
  selectedFile,
  busy,
  canUpload,
  onChooseFile,
  onClearFile,
  onUpload,
}: {
  title: string;
  description: string;
  onDownloadTemplate: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  selectedFile: File | null;
  busy: boolean;
  canUpload: boolean;
  onChooseFile: (file: File) => void;
  onClearFile: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <h3 className="font-medium text-white">{title}</h3>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDownloadTemplate}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-900"
        >
          Download template
        </button>
        <label className="cursor-pointer rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-900">
          Choose Excel file
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onChooseFile(file);
            }}
          />
        </label>
        <button
          type="button"
          disabled={busy || !canUpload}
          onClick={onUpload}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>
      {selectedFile ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-xs">
          <span className="truncate text-slate-300" title={selectedFile.name}>
            {selectedFile.name}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={onClearFile}
            className="shrink-0 text-slate-500 hover:text-slate-300 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">No file selected</p>
      )}
    </div>
  );
}

function ResultBox({
  title,
  lines,
  errors,
}: {
  title: string;
  lines: string[];
  errors: Array<{ row: number; field?: string; message: string }>;
}) {
  return (
    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-sm">
      <h4 className="font-medium text-emerald-300">{title}</h4>
      <ul className="mt-2 space-y-1 text-slate-300">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {errors.length > 0 ? (
        <div className="mt-3 max-h-40 overflow-y-auto">
          <p className="text-xs font-medium text-amber-300">Row errors</p>
          <ul className="mt-1 space-y-1 text-xs text-amber-200/90">
            {errors.map((err, idx) => (
              <li key={`${err.row}-${idx}`}>
                Row {err.row}
                {err.field ? ` (${err.field})` : ''}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
