import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { DataTable, type TableColumn } from '../../components/tables';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import type { BorrowItem, ElectronicsCatalogItem, ProcurementCategory, ProcurementRequest } from '../../types/domain';

type RequirementLine = ElectronicsCatalogItem & { quantity: number };

export function LabProcurementPage() {
  const { user } = useAuth();
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
      setStatus('Add at least one requirement to cart.');
      return;
    }
    await api.createProcurementRequest('lab', {
      requestedByLabId: user.labId,
      category,
      notes,
      items: buildItems()
    });
    setCart([]);
    setNotes('');
    setStatus('Requirement request submitted to admin.');
    await load();
  }

  const catalogColumns: TableColumn<ElectronicsCatalogItem>[] = useMemo(
    () => [
      { key: 'sku', header: 'SKU' },
      { key: 'name', header: 'Requirement Item' },
      { key: 'category', header: 'Category' },
      { key: 'unitCost', header: 'Estimated Cost', render: (value) => `Rs.${value}` },
      { key: 'inStock', header: 'Stock' },
      {
        key: 'id',
        header: 'Action',
        render: (_, row) => (
          <button className="btn secondary-btn mini-btn" type="button" onClick={() => addToCart(row)}>
            <ShoppingCart size={13} /> Add to Cart
          </button>
        )
      }
    ],
    []
  );

  const requestColumns: TableColumn<ProcurementRequest>[] = useMemo(
    () => [
      { key: 'requestNo', header: 'Request' },
      { key: 'category', header: 'Type' },
      { key: 'createdDate', header: 'Date' },
      { key: 'status', header: 'Status' },
      { key: 'vendorName', header: 'Vendor', render: (value) => String(value ?? '-') }
    ],
    []
  );

  return (
    <div className="dashboard-grid">
      <section className="card">
        <h2>Asset Requirement Requests</h2>
        <p>Visit requirements, add to cart, and submit purchase/service requests to admin.</p>
      </section>

      <section className="card borrow-form-grid">
        <label>
          <span className="label">Request Type</span>
          <select className="select compact-input" value={category} onChange={(event) => setCategory(event.target.value as ProcurementCategory)}>
            <option value="Purchase">Purchase</option>
            <option value="Service">Service</option>
          </select>
        </label>
        <label>
          <span className="label">Notes</span>
          <input className="input compact-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Requirement notes" />
        </label>
        <button className="btn primary-btn save-btn" type="button" onClick={submitProcurementRequest}>
          Submit to Admin
        </button>
      </section>

      <section className="card">
        <h3>Requirement Cart</h3>
        {cart.length === 0 ? <p className="auth-subtitle">No requirements selected.</p> : null}
        {cart.map((line) => (
          <div key={line.id} className="event-row">
            <span>{line.name}</span>
            <span>Qty: {line.quantity}</span>
            <span>Rs.{line.quantity * line.unitCost}</span>
          </div>
        ))}
      </section>
      {status ? <p className="settings-status">{status}</p> : null}

      <DataTable data={catalog} columns={catalogColumns} title="Requirement Catalog" subtitle="Electronics and service entries for requisition" />
      <DataTable data={requests} columns={requestColumns} title="My Requests" subtitle="Track approval and vendor status from admin" />
    </div>
  );
}
