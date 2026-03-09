import React, { useRef, useState } from 'react';
import { Camera, ScanLine, X } from 'lucide-react';
import { api } from '../services/api';

export interface OCRDetectedFields {
  asset_name?: string;
  serial_number?: string;
  model?: string;
  quantity?: number;
  price?: number;
  purchase_department?: string;
  purchase_date?: string;
}

export interface OCRResult {
  text: string;
  detected_fields: OCRDetectedFields;
  message?: string;
}

interface OCRScannerProps {
  onResult: (result: OCRResult) => void;
  title?: string;
  description?: string;
  /** Labels to show from detected_fields. Default: all non-empty */
  displayFields?: (keyof OCRDetectedFields)[];
}

const FIELD_LABELS: Record<keyof OCRDetectedFields, string> = {
  asset_name: 'Asset Name',
  serial_number: 'Serial Number',
  model: 'Model',
  quantity: 'Quantity',
  price: 'Price',
  purchase_department: 'Purchase Department',
  purchase_date: 'Purchase Date',
};

export function OCRScanner({ onResult, title = 'Scan Document', description, displayFields }: OCRScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setResult(null);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    runOCR(file);
  }

  async function runOCR(file: File) {
    setLoading(true);
    setError('');
    try {
      const data = await api.ocrScan(file);
      setResult(data);
      onResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OCR scan failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setPreview(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const fieldsToShow = displayFields
    ?? (result ? (Object.keys(result.detected_fields) as (keyof OCRDetectedFields)[]).filter(
        (k) => result.detected_fields[k]
      )
    : []);

  return (
    <div className="ocr-scanner-card card">
      <div className="ocr-scanner-header">
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Camera size={16} />
          {title}
        </h3>
        {preview && (
          <button className="btn secondary-btn mini-btn" type="button" onClick={handleClear} aria-label="Clear scan">
            <X size={14} />
          </button>
        )}
      </div>

      {description && <p style={{ margin: '4px 0 12px', fontSize: '0.85rem', opacity: 0.65 }}>{description}</p>}

      {/* Upload trigger */}
      {!preview && (
        <button
          className="btn primary-btn"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          <ScanLine size={14} style={{ marginRight: 6 }} />
          Choose Image to Scan
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Image preview */}
      {preview && (
        <div style={{ marginTop: 12 }}>
          <img
            src={preview}
            alt="Scan preview"
            style={{
              maxWidth: '100%',
              maxHeight: 220,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              display: 'block',
            }}
          />
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <p style={{ marginTop: 10, fontSize: '0.875rem', opacity: 0.7 }}>
          Processing image…
        </p>
      )}

      {/* Error */}
      {error && (
        <p style={{ marginTop: 10, fontSize: '0.875rem', color: '#EF4444' }}>{error}</p>
      )}

      {/* Message (e.g. "No readable text detected") */}
      {result?.message && !fieldsToShow.length && (
        <p style={{ marginTop: 10, fontSize: '0.875rem', opacity: 0.65 }}>{result.message}</p>
      )}

      {/* Detected fields */}
      {result && fieldsToShow.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ margin: '0 0 8px', fontSize: '0.8rem', fontWeight: 600, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Detected Fields
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {fieldsToShow.map((field) => {
              const val = result.detected_fields[field];
              if (!val) return null;
              return (
                <div key={field} className="metric-card" style={{ padding: '10px 12px' }}>
                  <p className="metric-title">{FIELD_LABELS[field]}</p>
                  <p className="metric-value" style={{ fontSize: '0.95em', wordBreak: 'break-all' }}>{val}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
