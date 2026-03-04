import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { LabInfo } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

export function AdminLabsPage() {
  const { t } = useLanguage();
  const [labs, setLabs] = useState<LabInfo[]>([]);

  useEffect(() => {
    api.getLabs('admin').then(setLabs);
  }, []);

  const columns: TableColumn<LabInfo>[] = useMemo(
    () => [
      { key: 'name', header: t('labName', 'Lab Name') },
      { key: 'department', header: t('department', 'Department') },
      { key: 'assetCount', header: t('assetCount', 'Asset Count') },
      { key: 'incharge', header: t('incharge', 'Incharge') }
    ],
    [t]
  );

  return (
    <div className="dashboard-grid">
      <DataTable data={labs} columns={columns} title={t('labsTitle', 'Labs')} subtitle={t('labsSubtitle', 'Lab directory and ownership overview')} />
    </div>
  );
}
