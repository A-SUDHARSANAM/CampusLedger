import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScanLine, Upload } from 'lucide-react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { ProcurementRequest } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

export function PurchaseDashboardPage() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<ProcurementRequest[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<Record<string, unknown> | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const rows = await api.getProcurementRequests('purchase_dept');
    setOrders(rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleScanInvoice(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanResult(null);
    try {
      const result = await api.scanInvoice(file);
      setScanResult(result);
      setStatusMsg(t('scanComplete', 'Invoice scanned. Review extracted fields below.'));
    } catch {
      setStatusMsg(t('scanFailed', 'OCR scan failed.'));
    } finally {
      setScanning(false);
    }
  }

  async function handleUploadInvoice(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.uploadInvoice(file);
      setStatusMsg(result.url ? `${t('uploadedTo', 'Uploaded to')}: ${result.url}` : t('uploadComplete', 'Invoice uploaded.'));
    } catch {
      setStatusMsg(t('uploadFailed', 'Upload failed.'));
    }
  }

  async function handleConfirmPayment(row: ProcurementRequest) {
    try {
      await api.confirmPayment(row.id);
      setStatusMsg(t('paymentConfirmed', 'Payment confirmed.'));
      await load();
    } catch {
      setStatusMsg(t('actionFailed', 'Action failed.'));
    }
  }

  const columns: TableColumn<ProcurementRequest>[] = useMemo(
    () => [
      { key: 'requestNo', header: t('requestNo', 'Request No') },
      { key: 'requestedByLabName', header: t('lab', 'Lab') },
      { key: 'createdDate', header: t('date', 'Date') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'vendorName', header: t('vendor', 'Vendor'), render: (v) => String(v ?? '-') },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) =>
          row.status === 'Sent to Vendor' ? (
            <button className="btn primary-btn mini-btn" type="button" onClick={() => handleConfirmPayment(row)}>
              {t('confirmPayment', 'Confirm Payment')}
            </button>
          ) : (
            <span style={{ opacity: 0.5, fontSize: '0.8em' }}>{row.status}</span>
          )
      }
    ],
    [t, orders]
  );

  return (
    <div className="dashboard-grid">
      <div className="page-intro">
        <h2>{t('purchasePortal', 'Purchase Department Portal')}</h2>
        <p>{t('purchasePortalDesc', 'Manage purchase orders, upload invoices, and confirm payments.')}</p>
      </div>

      {/* Invoice tools */}
      <section className="card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn primary-btn"
          type="button"
          onClick={() => scanInputRef.current?.click()}
          disabled={scanning}
        >
          <ScanLine size={14} style={{ marginRight: 6 }} />
          {scanning ? t('scanning', 'Scanning…') : t('scanInvoice', 'Scan Invoice (OCR)')}
        </button>
        <input ref={scanInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScanInvoice} />

        <button className="btn secondary-btn" type="button" onClick={() => uploadInputRef.current?.click()}>
          <Upload size={14} style={{ marginRight: 6 }} />
          {t('uploadInvoice', 'Upload Invoice')}
        </button>
        <input ref={uploadInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleUploadInvoice} />

        {statusMsg && <span style={{ fontSize: '0.875em', opacity: 0.8 }}>{statusMsg}</span>}
      </section>

      {/* OCR scan result */}
      {scanResult && Object.keys(scanResult).length > 0 && (
        <section className="card">
          <h3 style={{ marginBottom: 12 }}>{t('scanResult', 'Extracted Invoice Data')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {['product_name', 'serial_number', 'purchase_date', 'warranty_period', 'price'].map((field) =>
              scanResult[field] != null ? (
                <div key={field} className="metric-card" style={{ padding: 12 }}>
                  <p className="metric-title" style={{ textTransform: 'capitalize' }}>{field.replace(/_/g, ' ')}</p>
                  <p className="metric-value" style={{ fontSize: '1em' }}>{String(scanResult[field])}</p>
                </div>
              ) : null
            )}
          </div>
        </section>
      )}

      <DataTable
        data={orders}
        columns={columns}
        title={t('purchaseOrders', 'Purchase Orders')}
        subtitle={t('purchaseOrdersDesc', 'Approved and ordered requests assigned to purchase department')}
      />
    </div>
  );
}
