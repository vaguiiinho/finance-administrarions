import type { FieldViolation } from '@shared/domain/app-error.js';
import type { ZodError } from 'zod';

const MESSAGES: Record<string, string> = {
  REQUIRED: 'Campo obrigatório.',
  INVALID_TYPE: 'Tipo de valor inválido.',
  UNKNOWN_FIELD: 'Campo não reconhecido.',
  EMPTY: 'Informe ao menos um item.',
  TOO_MANY_ITEMS: 'Quantidade máxima de itens excedida.',
  INVALID_FORMAT: 'Formato inválido.',
};

const violation = (field: string, code: string): FieldViolation => ({
  field,
  code,
  message: MESSAGES[code] ?? 'Valor inválido.',
});

/** ['ids', 0] -> 'ids[0]'; ['a', 'b'] -> 'a.b'; [] -> 'body'. */
function fieldName(path: readonly PropertyKey[]): string {
  if (path.length === 0) return 'body';
  return path.reduce<string>((acc, part) => {
    if (typeof part === 'number') return `${acc}[${part}]`;
    return acc === '' ? String(part) : `${acc}.${String(part)}`;
  }, '');
}

function valueAt(root: unknown, path: readonly PropertyKey[]): unknown {
  let current = root;
  for (const part of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<PropertyKey, unknown>)[part];
  }
  return current;
}

/** Traduz os issues do zod nos códigos de campo do contrato (REQUIRED, INVALID_TYPE, UNKNOWN_FIELD, ...). */
export function toViolations(error: ZodError, input: unknown): FieldViolation[] {
  return error.issues.flatMap((issue): FieldViolation[] => {
    switch (issue.code) {
      case 'invalid_type':
        return [violation(fieldName(issue.path), valueAt(input, issue.path) === undefined ? 'REQUIRED' : 'INVALID_TYPE')];
      case 'unrecognized_keys':
        return issue.keys.map((key) => violation(fieldName([...issue.path, key]), 'UNKNOWN_FIELD'));
      case 'too_small':
        return [violation(fieldName(issue.path), issue.origin === 'array' ? 'EMPTY' : 'INVALID_FORMAT')];
      case 'too_big':
        return [violation(fieldName(issue.path), issue.origin === 'array' ? 'TOO_MANY_ITEMS' : 'INVALID_FORMAT')];
      default:
        return [violation(fieldName(issue.path), 'INVALID_FORMAT')];
    }
  });
}
