import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { DataTable, type TableColumn } from '../../components/tables';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import type { BorrowItem, ElectronicsCatalogItem, ProcurementCategory, ProcurementRequest } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

type RequirementLine = ElectronicsCatalogItem & { quantity: number };

export function LabProcurementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [catalog, setCatalog] = useState<ElectronicsCatalogItem[]>([]);
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [cart, setCart] = useState<RequirementLine[]>([]);
  const [category, setCategory] = useState<ProcurementCategory>('Purchase');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');

  async function load() {
    if (!user?.labId) return;
    const [catalogRows, reqRows] = await Promise.all([api.getElectronicsCatalog(), api.getProcurementRequests('lab', user.labId)]);
    setCatalog(catalogRows);
    setRequests(reqRows);
  }

  useEffect(() => {
    load();
  }, [user?.labId]);

  function addToCart(item: ElectronicsCatalogItem) {
    setCart((prev) => {
      const existing = prev.find((line) => line.id === item.id);
      if (existing) {
        return prev.map((line) => (line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  function buildItems(): BorrowItem[] {
    return cart.map((line) => ({
      itemId: line.id,
      sku: line.sku,
      productName: line.name,
      quantity: line.quantity,
      unitCost: line.unitCost,
      warrantyMonths: line.warrantyMonths
    }));
  }

  async function submitProcurementRequest() {
    if (!user?.labId) return;
    if (cart.length === 0) {
      setStatus(t('atLeastOneRequirement', 'Add at least one requirement to cart.'));
      return;
    }
    setStatus('');
    try {
      await api.createProcurementRequest('lab', {
        requestedByLabId: user.labId,
        category,
        notes,
        items: buildItems()
      });
      setCart([]);
      setNotes('');
      setStatus(t('requirementSubmitted', 'Requirement request submitted to admin.'));
      await load();
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : t('submitFailed', 'Failed to submit request. Please try again.'));
    }
  }

  const catalogColumns: TableColumn<ElectronicsCatalogItem>[] = useMemo(
    () => [
      { key: 'sku', header: 'SKU' },
      { key: 'name', header: t('requirementItem', 'Requirement Item') },
      { key: 'category', header: t('category', 'Category') },
      { key: 'unitCost', header: t('estimatedCost', 'Estimated Cost'), render: (value) => `Rs.${value}` },
      { key: 'inStock', header: t('stock', 'Stock') },
      {
        key: 'id',
        header: t('action', 'Action'),
        render: (_, row) => (
          <button className="btn secondary-btn mini-btn" type="button" onClick={() => addToCart(row)}>
            <ShoppingCart size={13} /> {t('addToCart', 'Add to Cart')}
          </button>
        )
      }
    ],
    [t]
  );

  const requestColumns: TableColumn<ProcurementRequest>[] = useMemo(
    () => [
      { key: 'requestNo', header: t('request', 'Request') },
      { key: 'category', header: t('type', 'Type') },
      { key: 'createdDate', header: t('date', 'Date') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'purchaseDepartmentName', header: t('purchaseDepartment', 'Purchase Department'), render: (value) => String(value ?? '-') }
    ],
    [t]
  );

  return (
    <div className="dashboard-grid">
      <section className="card">
        <h2>{t('assetRequirementRequests', 'Asset Requirement Requests')}</h2>
        <p>{t('assetRequirementDesc', 'Visit requirements, add to cart, and submit purchase/service requests to admin.')}</p>
      </section>

      <section className="card borrow-form-grid">
        <label>
          <span className="label">{t('requestType', 'Request Type')}</span>
          <select className="select compact-input" value={category} onChange={(event) => setCategory(event.target.value as ProcurementCategory)}>
            <option value="Purchase">{t('purchase', 'Purchase')}</option>
            <option value="Service">{t('service', 'Service')}</option>
          </select>
        </label>
        <label>
          <span className="label">{t('notes', 'Notes')}</span>
          <input className="input compact-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('requirementNotes', 'Requirement notes')} />
        </label>
        <button className="btn primary-btn save-btn" type="button" onClick={submitProcurementRequest}>
          {t('submitToAdmin', 'Submit to Admin')}
        </button>
      </section>

      <section className="card">
        <h3>{t('requirementCart', 'Requirement Cart')}</h3>
        {cart.length === 0 ? <p className="auth-subtitle">{t('noRequirementsSelected', 'No requirements selected.')}</p> : null}
        {cart.map((line) => (
          <div key={line.id} className="event-row">
            <span>{line.name}</span>
            <span>{t('qty', 'Qty')}: {line.quantity}</span>
            <span>Rs.{line.quantity * line.unitCost}</span>
          </div>
        ))}
      </section>
      {status ? <p className="settings-status" style={{ color: status.toLowerCase().includes('fail') || status.toLowerCase().includes('error') || status.toLowerCase().includes('try again') ? 'var(--danger)' : undefined }}>{status}</p> : null}

      <DataTable data={catalog} columns={catalogColumns} title={t('requirementCatalog', 'Requirement Catalog')} subtitle={t('requirementCatalogDesc', 'Electronics and service entries for requisition')} />
      <DataTable data={requests} columns={requestColumns} title={t('myRequests', 'My Requests')} subtitle={t('myRequestsDesc', 'Track approval and vendor status from admin')} />
    </div>
  );
}
