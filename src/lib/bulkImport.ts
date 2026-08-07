import * as XLSX from 'xlsx';

export interface BulkRowError {
  row: number;
  field?: string;
  message: string;
}

export interface BulkMenuVariantRow {
  label: string;
  price: number;
  recipe_scale: number;
  is_default: boolean;
  is_available?: boolean;
  channel_prices?: Record<string, number>;
}

export interface BulkMenuUploadRow {
  category: string;
  type: string;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  is_readily_available: boolean;
  is_taxable?: boolean;
  available_channels?: string[];
  channel_prices?: Record<string, number>;
  variants?: BulkMenuVariantRow[];
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

const CHANNEL_IDS = [
  'dine_in',
  'counter_eat_here',
  'counter_takeaway',
  'swiggy',
  'zomato',
] as const;

const CHANNEL_PRICE_HEADERS: Record<string, string> = {
  pricedinein: 'dine_in',
  pricecountereathere: 'counter_eat_here',
  pricecountertakeaway: 'counter_takeaway',
  priceswiggy: 'swiggy',
  pricezomato: 'zomato',
};

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

function parseOptionalBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }
  return parseBool(value, true);
}

function parseNumber(value: unknown): number {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

function parseChannels(value: unknown): string[] | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  return raw
    .split(/[,|;]/)
    .map((part) => part.trim().toLowerCase().replace(/[\s-]+/g, '_'))
    .filter(Boolean);
}

function parseChannelPrices(row: Record<string, unknown>): Record<string, number> | undefined {
  const prices: Record<string, number> = {};
  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    normalized.set(normalizeHeader(key), value);
  }
  for (const [header, channel] of Object.entries(CHANNEL_PRICE_HEADERS)) {
    if (!normalized.has(header)) continue;
    const n = parseNumber(normalized.get(header));
    if (Number.isFinite(n) && n >= 0 && String(normalized.get(header) ?? '').trim() !== '') {
      prices[channel] = n;
    }
  }
  return Object.keys(prices).length > 0 ? prices : undefined;
}

function sheetRowsFromSheet(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
  return rows;
}

function findSheet(workbook: XLSX.WorkBook, names: string[]): XLSX.WorkSheet | null {
  const wanted = names.map((n) => normalizeHeader(n));
  for (const name of workbook.SheetNames) {
    if (wanted.includes(normalizeHeader(name))) {
      return workbook.Sheets[name] || null;
    }
  }
  return null;
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

function menuLookupKey(category: string, type: string): string {
  return `${category.trim().toLowerCase()}\0${type.trim().toLowerCase()}`;
}

export async function parseMenuExcel(file: File): Promise<BulkMenuUploadRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  if (!workbook.SheetNames.length) {
    throw new Error('Excel file has no sheets');
  }

  const menuSheet =
    findSheet(workbook, ['Menu', 'Menus', 'Items']) ||
    workbook.Sheets[workbook.SheetNames[0]];
  if (!menuSheet) {
    throw new Error('Menu sheet not found');
  }

  const menuAliases = {
    category: ['category'],
    type: ['type'],
    price: ['price'],
    isVeg: ['isveg'],
    isAvailable: ['isavailable'],
    isReadilyAvailable: ['isreadilyavailable'],
    isTaxable: ['istaxable'],
    availableChannels: ['availablechannels', 'channels'],
  };

  const items = sheetRowsFromSheet(menuSheet)
    .map((row) => {
      const mapped = rowByHeaders(row, menuAliases);
      const category = String(mapped.category ?? '').trim();
      const type = String(mapped.type ?? '').trim();
      const isTaxable = parseOptionalBool(mapped.isTaxable);
      const availableChannels = parseChannels(mapped.availableChannels);
      const channelPrices = parseChannelPrices(row);
      const item: BulkMenuUploadRow = {
        category,
        type,
        price: parseNumber(mapped.price),
        is_veg: parseBool(mapped.isVeg, false),
        is_available: parseBool(mapped.isAvailable, true),
        is_readily_available: parseBool(mapped.isReadilyAvailable, false),
      };
      if (isTaxable !== undefined) item.is_taxable = isTaxable;
      if (availableChannels) item.available_channels = availableChannels;
      if (channelPrices) item.channel_prices = channelPrices;
      return item;
    })
    .filter((row) => row.category || row.type);

  if (items.length === 0) {
    throw new Error('Menu sheet is empty');
  }

  const portionsSheet = findSheet(workbook, ['Portions', 'Variants', 'Sizes']);
  if (!portionsSheet) {
    return items;
  }

  const portionAliases = {
    category: ['category'],
    type: ['type', 'menuname', 'menu'],
    label: ['label', 'portion', 'portionlabel', 'variant'],
    price: ['price', 'portionprice'],
    recipeScale: ['recipescale', 'scale'],
    isDefault: ['isdefault', 'default'],
    isAvailable: ['isavailable'],
  };

  const byMenu = new Map<string, BulkMenuVariantRow[]>();
  for (const row of sheetRowsFromSheet(portionsSheet)) {
    const mapped = rowByHeaders(row, portionAliases);
    const category = String(mapped.category ?? '').trim();
    const type = String(mapped.type ?? '').trim();
    const label = String(mapped.label ?? '').trim();
    if (!category || !type || !label) continue;
    const variant: BulkMenuVariantRow = {
      label,
      price: parseNumber(mapped.price),
      recipe_scale: parseNumber(mapped.recipeScale),
      is_default: parseBool(mapped.isDefault, false),
    };
    const available = parseOptionalBool(mapped.isAvailable);
    if (available !== undefined) variant.is_available = available;
    const channelPrices = parseChannelPrices(row);
    if (channelPrices) variant.channel_prices = channelPrices;
    const key = menuLookupKey(category, type);
    const list = byMenu.get(key) || [];
    list.push(variant);
    byMenu.set(key, list);
  }

  for (const item of items) {
    const variants = byMenu.get(menuLookupKey(item.category, item.type));
    if (variants?.length) {
      item.variants = variants;
    }
  }

  return items;
}

export async function parseRecipesExcel(file: File): Promise<BulkRecipeUploadRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet =
    findSheet(workbook, ['Recipes', 'Recipe', 'Ingredients']) ||
    workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new Error('Recipes sheet not found');
  }
  const rows = sheetRowsFromSheet(sheet);
  if (rows.length === 0) {
    throw new Error('Excel sheet is empty');
  }

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
  const menuRows = [
    {
      category: 'Main Course',
      type: 'Paneer Butter Masala',
      price: 280,
      isVeg: 'yes',
      isAvailable: 'yes',
      isReadilyAvailable: 'no',
      isTaxable: 'yes',
      availableChannels: CHANNEL_IDS.join(','),
      price_dine_in: 280,
      price_counter_eat_here: 280,
      price_counter_takeaway: 270,
      price_swiggy: 300,
      price_zomato: 300,
    },
    {
      category: 'Beverages',
      type: 'Mineral Water',
      price: 20,
      isVeg: 'yes',
      isAvailable: 'yes',
      isReadilyAvailable: 'yes',
      isTaxable: 'no',
      availableChannels: 'dine_in,counter_eat_here,counter_takeaway',
      price_dine_in: 20,
      price_counter_eat_here: 20,
      price_counter_takeaway: 20,
      price_swiggy: '',
      price_zomato: '',
    },
  ];

  const portionRows = [
    {
      category: 'Main Course',
      type: 'Paneer Butter Masala',
      label: 'Half',
      price: 160,
      recipeScale: 0.5,
      isDefault: 'no',
      isAvailable: 'yes',
      price_dine_in: 160,
      price_swiggy: 180,
      price_zomato: 180,
    },
    {
      category: 'Main Course',
      type: 'Paneer Butter Masala',
      label: 'Full',
      price: 280,
      recipeScale: 1,
      isDefault: 'yes',
      isAvailable: 'yes',
      price_dine_in: 280,
      price_swiggy: 300,
      price_zomato: 300,
    },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(menuRows), 'Menu');
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(portionRows), 'Portions');

  const helpRows = [
    {
      field: 'availableChannels',
      notes: 'Comma-separated: dine_in, counter_eat_here, counter_takeaway, swiggy, zomato. Leave blank for all.',
    },
    {
      field: 'isTaxable',
      notes: 'yes/no. Use no for MRP items (e.g. bottled water). Default yes if blank.',
    },
    {
      field: 'price_* columns',
      notes: 'Optional per-channel prices. Blank uses base price for that channel.',
    },
    {
      field: 'Portions sheet',
      notes: 'Optional. Match category+type to Menu. Leave empty to auto-create a Full portion.',
    },
  ];
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(helpRows), 'Notes');
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
