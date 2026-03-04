import React, { useMemo, useState } from 'react';
import './table-ui.css';
import { useLanguage } from '../../context/LanguageContext';

export type ListItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  status?: 'active' | 'pending' | 'critical';
};

type DataListProps = {
  title?: string;
  subtitle?: string;
  items: ListItem[];
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function DataList({
  title = 'Activity List',
  subtitle = 'Recent updates and entries',
  items,
  searchPlaceholder = 'Search list...',
  emptyTitle = 'No list items',
  emptyDescription = 'There are no matching entries for this list.'
}: DataListProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(normalized) ||
        item.subtitle?.toLowerCase().includes(normalized) ||
        item.meta?.toLowerCase().includes(normalized)
    );
  }, [items, query]);

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
            aria-label={t('searchList', 'Search list')}
            className="table-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder === 'Search list...' ? t('searchListEllipsis', 'Search list...') : searchPlaceholder}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="table-empty">
          <div className="table-empty-icon" />
          <h4>{emptyTitle === 'No list items' ? t('noListItems', emptyTitle) : emptyTitle}</h4>
          <p>{emptyDescription === 'There are no matching entries for this list.' ? t('noMatchingListEntries', emptyDescription) : emptyDescription}</p>
        </div>
      ) : (
        <div className="list-wrap">
          {rows.map((item) => (
            <article className="list-row" key={item.id}>
              <div>
                <h4>{item.title}</h4>
                {item.subtitle ? <p>{item.subtitle}</p> : null}
              </div>
              <div className="list-meta">
                {item.meta ? <span>{item.meta}</span> : null}
                {item.status ? <span className={`status-pill ${item.status}`}>{t(item.status, item.status)}</span> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
