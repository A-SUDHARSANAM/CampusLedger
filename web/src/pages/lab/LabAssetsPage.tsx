import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { DataTable, type TableColumn } from '../../components/tables';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import type { BorrowItem, BorrowRecord, ElectronicsCatalogItem } from '../../types/domain';
import { downloadSimplePdf } from '../../utils/pdf';

type CartLine = ElectronicsCatalogItem & { quantity: number };

export function LabAssetsPage() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<ElectronicsCatalogItem[]>([]);
  const [borrowRecords, setBorrowRecords] = useState<BorrowRecord[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [studentName, setStudentName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  async function loadData() {
    if (!user?.labId) return;
    const [catalogRows, borrowRows] = await Promise.all([api.getElectronicsCatalog(), api.getBorrowRecords('lab', user.labId)]);
    setCatalog(catalogRows);
    setBorrowRecords(borrowRows);
  }

  useEffect(() => {
    loadData();
  }, [user?.labId]);

  function addToCart(item: ElectronicsCatalogItem) {
    setCart((prev) => {
      const found = prev.find((line) => line.id === item.id);
      if (found) {
        return prev.map((line) => (line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  function buildBorrowItems(): BorrowItem[] {
    return cart.map((line) => ({
      itemId: line.id,
      sku: line.sku,
      productName: line.name,
      quantity: line.quantity,
      unitCost: line.unitCost,
      warrantyMonths: line.warrantyMonths
    }));
  }

  async function submitBorrowRequest() {
    if (!user?.labId) return;
    if (!studentName.trim() || !projectName.trim() || !dueDate || cart.length === 0) {
      setStatusMessage('Enter student details, due date, and at least one product.');
      return;
    }
    await api.createBorrowRequest('lab', {
      labId: user.labId,
      studentName: studentName.trim(),
      projectName: projectName.trim(),
      dueDate,
      items: buildBorrowItems()
    });
    setCart([]);
    setStudentName('');
    setProjectName('');
    setDueDate('');
    setStatusMessage('Borrow request created with bill and invoice details.');
    await loadData();
  }

  async function markReturn(record: BorrowRecord, damaged: boolean) {
    await api.returnBorrowItem('lab', record.borrowId, {
      damaged,
      remark: damaged ? 'Returned with physical damage' : 'Returned in good condition'
    });
    await loadData();
  }

  function exportBorrowPdf(record: BorrowRecord) {
    const itemLines = record.items.map((item) => `${item.productName} (${item.sku}) x${item.quantity} | Rs.${item.unitCost}`);
    const maintenanceUpdates = record.issueUpdates.length ? record.issueUpdates.join(' | ') : 'No issue updates';
    const total = record.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    downloadSimplePdf(`${record.borrowId}.pdf`, `CampusLedger Borrow Invoice - ${record.borrowId}`, [
      `Bill No: ${record.billNo}`,
      `Invoice No: ${record.invoiceNo}`,
      `Student: ${record.studentName}`,
      `Project: ${record.projectName}`,
      `Status: ${record.status}`,
      `Borrow Date: ${record.createdDate}`,
      `Due Date: ${record.dueDate}`,
      `Returned Date: ${record.returnedDate ?? 'Not returned yet'}`,
      `Fine/Penalty: Rs.${record.fineAmount}`,
      `Total Value: Rs.${total}`,
      'Product Details:',
      ...itemLines,
      `Warranty: ${record.items.map((item) => `${item.productName} ${item.warrantyMonths}m`).join(', ')}`,
      `Issue Updates: ${maintenanceUpdates}`
    ]);
  }

  const catalogColumns: TableColumn<ElectronicsCatalogItem>[] = useMemo(
    () => [
      { key: 'sku', header: 'SKU' },
      { key: 'name', header: 'Product' },
      { key: 'category', header: 'Category' },
      { key: 'unitCost', header: 'Unit Cost', render: (value) => `Rs.${value}` },
      { key: 'warrantyMonths', header: 'Warranty', render: (value) => `${value} months` },
      { key: 'inStock', header: 'In Stock' },
      {
        key: 'id',
        header: 'Action',
        render: (_, row) => (
          <button className="btn secondary-btn mini-btn" type="button" onClick={() => addToCart(row)}>
            Add to Borrow Cart
          </button>
        )
      }
    ],
    []
  );

  const borrowColumns: TableColumn<BorrowRecord>[] = useMemo(
    () => [
      { key: 'borrowId', header: 'Borrow ID' },
      { key: 'studentName', header: 'Student' },
      { key: 'projectName', header: 'Project' },
      { key: 'billNo', header: 'Bill' },
      { key: 'invoiceNo', header: 'Invoice' },
      { key: 'status', header: 'Status' },
      { key: 'fineAmount', header: 'Penalty', render: (value) => `Rs.${value}` },
      {
        key: 'id',
        header: 'Actions',
        render: (_, row) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn secondary-btn mini-btn" type="button" onClick={() => exportBorrowPdf(row)}>
              <Download size={13} /> PDF
            </button>
            {row.status === 'Borrowed' ? (
              <>
                <button className="btn secondary-btn mini-btn" type="button" onClick={() => markReturn(row, false)}>
                  Return
                </button>
                <button className="btn danger-btn mini-btn" type="button" onClick={() => markReturn(row, true)}>
                  Damaged
                </button>
              </>
            ) : null}
          </div>
        )
      }
    ],
    []
  );

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitCost * item.quantity, 0), [cart]);

  return (
    <div className="dashboard-grid">
      <section className="card">
        <h2>Student Borrowing Desk</h2>
        <p>Issue electronics to students for project development with bill/invoice and downloadable PDF records.</p>
      </section>

      <section className="card borrow-form-grid">
        <label>
          <span className="label">Student Name</span>
          <input className="input compact-input" value={studentName} onChange={(event) => setStudentName(event.target.value)} />
        </label>
        <label>
          <span className="label">Project Name</span>
          <input className="input compact-input" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
        </label>
        <label>
          <span className="label">Return Due Date</span>
          <input className="input compact-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <button className="btn primary-btn save-btn" type="button" onClick={submitBorrowRequest}>
          <FileText size={14} /> Generate Borrow Bill
        </button>
      </section>

      <section className="card">
        <h3>Borrow Cart</h3>
        <p>Total: Rs.{cartTotal}</p>
        <div className="borrow-cart-list">
          {cart.length === 0 ? <p className="auth-subtitle">No products selected.</p> : null}
          {cart.map((line) => (
            <div key={line.id} className="event-row">
              <span>{line.name}</span>
              <span>Qty: {line.quantity}</span>
              <span>Rs.{line.unitCost * line.quantity}</span>
            </div>
          ))}
        </div>
      </section>

      {statusMessage ? <p className="settings-status">{statusMessage}</p> : null}

      <DataTable data={catalog} columns={catalogColumns} title="Electronics Catalog" subtitle="Lab stock available for student projects" />
      <DataTable
        data={borrowRecords}
        columns={borrowColumns}
        title="Borrow Register"
        subtitle="Bill, invoice, product, warranty, issue updates, and penalties"
      />
    </div>
  );
}
