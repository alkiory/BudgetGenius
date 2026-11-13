import * as XLSX from "xlsx";
import type { NewTransactionInput } from "@domain/dashboard/transactions/transaction.entity";

type Cell = string | number | Date | null;
type Row = Cell[];

const normalize = (value: Cell) => String(value ?? "").trim().toLocaleLowerCase();
const HEADER_NAMES: Record<string, string[]> = {
  date: ["fecha", "date", "transaction date", "fecha movimiento"],
  description: ["descripción", "descripcion", "description", "concepto", "detalle", "merchant"],
  category: ["categoría", "categoria", "category", "categoría del movimiento"],
  amount: ["importe", "monto", "cantidad", "amount", "value", "valor"],
  type: ["tipo", "type", "ingreso/gasto", "income/expense"],
};

function parseCsv(text: string): Row[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", ",", "\t"].sort((a, b) =>
    firstLine.split(b).length - firstLine.split(a).length,
  )[0];
  const rows: Row[] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(value); value = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else value += char;
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function parseExcelXml(text: string): Row[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML inválido.");
  const rows: Row[] = [];
  for (const xmlRow of Array.from(doc.getElementsByTagName("Row"))) {
    const cells: Row = [];
    let nextIndex = 0;
    for (const xmlCell of Array.from(xmlRow.getElementsByTagName("Cell"))) {
      const index = Number(xmlCell.getAttribute("ss:Index") ?? xmlCell.getAttribute("Index"));
      if (index > 0) nextIndex = index - 1;
      const data = xmlCell.getElementsByTagName("Data")[0];
      cells[nextIndex++] = data?.textContent?.trim() ?? null;
    }
    rows.push(cells);
  }
  return rows;
}

function dateValue(value: Cell): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 0) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const local = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  if (local) return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  return null;
}

function amountValue(value: Cell): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value ?? "").replace(/[^\d,.-]/g, "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",") && raw.includes(".")
    ? (raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, ""))
    : raw.includes(",") ? raw.replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowsToTransactions(rows: Row[], currency: NewTransactionInput["currency"]): NewTransactionInput[] {
  const aliases = Object.fromEntries(Object.entries(HEADER_NAMES).map(([key, names]) => [key, new Set(names)]));
  let headerIndex = -1;
  let columns: Record<string, number> = {};
  for (let i = 0; i < rows.length; i++) {
    const candidate: Record<string, number> = {};
    rows[i].forEach((cell, index) => {
      const name = normalize(cell);
      for (const [key, names] of Object.entries(aliases)) {
        if ([...names].some((alias) => name === alias || name.startsWith(`${alias} `) || name.startsWith(`${alias} (`))) {
          candidate[key] = index;
        }
      }
    });
    if (["date", "description", "category", "amount"].every((key) => key in candidate)) { headerIndex = i; columns = candidate; break; }
  }
  if (headerIndex < 0) {
    const isCategorySummary = rows.some((row) =>
      Array.from(row, (cell) => normalize(cell ?? null)).some((cell) =>
        /(?:gastos?|ingresos?|expenses?|income) por categor[ií]a|by categor(?:y|ies)/.test(cell),
      ),
    );
    throw new Error(
      isCategorySummary
        ? "CATEGORY_SUMMARY_NOT_TRANSACTION_ROWS"
        : "TRANSACTION_COLUMNS_NOT_FOUND",
    );
  }
  const result: NewTransactionInput[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const date = dateValue(row[columns.date]);
    const description = String(row[columns.description] ?? "").trim();
    const category = String(row[columns.category] ?? "").trim();
    let amount = amountValue(row[columns.amount]);
    if (!date || !description || !category || amount === null || amount === 0) continue;
    if (amount > 0 && columns.type !== undefined) {
      const kind = normalize(row[columns.type]);
      if (["gasto", "expense", "egreso"].includes(kind)) amount = -amount;
    }
    result.push({ date, description, category, amount, currency, recurrence: null });
  }
  if (!result.length) throw new Error("No se encontraron movimientos válidos en la hoja.");
  return result;
}

async function readRows(file: File): Promise<Row[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  let rows: Row[];
  if (extension === "csv" || extension === "tsv") rows = parseCsv(await file.text());
  else if (extension === "xml") rows = parseExcelXml(await file.text());
  else if (["xlsx", "xlsm", "xls", "xlsb", "ods"].includes(extension ?? "")) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error("El libro no contiene hojas.");
    rows = workbook.SheetNames.flatMap((sheetName) =>
      XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheetName], {
        header: 1,
        raw: true,
        defval: null,
      }),
    );
  } else throw new Error("Formato no compatible. Usa .xls, .xlsx, .xlsm, .xlsb, .ods, .xml, .csv o .tsv.");
  return rows;
}

export async function readTransactionSpreadsheet(file: File, currency: NewTransactionInput["currency"]): Promise<NewTransactionInput[]> {
  const rows = await readRows(file);
  return rowsToTransactions(rows, currency);
}

export type ImportedCategory = { name: string; value: number };

export async function readCategorySpreadsheet(file: File): Promise<ImportedCategory[]> {
  const rows = await readRows(file);
  const results = new Map<string, ImportedCategory>();
  let section: "expense" | "income" | null = null;
  let categoryColumn = -1;
  let valueColumn = -1;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    // XML spreadsheets can place a cell at a later column with ss:Index,
    // leaving sparse array slots. Array.from materializes those as nullish
    // values before string matching so empty cells are safe to inspect.
    const normalized = Array.from(row, (cell) => normalize(cell ?? null));
    const sectionCell = normalized.find((cell) => cell.includes("por categoría") || cell.includes("por categoria") || cell.includes("by category"));
    if (sectionCell) {
      section = /ingreso|income/.test(sectionCell) ? "income" : /gasto|expense/.test(sectionCell) ? "expense" : null;
      categoryColumn = -1;
      valueColumn = -1;
    }
    if (!section) continue;
    const foundCategoryColumn = normalized.findIndex((cell) => /categor[ií]a|category/.test(cell));
    const foundValueColumn = normalized.findIndex((cell) => /gastos?\s*\(|ingresos?\s*\(|importe|amount|total/.test(cell));
    if (foundCategoryColumn >= 0 && foundValueColumn >= 0) {
      categoryColumn = foundCategoryColumn;
      valueColumn = foundValueColumn;
    }
    if (categoryColumn < 0 || valueColumn < 0) continue;
    // The header identifies the following rows as category totals.
    for (const dataRow of rows.slice(rowIndex + 1)) {
      const name = String(dataRow[categoryColumn] ?? "").trim();
      const value = amountValue(dataRow[valueColumn]);
      if (!name || value === null || /^(total|subtotal)\b/i.test(name)) break;
      if (!results.has(name.toLocaleLowerCase())) results.set(name.toLocaleLowerCase(), { name, value });
    }
    section = null;
  }
  if (!results.size) throw new Error("No se encontró una tabla de categorías en el archivo.");
  return [...results.values()];
}
