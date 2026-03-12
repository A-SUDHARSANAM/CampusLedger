import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScanLine, Upload } from 'lucide-react';
import { DataTable, type TableColumn } from '../../components/tables';
import { OCRScanner, type OCRResult } from '../../components/OCRScanner';
import { api } from '../../services/api';
import type { ProcurementRequest } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

export function PurchaseDashboardPage() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<ProcurementRequest[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const rows = await api.getProcurementRequests('purchase_dept');
    setOrders(rows);
  }

  useEffect(() => {
    load();
  }, []);

  useAutoRefresh(load);

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
      { key: 'purchaseDepartmentName', header: t('purchaseDepartment', 'Purchase Department'), render: (v) => String(v ?? '-') },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) =>
          row.status === 'Sent to Purchase Dept' ? (
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
        <button className="btn secondary-btn" type="button" onClick={() => uploadInputRef.current?.click()}>
          <Upload size={14} style={{ marginRight: 6 }} />
          {t('uploadInvoice', 'Upload Invoice')}
        </button>
        <input ref={uploadInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleUploadInvoice} />

        {statusMsg && <span style={{ fontSize: '0.875em', opacity: 0.8 }}>{statusMsg}</span>}
      </section>

      {/* OCR scan result */}
      <OCRScanner
        title={t('scanInvoice', 'Scan Invoice (OCR)')}
        description={t('ocrPurchaseHint', 'Upload a photo of an invoice or delivery note to extract purchase details automatically.')}
        displayFields={['asset_name', 'serial_number', 'model', 'quantity', 'price', 'purchase_department', 'purchase_date']}
        onResult={(res) => {
          setOcrResult(res);
          setStatusMsg(t('scanComplete', 'Invoice scanned. Review extracted fields below.'));
        }}
      />

      {ocrResult && ocrResult.detected_fields && (() => {
        const f = ocrResult.detected_fields;
        const itemName = f.asset_name ?? '';
        const qty = f.quantity ?? '1';
        const price = f.price ?? '';
        const purchaseDept = f.purchase_department ?? '';
        const params = new URLSearchParams();
        if (itemName) params.set('item_name', itemName);
        if (qty) params.set('quantity', String(qty));
        if (price) params.set('estimated_cost', String(price));
        if (purchaseDept) params.set('purchase_department_name', purchaseDept);
        return (
          <section className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button
              className="btn primary-btn"
              type="button"
              onClick={() => {
                // Navigate to procurement request form (if available) or show helper
                setStatusMsg(t('ocrRequestHint', `Ready to create request: ${itemName || 'item'} × ${qty}`));
              }}
            >
              <ScanLine size={14} style={{ marginRight: 6 }} />
              {t('createPurchaseRequest', 'Create Purchase Request')}
            </button>
            <span style={{ fontSize: '0.82rem', opacity: 0.6 }}>
              {itemName && `${itemName}`}{qty && ` × ${qty}`}{price && ` @ ${price}`}
            </span>
          </section>
        );
      })()}

      <DataTable
        data={orders}
        columns={columns}
        title={t('purchaseOrders', 'Purchase Orders')}
        subtitle={t('purchaseOrdersDesc', 'Approved and ordered requests assigned to purchase department')}
      />
    </div>
  );
}
