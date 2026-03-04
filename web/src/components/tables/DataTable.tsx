import React, { useMemo, useState } from 'react';
import './table-ui.css';
import { useLanguage } from '../../context/LanguageContext';

export type TableColumn<T> = {
  key: keyof T;
  header: string;
  className?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
};

export type TableFilter = {
  label: string;
  value: string;
};

type DataTableProps<T extends Record<string, unknown>> = {
  title?: string;
  subtitle?: string;
  data: T[];
  columns: TableColumn<T>[];
  searchPlaceholder?: string;
  filters?: TableFilter[];
  onFilterChange?: (filter: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function DataTable<T extends Record<string, unknown>>({
  title = 'Records',
  subtitle = 'Manage and review entries',
  data,
  columns,
  searchPlaceholder = 'Search records...',
  filters = [],
  onFilterChange,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your search or filter criteria.'
}: DataTableProps<T>) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(filters[0]?.value ?? 'all');

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return data;
    }

    return data.filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [data, query]);

  return (
    <section className="table-card">
      <header className="table-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </header>

      <div className="table-toolbar">
        <div className="table-search-wrap">
          <input
            aria-label={t('searchRecords', 'Search records')}
            className="table-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder === 'Search records...' ? t('searchRecordsEllipsis', 'Search records...') : searchPlaceholder}
          />
        </div>

        {filters.length > 0 ? (
          <div className="table-filters" role="tablist" aria-label="Table filters">
            {filters.map((filter) => (
              <button
                className={`table-filter-btn ${activeFilter === filter.value ? 'active' : ''}`}
                key={filter.value}
                type="button"
                onClick={() => {
                  setActiveFilter(filter.value);
                  onFilterChange?.(filter.value);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {filteredRows.length === 0 ? (
        <div className="table-empty">
          <div className="table-empty-icon" />
          <h4>{emptyTitle === 'No records found' ? t('noRecordsFound', emptyTitle) : emptyTitle}</h4>
          <p>{emptyDescription === 'Try adjusting your search or filter criteria.' ? t('adjustSearchFilter', emptyDescription) : emptyDescription}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th className={column.className} key={String(column.key)}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => {
                    const raw = row[column.key];
                    return (
                      <td className={column.className} key={String(column.key)}>
                        {column.render ? column.render(raw, row) : typeof raw === 'string' ? t(raw, raw) : String(raw)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
