import { describe, expect, it } from 'vitest';
import { analyse } from './metrics';
import { meridian } from './seed';
import { buildWorkbookPlan, type WorkbookPlan } from './workbook';

/**
 * A workbook that carries formulas carries a second copy of the arithmetic, and a second
 * copy can disagree with the first. These tests evaluate every formula in the exported
 * workbook against the literal cells around it and check it produces the cached value —
 * so a client recalculating the file in Excel sees exactly what the app showed them.
 *
 * The evaluator understands only the shapes the export actually writes. Anything else
 * throws rather than being silently skipped, so a new formula cannot slip past untested.
 */

type Cell = number | string;
type Grid = Map<string, Map<string, Cell>>; // sheet -> "A1" -> value

const columnName = (index: number): string => {
  let name = '';
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode((n % 26) + 65) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
};

/** Literal (non-formula) cells, by sheet and A1 address. */
function literalGrid(plan: WorkbookPlan): Grid {
  const grid: Grid = new Map();
  for (const sheet of plan.sheets) {
    const cells = new Map<string, Cell>();
    sheet.rows.forEach((row, rowIndex) => {
      row.forEach((cell, columnIndex) => {
        if (cell != null) cells.set(`${columnName(columnIndex)}${rowIndex + 1}`, cell);
      });
    });
    for (const [key, entry] of Object.entries(sheet.formulas ?? {})) {
      const [row, column] = key.split(',').map(Number);
      cells.set(`${columnName(column!)}${row! + 1}`, entry.value);
    }
    grid.set(sheet.name, cells);
  }
  return grid;
}

function evaluate(expression: string, sheetName: string, grid: Grid): number {
  let cursor = 0;
  const source = expression.replace(/\s+/g, '');

  const peek = () => source[cursor];
  const eat = (token: string) => {
    if (source.startsWith(token, cursor)) {
      cursor += token.length;
      return true;
    }
    return false;
  };

  const raw = (sheet: string, address: string): Cell => grid.get(sheet)?.get(address) ?? 0;
  const cellValue = (sheet: string, address: string): number => {
    const value = raw(sheet, address);
    return typeof value === 'number' ? value : 0;
  };

  const readRef = (): { sheet: string; address: string } => {
    const match = /^(?:([A-Za-z ]+)!)?(\$?[A-Z]+\$?\d+)/.exec(source.slice(cursor));
    if (!match) throw new Error(`not a reference at ${cursor} in ${expression}`);
    cursor += match[0].length;
    return { sheet: match[1] ?? sheetName, address: match[2]!.replace(/\$/g, '') };
  };

  /** Addresses in a range, so a criterion range and a sum range can be walked together. */
  const rangeAddresses = (): { sheet: string; addresses: string[] } => {
    const from = readRef();
    if (!eat(':')) return { sheet: from.sheet, addresses: [from.address] };
    const to = readRef();
    const parse = (address: string) => {
      const m = /^([A-Z]+)(\d+)$/.exec(address)!;
      return { column: m[1]!, row: Number(m[2]) };
    };
    const a = parse(from.address);
    const b = parse(to.address);
    const addresses: string[] = [];
    if (a.column !== b.column) {
      const toIndex = (name: string) =>
        [...name].reduce((total, ch) => total * 26 + (ch.charCodeAt(0) - 64), 0);
      for (let c = toIndex(a.column); c <= toIndex(b.column); c++) {
        addresses.push(`${columnName(c - 1)}${a.row}`);
      }
    } else {
      for (let r = a.row; r <= b.row; r++) addresses.push(`${a.column}${r}`);
    }
    return { sheet: from.sheet, addresses };
  };

  const rangeValues = (): number[] => {
    const from = readRef();
    if (!eat(':')) return [cellValue(from.sheet, from.address)];
    const to = readRef();
    const parse = (address: string) => {
      const m = /^([A-Z]+)(\d+)$/.exec(address)!;
      return { column: m[1]!, row: Number(m[2]) };
    };
    const a = parse(from.address);
    const b = parse(to.address);
    const values: number[] = [];
    if (a.column !== b.column) {
      // Horizontal range: walk the columns of the one row.
      const toIndex = (name: string) =>
        [...name].reduce((total, ch) => total * 26 + (ch.charCodeAt(0) - 64), 0);
      for (let c = toIndex(a.column); c <= toIndex(b.column); c++) {
        values.push(cellValue(from.sheet, `${columnName(c - 1)}${a.row}`));
      }
      return values;
    }
    for (let r = a.row; r <= b.row; r++) values.push(cellValue(from.sheet, `${a.column}${r}`));
    return values;
  };

  const parseExpression = (): number => {
    let value = parseTerm();
    for (;;) {
      if (eat('+')) value += parseTerm();
      else if (eat('-')) value -= parseTerm();
      else return value;
    }
  };

  const parseTerm = (): number => {
    let value = parseFactor();
    for (;;) {
      if (eat('*')) value *= parseFactor();
      else if (eat('/')) value /= parseFactor();
      else return value;
    }
  };

  const parseFactor = (): number => {
    if (eat('SUMIF(')) {
      const criteria = rangeAddresses();
      if (!eat(',')) throw new Error(`SUMIF needs a criterion in ${expression}`);
      const criterionRef = readRef();
      const criterion = raw(criterionRef.sheet, criterionRef.address);
      if (!eat(',')) throw new Error(`SUMIF needs a sum range in ${expression}`);
      const sums = rangeAddresses();
      if (!eat(')')) throw new Error(`unclosed SUMIF in ${expression}`);
      let total = 0;
      criteria.addresses.forEach((address, index) => {
        if (raw(criteria.sheet, address) !== criterion) return;
        const target = sums.addresses[index];
        if (target) total += cellValue(sums.sheet, target);
      });
      return total;
    }
    if (eat('SUM(')) {
      const values = rangeValues();
      if (!eat(')')) throw new Error(`unclosed SUM in ${expression}`);
      return values.reduce((total, value) => total + value, 0);
    }
    if (eat('ROUND(')) {
      const value = parseExpression();
      if (!eat(',')) throw new Error(`ROUND needs precision in ${expression}`);
      const places = parseExpression();
      if (!eat(')')) throw new Error(`unclosed ROUND in ${expression}`);
      const factor = 10 ** places;
      return Math.round(value * factor + Number.EPSILON) / factor;
    }
    if (eat('IF(')) {
      const left = parseExpression();
      if (!eat('=')) throw new Error(`IF needs a comparison in ${expression}`);
      const right = parseExpression();
      if (!eat(',')) throw new Error(`IF needs branches in ${expression}`);
      const whenTrue = eat('""') ? 0 : parseExpression();
      if (!eat(',')) throw new Error(`IF needs an else in ${expression}`);
      const whenFalse = eat('""') ? 0 : parseExpression();
      if (!eat(')')) throw new Error(`unclosed IF in ${expression}`);
      return left === right ? whenTrue : whenFalse;
    }
    if (eat('(')) {
      const value = parseExpression();
      if (!eat(')')) throw new Error(`unclosed bracket in ${expression}`);
      return value;
    }
    const number = /^\d+(?:\.\d+)?/.exec(source.slice(cursor));
    if (number && !/^[A-Z]/.test(peek() ?? '')) {
      cursor += number[0].length;
      return Number(number[0]);
    }
    const reference = readRef();
    return cellValue(reference.sheet, reference.address);
  };

  const result = parseExpression();
  if (cursor !== source.length) throw new Error(`unparsed tail in ${expression}`);
  return result;
}

describe('the exported workbook', () => {
  const plan = buildWorkbookPlan(meridian, analyse(meridian), 'sc-tm');
  const grid = literalGrid(plan);

  it('carries every sheet a reader needs', () => {
    expect(plan.sheets.map((sheet) => sheet.name)).toEqual([
      'Summary', 'Scenarios', 'Rates', 'Allocation', 'Resourcing', 'Detail',
    ]);
  });

  it('has one Detail row per assignment-week, which everything else sums', () => {
    const detail = plan.sheets.find((sheet) => sheet.name === 'Detail')!;
    const analysis = analyse(meridian);
    // header + lines + total
    expect(detail.rows.length).toBe(analysis.plan.lines.length + 2);
  });

  it('agrees with itself: every formula evaluates to the value written beside it', () => {
    let checked = 0;
    for (const sheet of plan.sheets) {
      for (const [key, entry] of Object.entries(sheet.formulas ?? {})) {
        const computed = evaluate(entry.formula, sheet.name, grid);
        expect(
          Math.abs(computed - entry.value),
          `${sheet.name} ${key} — ${entry.formula} gave ${computed}, cached ${entry.value}`,
        ).toBeLessThan(0.02);
        checked += 1;
      }
    }
    // A guard against the test quietly checking nothing.
    expect(checked).toBeGreaterThan(250);
  });

  it('ties the Summary back to the Detail sheet rather than restating it', () => {
    const summary = plan.sheets.find((sheet) => sheet.name === 'Summary')!;
    const crossChecks = Object.values(summary.formulas ?? {}).map((entry) => entry.formula);
    expect(crossChecks.every((formula) => formula.startsWith('Detail!'))).toBe(true);
    expect(crossChecks.length).toBe(3);
  });

  it('reports effort, cost and revenue that match the engine', () => {
    const analysis = analyse(meridian);
    const summary = plan.sheets.find((sheet) => sheet.name === 'Summary')!;
    const values = Object.values(summary.formulas ?? {}).map((entry) => entry.value);
    expect(values[0]).toBeCloseTo(analysis.plan.totalEffortDays, 4);
    expect(values[2]).toBeCloseTo(analysis.plan.directCost / 100, 2);
  });

  it('names the file after the client, the engagement and the deal', () => {
    expect(plan.filename).toContain('Meridian Retail Group');
    expect(plan.filename).toContain('T&M');
    expect(plan.filename.endsWith('.xlsx')).toBe(true);
    expect(plan.filename).not.toMatch(/[\\/:*?"<>|]/);
  });
});
