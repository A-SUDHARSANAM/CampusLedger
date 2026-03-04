import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { BorrowRecord } from '../../types/domain';
import { downloadSimplePdf } from '../../utils/pdf';

export function AdminReportsPage() {
  const [records, setRecords] = useState<BorrowRecord[]>([]);

  useEffect(() => {
    api.getBorrowRecords('admin').then(setRecords);
  }, []);

  const columns: TableColumn<BorrowRecord>[] = useMemo(
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
        header: 'Download',
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
            <Download size={13} /> PDF
          </button>
        )
      }
    ],
    []
  );

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>Borrowing & Invoice Reports</h2>
        <p>Save and download bill, invoice, product, warranty, issue updates, and penalties as PDF.</p>
      </div>
      <DataTable data={records} columns={columns} title="Borrowing Reports" subtitle="Admin level compliance and audit export" />
    </div>
  );
}
