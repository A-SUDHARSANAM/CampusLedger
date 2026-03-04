import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { DataTable, type TableColumn } from '../../components/tables';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import type { BorrowItem, BorrowRecord, ElectronicsCatalogItem } from '../../types/domain';
import { downloadSimplePdf } from '../../utils/pdf';
import { useLanguage } from '../../context/LanguageContext';

type CartLine = ElectronicsCatalogItem & { quantity: number };

export function LabAssetsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
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
      setStatusMessage(t('enterStudentDetails', 'Enter student details, due date, and at least one product.'));
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
    setStatusMessage(t('borrowCreated', 'Borrow request created with bill and invoice details.'));
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
    const maintenanceUpdates = record.issueUpdates.length ? record.issueUpdates.join(' | ') : t('noIssueUpdates', 'No issue updates');
    const total = record.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    downloadSimplePdf(`${record.borrowId}.pdf`, `${t('borrowingReports', 'Borrowing & Invoice Reports')} - ${record.borrowId}`, [
      `${t('bill', 'Bill')}: ${record.billNo}`,
      `${t('invoice', 'Invoice')}: ${record.invoiceNo}`,
      `${t('student', 'Student')}: ${record.studentName}`,
      `${t('project', 'Project')}: ${record.projectName}`,
      `${t('status', 'Status')}: ${record.status}`,
      `${t('date', 'Date')}: ${record.createdDate}`,
      `${t('returnDueDate', 'Return Due Date')}: ${record.dueDate}`,
      `${t('returnedDate', 'Returned Date')}: ${record.returnedDate ?? t('notReturnedYet', 'Not returned yet')}`,
      `${t('finePenalty', 'Fine/Penalty')}: Rs.${record.fineAmount}`,
      `${t('totalValue', 'Total Value')}: Rs.${total}`,
      `${t('productDetails', 'Product Details')}:`,
      ...itemLines,
      `${t('warranty', 'Warranty')}: ${record.items.map((item) => `${item.productName} ${item.warrantyMonths}m`).join(', ')}`,
      `${t('issueUpdates', 'Issue Updates')}: ${maintenanceUpdates}`
    ]);
  }

  const catalogColumns: TableColumn<ElectronicsCatalogItem>[] = useMemo(
    () => [
      { key: 'sku', header: 'SKU' },
      { key: 'name', header: t('product', 'Product') },
      { key: 'category', header: t('category', 'Category') },
      { key: 'unitCost', header: t('unitCost', 'Unit Cost'), render: (value) => `Rs.${value}` },
      { key: 'warrantyMonths', header: t('warranty', 'Warranty'), render: (value) => `${value} ${t('months', 'months')}` },
      { key: 'inStock', header: t('inStock', 'In Stock') },
      {
        key: 'id',
        header: t('action', 'Action'),
        render: (_, row) => (
          <button className="btn secondary-btn mini-btn" type="button" onClick={() => addToCart(row)}>
            {t('addToBorrowCart', 'Add to Borrow Cart')}
          </button>
        )
      }
    ],
    [t]
  );

  const borrowColumns: TableColumn<BorrowRecord>[] = useMemo(
    () => [
      { key: 'borrowId', header: t('borrowId', 'Borrow ID') },
      { key: 'studentName', header: t('student', 'Student') },
      { key: 'projectName', header: t('project', 'Project') },
      { key: 'billNo', header: t('bill', 'Bill') },
      { key: 'invoiceNo', header: t('invoice', 'Invoice') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'fineAmount', header: t('penalty', 'Penalty'), render: (value) => `Rs.${value}` },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn secondary-btn mini-btn" type="button" onClick={() => exportBorrowPdf(row)}>
              <Download size={13} /> {t('pdf', 'PDF')}
            </button>
            {row.status === 'Borrowed' ? (
              <>
                <button className="btn secondary-btn mini-btn" type="button" onClick={() => markReturn(row, false)}>
                  {t('return', 'Return')}
                </button>
                <button className="btn danger-btn mini-btn" type="button" onClick={() => markReturn(row, true)}>
                  {t('damaged', 'Damaged')}
                </button>
              </>
            ) : null}
          </div>
        )
      }
    ],
    [t]
  );

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitCost * item.quantity, 0), [cart]);

  return (
    <div className="dashboard-grid">
      <section className="card">
        <h2>{t('studentBorrowingDesk', 'Student Borrowing Desk')}</h2>
        <p>{t('studentBorrowingDesc', 'Issue electronics to students for project development with bill/invoice and downloadable PDF records.')}</p>
      </section>

      <section className="card borrow-form-grid">
        <label>
          <span className="label">{t('studentName', 'Student Name')}</span>
          <input className="input compact-input" value={studentName} onChange={(event) => setStudentName(event.target.value)} />
        </label>
        <label>
          <span className="label">{t('projectName', 'Project Name')}</span>
          <input className="input compact-input" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
        </label>
        <label>
          <span className="label">{t('returnDueDate', 'Return Due Date')}</span>
          <input className="input compact-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <button className="btn primary-btn save-btn" type="button" onClick={submitBorrowRequest}>
          <FileText size={14} /> {t('generateBorrowBill', 'Generate Borrow Bill')}
        </button>
      </section>

      <section className="card">
        <h3>{t('borrowCart', 'Borrow Cart')}</h3>
        <p>{t('total', 'Total')}: Rs.{cartTotal}</p>
        <div className="borrow-cart-list">
          {cart.length === 0 ? <p className="auth-subtitle">{t('noProductsSelected', 'No products selected.')}</p> : null}
          {cart.map((line) => (
            <div key={line.id} className="event-row">
              <span>{line.name}</span>
              <span>{t('qty', 'Qty')}: {line.quantity}</span>
              <span>Rs.{line.unitCost * line.quantity}</span>
            </div>
          ))}
        </div>
      </section>

      {statusMessage ? <p className="settings-status">{statusMessage}</p> : null}

      <DataTable data={catalog} columns={catalogColumns} title={t('electronicsCatalog', 'Electronics Catalog')} subtitle={t('electronicsCatalogDesc', 'Lab stock available for student projects')} />
      <DataTable
        data={borrowRecords}
        columns={borrowColumns}
        title={t('borrowRegister', 'Borrow Register')}
        subtitle={t('borrowRegisterDesc', 'Bill, invoice, product, warranty, issue updates, and penalties')}
      />
    </div>
  );
}
