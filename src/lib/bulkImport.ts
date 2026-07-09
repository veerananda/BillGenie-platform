import * as XLSX from 'xlsx';

export interface BulkRowError {
  row: number;
  field?: string;
  message: string;
}

export interface BulkMenuUploadRow {
  category: string;
  type: string;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  is_readily_available: boolean;
}

export interface BulkRecipeUploadRow {
  category: string;
  type: string;
  ingredient_name: string;
  unit: string;
  quantity: number;
}

export interface BulkMenuResult {
  created: number;
  updated: number;
  skipped: number;
  errors: BulkRowError[];
}

export interface BulkRecipesResult {
  menus_updated: number;
  ingredients_created: number;
  recipe_lines_created: number;
  errors: BulkRowError[];
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function parseBool(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue;
  }
  const raw = String(value).trim().toLowerCase();
  if (['yes', 'y', 'true', '1', 'veg'].includes(raw)) return true;
  if (['no', 'n', 'false', '0', 'nonveg', 'non-veg', 'non veg'].includes(raw)) return false;
  return defaultValue;
}

function parseNumber(value: unknown): number {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

function sheetRows(file: File): Promise<Record<string, unknown>[]> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('Excel file has no sheets');
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });
    if (rows.length === 0) {
      throw new Error('Excel sheet is empty');
    }
    return rows;
  });
}

function rowByHeaders(
  row: Record<string, unknown>,
  aliases: Record<string, string[]>
): Record<string, unknown> {
  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    normalized.set(normalizeHeader(key), value);
  }
  const out: Record<string, unknown> = {};
  for (const [field, keys] of Object.entries(aliases)) {
    for (const key of keys) {
      if (normalized.has(key)) {
        out[field] = normalized.get(key);
        break;
      }
    }
  }
  return out;
}

export async function parseMenuExcel(file: File): Promise<BulkMenuUploadRow[]> {
  const rows = await sheetRows(file);
  const aliases = {
    category: ['category'],
    type: ['type'],
    price: ['price'],
    isVeg: ['isveg'],
    isAvailable: ['isavailable'],
    isReadilyAvailable: ['isreadilyavailable'],
  };

  return rows
    .map((row) => {
    const mapped = rowByHeaders(row, aliases);
    return {
      category: String(mapped.category ?? '').trim(),
      type: String(mapped.type ?? '').trim(),
      price: parseNumber(mapped.price),
      is_veg: parseBool(mapped.isVeg, false),
      is_available: parseBool(mapped.isAvailable, true),
      is_readily_available: parseBool(mapped.isReadilyAvailable, false),
    };
  })
    .filter((row) => row.category || row.type);
}

export async function parseRecipesExcel(file: File): Promise<BulkRecipeUploadRow[]> {
  const rows = await sheetRows(file);
  const aliases = {
    category: ['category'],
    type: ['type', 'menuname', 'menu'],
    ingredientName: ['ingredientname', 'ingredient'],
    unit: ['unit'],
    quantity: ['quantity', 'qty'],
  };

  return rows
    .map((row) => {
    const mapped = rowByHeaders(row, aliases);
    return {
      category: String(mapped.category ?? '').trim(),
      type: String(mapped.type ?? '').trim(),
      ingredient_name: String(mapped.ingredientName ?? '').trim(),
      unit: String(mapped.unit ?? '').trim(),
      quantity: parseNumber(mapped.quantity),
    };
  })
    .filter(
      (row) =>
        row.category &&
        row.type &&
        row.ingredient_name &&
        row.unit &&
        row.quantity > 0
    );
}

export function downloadMenuTemplate() {
  const rows = [
    {
      category: 'Main Course',
      type: 'Paneer Butter Masala',
      price: 280,
      isVeg: 'yes',
      isAvailable: 'yes',
      isReadilyAvailable: 'no',
    },
    {
      category: 'Beverages',
      type: 'Mineral Water',
      price: 20,
      isVeg: 'yes',
      isAvailable: 'yes',
      isReadilyAvailable: 'yes',
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Menu');
  XLSX.writeFile(book, 'billgenie-menu-template.xlsx');
}

export function downloadRecipesTemplate() {
  const rows = [
    {
      category: 'Burger',
      type: 'Veg',
      'Ingredient name': 'Burger Bun',
      unit: 'pieces',
      quantity: 1,
    },
    {
      category: 'Burger',
      type: 'Veg',
      'Ingredient name': 'Patty',
      unit: 'grams',
      quantity: 120,
    },
    {
      category: 'Pizza',
      type: 'Veg',
      'Ingredient name': 'Pizza Base',
      unit: 'pieces',
      quantity: 1,
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Recipes');
  XLSX.writeFile(book, 'billgenie-recipes-template.xlsx');
}
