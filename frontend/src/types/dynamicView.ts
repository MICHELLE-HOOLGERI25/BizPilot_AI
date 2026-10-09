export type ViewWidget =
  | { id: string; type: 'kpi'; title: string; value: number; format?: 'currency' | 'integer' | 'percent'; description?: string }
  | { id: string; type: 'bar' | 'line'; title: string; data: Array<Record<string, string | number>>; xKey: string; yKey: string; format?: 'currency' | 'integer' }
  | { id: string; type: 'table'; title: string; columns: { key: string; label: string }[]; rows: Array<Record<string, string | number>> };

export interface DynamicView {
  id: string;
  title: string;
  description: string;
  source: 'demo' | 'backend';
  createdAt: string;
  widgets: ViewWidget[];
}

export function validateDynamicView(value: unknown): value is DynamicView {
  if (!value || typeof value !== 'object') return false;
  const view = value as Partial<DynamicView>;
  if (typeof view.id !== 'string' || typeof view.title !== 'string' || typeof view.description !== 'string' || !Array.isArray(view.widgets) || !['demo', 'backend'].includes(view.source ?? '') || typeof view.createdAt !== 'string') return false;
  if (view.widgets.length > 20) return false;
  return view.widgets.every(widget => {
    if (!widget || typeof widget !== 'object' || typeof widget.id !== 'string' || typeof widget.title !== 'string') return false;
    if (widget.type === 'kpi') return typeof widget.value === 'number' && Number.isFinite(widget.value) && (widget.format === undefined || ['currency', 'integer', 'percent'].includes(widget.format));
    if (widget.type === 'bar' || widget.type === 'line') return typeof widget.xKey === 'string' && typeof widget.yKey === 'string' && (widget.format === undefined || ['currency', 'integer'].includes(widget.format)) && Array.isArray(widget.data) && widget.data.length <= 500 && widget.data.every(row => row && typeof row === 'object' && typeof row[widget.xKey] === 'string' && typeof row[widget.yKey] === 'number' && Number.isFinite(row[widget.yKey]));
    if (widget.type === 'table') return Array.isArray(widget.columns) && widget.columns.length <= 12 && widget.columns.every(column => typeof column.key === 'string' && typeof column.label === 'string') && Array.isArray(widget.rows) && widget.rows.length <= 200 && widget.rows.every(row => row && typeof row === 'object' && widget.columns.every(column => typeof row[column.key] === 'string' || typeof row[column.key] === 'number'));
    return false;
  });
}
