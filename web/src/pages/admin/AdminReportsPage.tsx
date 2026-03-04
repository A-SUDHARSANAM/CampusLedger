import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { BorrowRecord } from '../../types/domain';
import { downloadSimplePdf } from '../../utils/pdf';
import { useLanguage } from '../../context/LanguageContext';

export function AdminReportsPage() {
  const { t } = useLanguage();
  const [records, setRecords] = useState<BorrowRecord[]>([]);

  useEffect(() => {
    api.getBorrowRecords('admin').then(setRecords);
  }, []);

  const columns: TableColumn<BorrowRecord>[] = useMemo(
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
        header: t('download', 'Download'),
        render: (_, row) => (
          <button
            className="btn secondary-btn mini-btn"
            type="button"
            onClick={() =>
              downloadSimplePdf(`${row.borrowId}-admin.pdf`, `Borrow Record ${row.borrowId}`, [
                `Bill: ${row.billNo}`,
                `Invoice: ${row.invoiceNo}`,
                `Student: ${row.studentName}`,
                `Project: ${row.projectName}`,
                `Status: ${row.status}`,
                `Warranty: ${row.items.map((item) => `${item.productName} ${item.warrantyMonths}m`).join(', ')}`,
                `Issue Updates: ${row.issueUpdates.join(' | ')}`,
                `Penalty: Rs.${row.fineAmount}`
              ])
            }
          >
            <Download size={13} /> {t('pdf', 'PDF')}
          </button>
        )
      }
    ],
    [t]
  );

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>{t('borrowingReports', 'Borrowing & Invoice Reports')}</h2>
        <p>{t('borrowingReportsDesc', 'Save and download bill, invoice, product, warranty, issue updates, and penalties as PDF.')}</p>
      </div>
      <DataTable data={records} columns={columns} title={t('borrowingReportsTable', 'Borrowing Reports')} subtitle={t('borrowingReportsTableDesc', 'Admin level compliance and audit export')} />
    </div>
  );
}
