import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiAlertTriangle, FiCpu, FiMail } from 'react-icons/fi';
import * as tmImage from '@teachablemachine/image';
import '@tensorflow/tfjs';
import exifr from 'exifr';

const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/JILKj4N_4/';

function App() {
  const [model, setModel] = useState(null);
  const [isLoadingModel, setIsLoadingModel] = useState(true);
  const [results, setResults] = useState([]);
  const [alertSent, setAlertSent] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');

  useEffect(() => {
    async function loadModel() {
      try {
        const t = Date.now();
        const loaded = await tmImage.load(
          `${MODEL_URL}model.json?t=${t}`,
          `${MODEL_URL}metadata.json?t=${t}`
        );
        setModel(loaded);
        setIsLoadingModel(false);
      } catch (err) {
        console.error('Failed to load model', err);
      }
    }
    loadModel();
  }, []);

  const sendAlert = useCallback(async (file) => {
    if (alertSent) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/send-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'A crack was detected in an uploaded image.',
            image: reader.result,
            recipientEmail: targetEmail,
          }),
        });
        if (res.ok) setAlertSent(true);
      } catch (e) {
        console.error('Failed to send alert email', e);
      }
    };
  }, [alertSent, targetEmail]);

  const processImage = useCallback(async (file) => {
    let gpsData = null;
    try { gpsData = await exifr.gps(file); } catch (_) {}

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = async () => {
        if (!model) return;
        const prediction = await model.predict(img);
        const top = prediction.reduce((a, b) => a.probability > b.probability ? a : b);
        const isCrack = top.className.toLowerCase() === 'crack';
        const displayClass = top.className === 'No Crackl' ? 'No Crack' : top.className;
        if (isCrack) sendAlert(file);
        resolve({
          id: Math.random().toString(36).substr(2, 9),
          preview: objectUrl,
          predictions: prediction,
          topClass: displayClass,
          rawClass: top.className,
          isCrack,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          gps: gpsData,
        });
      };
    });
  }, [model, sendAlert]);

  const onDrop = useCallback(async (acceptedFiles) => {
    const newResults = await Promise.all(acceptedFiles.map(f => processImage(f)));
    setResults(prev => [...newResults, ...prev]);
  }, [processImage]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
  });

  if (isLoadingModel) {
    return (
      <div className="loading-state">
        <FiCpu className="init-icon" />
        <div className="init-title">Initializing Systems</div>
        <div className="init-sub">Loading neural network model components. Please stand by...</div>
      </div>
    );
  }

  const latest = results[0];
  const getConf = (res) =>
    (res.predictions.find(p => p.className === res.rawClass).probability * 100);

  return (
    <div id="app">

      {/* ── Header ── */}
      <header id="header">
        <div className="brand">
          <div className="brand-logo">R</div>
          <div className="brand-text">
            <h1>ROAD INSPECTOR</h1>
            <p>REAL-TIME INFRASTRUCTURE MONITORING</p>
          </div>
        </div>
        <div id="sys-status">
          <div className="status-dot" />
          Monitoring Active
        </div>
      </header>

      {/* ── Feed ── */}
      <div id="feed">

        {alertSent && (
          <div className="alert-banner">
            <FiAlertTriangle size={20} style={{ flexShrink: 0 }} />
            <div><strong>Alert Sent!</strong> Email dispatched for detected crack.</div>
          </div>
        )}

        {/* Email Input */}
        <div className="email-input-container">
          <FiMail size={18} style={{ color: 'var(--blue)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="email-label">Alert Email Destination</label>
            <input
              type="email"
              placeholder="engineer@city.gov"
              value={targetEmail}
              onChange={e => setTargetEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Dropzone */}
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <FiUploadCloud className="dropzone-icon" />
          <h3>{isDragActive ? 'Drop images here…' : 'Tap to upload or drag & drop'}</h3>
          <p>Upload road surfaces for automated crack inspection.</p>
        </div>

        {/* Latest scanned image */}
        {latest && (
          <div className="latest-image-wrap">
            <img
              src={latest.preview}
              alt="Latest Scan"
              style={{ border: `3px solid ${latest.isCrack ? 'var(--red)' : 'var(--green)'}` }}
            />
            {latest.isCrack && (
              <div className="image-overlay">
                <div className="overlay-label">
                  <div className="status-dot error" /> CRACK DETECTED
                </div>
                <div className="info-row">
                  <span className="ir-key">Confidence</span>
                  <span className="ir-val">{getConf(latest).toFixed(0)}%</span>
                </div>
                <div className="info-row">
                  <span className="ir-key">Detected</span>
                  <span className="ir-val">{latest.timestamp}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sidebar ── */}
      <div id="sidebar">

        {/* Live Prediction */}
        <div className="sidebar-section">
          <div className="sec-label">LIVE PREDICTION</div>
          {latest ? (
            <div className="pred-big" style={{ borderColor: latest.isCrack ? 'var(--red)' : 'var(--green)' }}>
              <div className={`pred-class ${latest.isCrack ? 'crack' : 'nocrack'}`}>
                {latest.topClass}
              </div>
              <div className="pred-conf">Confidence: {getConf(latest).toFixed(1)}%</div>
              <div className="conf-bar">
                <div
                  className={`conf-fill ${latest.isCrack ? 'crack' : ''}`}
                  style={{ width: `${getConf(latest)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="pred-big">
              <div className="pred-class waiting">Waiting…</div>
            </div>
          )}

          {latest && (
            <div className="pred-rows">
              {latest.predictions.map(p => {
                const isCrackClass = p.className.toLowerCase() === 'crack';
                const isMatch = p.className === latest.rawClass;
                return (
                  <div key={p.className} className="pred-row">
                    <div className="pred-row-header">
                      <span className="pr-label" style={{
                        color: isMatch ? (isCrackClass ? 'var(--red)' : 'var(--green)') : 'var(--muted)'
                      }}>
                        {p.className === 'No Crackl' ? 'No Crack' : p.className}
                      </span>
                      <span className="pr-pct">{(p.probability * 100).toFixed(1)}%</span>
                    </div>
                    <div className="pr-bar">
                      <div className="pr-fill" style={{
                        width: `${p.probability * 100}%`,
                        background: isCrackClass ? 'var(--red)' : 'var(--blue)',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Location */}
        {latest && (
          <div className="sidebar-section">
            <div className="sec-label">LOCATION</div>
            <div className="info-row">
              <span className="ir-key">Latitude</span>
              <span className="ir-val">{latest.gps ? latest.gps.latitude.toFixed(6) : 'Unknown'}</span>
            </div>
            <div className="info-row">
              <span className="ir-key">Longitude</span>
              <span className="ir-val">{latest.gps ? latest.gps.longitude.toFixed(6) : 'Unknown'}</span>
            </div>
            <div className="info-row">
              <span className="ir-key">GPS Status</span>
              <span className="ir-val" style={{ color: latest.gps ? 'var(--green)' : 'var(--orange)' }}>
                {latest.gps ? 'Acquired' : 'No EXIF Data'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── History ── */}
      <div id="history">
        <div className="hist-header">
          <div className="hist-title">DETECTION HISTORY — THIS SESSION</div>
          <div id="hist-count">{results.length} events</div>
        </div>
        <div id="hist-list">
          {results.map(res => (
            <div key={res.id} className="hist-row">
              <div className={`badge ${res.isCrack ? 'badge-danger' : 'badge-success'}`}>
                {res.isCrack ? 'CRACK' : 'SAFE'}
              </div>
              <div style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {res.id}
              </div>
              <div style={{ color: res.isCrack ? 'var(--red)' : 'var(--green)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {getConf(res).toFixed(0)}%
              </div>
              <div style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{res.timestamp}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default App;
