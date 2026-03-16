import React, { useState, useRef } from 'react';
import { BACKEND_URL, IS_BACKEND_CONNECTED } from '../apiService.js';

// ─── Status types ─────────────────────────────────────────────
// 'uploading'  → sending to backend
// 'indexed'    → successfully stored in Pinecone
// 'error'      → upload failed

function UploadBox() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(null);   // filename of file in progress
  const inputRef = useRef(null);

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const processFiles = (files) => {
    const allowed = ['.pdf', '.csv', '.docx'];
    const validFiles = Array.from(files).filter((f) => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      return allowed.includes(ext);
    });
    if (validFiles.length === 0) return;

    // Process one at a time to avoid race conditions on the spinner
    const uploadNext = (index) => {
      if (index >= validFiles.length) return;
      const file = validFiles[index];
      const id = Date.now() + Math.random();
      setUploading(file.name);

      const formData = new FormData();
      formData.append('document', file);

      fetch(`${BACKEND_URL}/upload`, { method: 'POST', body: formData })
        .then((res) => {
          if (!res.ok) return res.json().then((e) => { throw new Error(e.error || 'Upload failed'); });
          return res.json();
        })
        .then((data) => {
          setUploadedFiles((prev) => [
            {
              id,
              name: file.name,
              size: file.size,
              uploadedAt: new Date(),
              status: data.status === 'indexed' ? 'indexed' : 'uploaded',
              chunks: data.chunks || 0,
            },
            ...prev,
          ]);
        })
        .catch((err) => {
          setUploadedFiles((prev) => [
            { id, name: file.name, size: file.size, uploadedAt: new Date(), status: 'error', error: err.message },
            ...prev,
          ]);
        })
        .finally(() => {
          setUploading(null);
          uploadNext(index + 1);
        });
    };

    uploadNext(0);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileInput = (e) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (id) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="upload-box-root">
      {/* Backend offline notice */}
      {!IS_BACKEND_CONNECTED && (
        <div className="upload-offline-note">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Upload disabled — backend not connected
        </div>
      )}

      {/* Drop Zone */}
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''} ${!IS_BACKEND_CONNECTED ? 'drop-zone-disabled' : ''}`}
        onDrop={IS_BACKEND_CONNECTED ? handleDrop : undefined}
        onDragOver={IS_BACKEND_CONNECTED ? handleDragOver : undefined}
        onDragLeave={IS_BACKEND_CONNECTED ? handleDragLeave : undefined}
        onClick={() => IS_BACKEND_CONNECTED && !uploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.csv,.docx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileInput}
          multiple
          style={{ display: 'none' }}
        />

        {uploading ? (
          <div className="upload-processing">
            <div className="upload-spinner-ring" />
            <p className="upload-processing-text">
              Uploading <strong>{uploading}</strong>
            </p>
            <p className="upload-processing-sub">Sending to Google Drive → indexing into knowledge base...</p>
          </div>
        ) : (
          <div className="drop-content">
            <div className={`drop-icon-wrap ${isDragging ? 'drag-active' : ''}`}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="drop-title">
              {isDragging ? 'Drop your file here' : 'Drag & drop files'}
            </p>
            <p className="drop-subtitle">or <span className="drop-link">browse files</span> to upload</p>
            <div className="drop-badge">PDF · CSV · DOCX · Max 50MB</div>
          </div>
        )}
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="uploaded-files">
          <span className="uploaded-label">Documents ({uploadedFiles.length})</span>
          <div className="file-list">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="file-item">
                <div className="file-pdf-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={file.status === 'error' ? '#ff6b6b' : file.status === 'indexed' ? '#00e5ff' : '#a78bfa'}
                    strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="file-meta">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">
                    {formatSize(file.size)}
                    {file.status === 'indexed' && file.chunks > 0 && ` · ${file.chunks} chunks`}
                  </span>
                </div>
                <div className="file-status">
                  {file.status === 'indexed' && (
                    <span className="file-indexed-badge">✅ Indexed</span>
                  )}
                  {file.status === 'uploaded' && (
                    <span className="file-indexed-badge" style={{ color: '#a78bfa' }}>📁 Uploaded</span>
                  )}
                  {file.status === 'error' && (
                    <span className="file-indexed-badge" style={{ color: '#ff6b6b' }} title={file.error}>
                      ❌ Failed
                    </span>
                  )}
                  <button className="file-remove-btn" onClick={() => removeFile(file.id)} title="Remove">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadBox;