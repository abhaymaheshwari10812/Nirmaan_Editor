import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiAlertTriangle, FiCpu, FiMail } from 'react-icons/fi';
import * as tmImage from '@teachablemachine/image';
import '@tensorflow/tfjs';
import exifr from 'exifr';

const URL = 'https://teachablemachine.withgoogle.com/models/JILKj4N_4/';

function App() {
  const [model, setModel] = useState(null);
  const [isLoadingModel, setIsLoadingModel] = useState(true);
  const [results, setResults] = useState([]);
  const [alertSent, setAlertSent] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');

  useEffect(() => {
    async function loadModel() {
      try {
        const timestamp = new Date().getTime();
        const modelURL = `${URL}model.json?t=${timestamp}`;
        const metadataURL = `${URL}metadata.json?t=${timestamp}`;
        const loadedModel = await tmImage.load(modelURL, metadataURL);
        setModel(loadedModel);
        setIsLoadingModel(false);
      } catch (err) {
        console.error("Failed to load model", err);
      }
    }
    loadModel();
  }, []);

  const sendAlert = async (file) => {
    if (alertSent) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64data = reader.result;
      try {
        const res = await fetch('http://localhost:5000/api/send-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: 'A crack was detected in an uploaded image.',
            image: base64data,
            recipientEmail: targetEmail
          })
        });
        if (res.ok) {
          setAlertSent(true);
        }
      } catch (error) {
        console.error('Failed to send alert email', error);
      }
    };
  };

  const processImage = async (file) => {
    let gpsData = null;
    try {
      gpsData = await exifr.gps(file);
    } catch (e) {
      console.warn("No EXIF GPS data found", e);
    }

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = window.URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = async () => {
        if (model) {
          const prediction = await model.predict(img);
          const topPrediction = prediction.reduce((prev, current) => 
            (prev.probability > current.probability) ? prev : current
          );
          const rawClassName = topPrediction.className;
          const isCrack = rawClassName.toLowerCase() === 'crack';
          const displayClass = rawClassName === 'No Crackl' ? 'No Crack' : rawClassName;

          if (isCrack) {
            sendAlert(file);
          }

          resolve({
            id: Math.random().toString(36).substr(2, 9),
            file,
            preview: objectUrl,
            predictions: prediction,
            topClass: displayClass,
            rawClass: rawClassName,
            isCrack,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            gps: gpsData
          });
        }
      };
    });
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    const newResults = await Promise.all(acceptedFiles.map(file => processImage(file)));
    setResults(prev => [...newResults, ...prev]);
  }, [model, alertSent, targetEmail]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: {'image/*': []} });

  if (isLoadingModel) {
    return (
      <div className="loading-state">
        <FiCpu className="init-icon" />
        <div className="init-title">Initializing Systems</div>
        <div className="init-sub">Loading Teachable Machine Model components and neural networks. Please stand by...</div>
      </div>
    );
  }

  const latestResult = results[0];

  return (
    <div id="app">
      <header id="header">
        <div className="brand">
          <div className="brand-logo">R</div>
          <div className="brand-text">
            <h1>ROAD INSPECTOR</h1>
            <p>REAL-TIME INFRASTRUCTURE MONITORING</p>
          </div>
        </div>
        <div className="header-right">
          <div id="sys-status">
            <div className="status-dot"></div>
            Monitoring Active
          </div>
        </div>
      </header>

      <div id="feed" style={{ padding: '2rem', overflowY: 'auto' }}>
        {alertSent && (
          <div className="alert-banner">
            <FiAlertTriangle size={24} />
            <div>
              <strong>Alert Sent!</strong> An email has been dispatched regarding the detected crack.
            </div>
          </div>
        )}

        <div className="email-input-container" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', background: 'var(--surface)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <FiMail size={20} style={{ color: 'var(--blue)', marginRight: '1rem' }} />
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Alert Email Destination</label>
            <input 
              type="email" 
              placeholder="Enter email to receive alerts (e.g., engineer@city.gov)" 
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
            />
          </div>
        </div>

        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <FiUploadCloud className="dropzone-icon" />
          <h3 style={{fontSize: '1.2rem', marginBottom: '0.5rem'}}>
            {isDragActive ? "Drop images here..." : "Drag & Drop images here, or click to select"}
          </h3>
          <p style={{color: 'var(--muted)', fontSize: '0.9rem'}}>Upload structures, walls, or surfaces for automated inspection.</p>
        </div>

        {latestResult && (
          <div style={{ marginTop: '2rem', position: 'relative' }}>
             <img src={latestResult.preview} alt="Latest Scan" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '12px', border: `3px solid ${latestResult.isCrack ? 'var(--red)' : 'var(--green)'}` }} />
             {latestResult.isCrack && (
               <div style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(13,20,38,0.9)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', minWidth: '200px' }}>
                 <div style={{ color: 'var(--red)', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div className="status-dot error"></div> CRACK DETECTED
                 </div>
                 <div className="info-row">
                   <span className="ir-key">Confidence</span>
                   <span className="ir-val">{(latestResult.predictions.find(p => p.className === latestResult.rawClass).probability * 100).toFixed(0)}%</span>
                 </div>
                 <div className="info-row">
                   <span className="ir-key">Detected</span>
                   <span className="ir-val">{latestResult.timestamp}</span>
                 </div>
               </div>
             )}
          </div>
        )}
      </div>
      
      <div id="sidebar">
        <div className="sidebar-section">
          <div className="sec-label">LIVE PREDICTION</div>
          {latestResult ? (
            <div className="pred-big" style={{ borderColor: latestResult.isCrack ? 'var(--red)' : 'var(--green)' }}>
               <div className={`pred-class ${latestResult.isCrack ? 'crack' : 'nocrack'}`}>
                 {latestResult.topClass}
               </div>
               <div className="pred-conf">
                 Confidence: {(latestResult.predictions.find(p => p.className === latestResult.rawClass).probability * 100).toFixed(1)}%
               </div>
               <div className="conf-bar">
                 <div className={`conf-fill ${latestResult.isCrack ? 'crack' : ''}`} style={{ width: `${(latestResult.predictions.find(p => p.className === latestResult.rawClass).probability * 100)}%` }}></div>
               </div>
            </div>
          ) : (
            <div className="pred-big">
               <div className="pred-class waiting">Waiting...</div>
            </div>
          )}

          {latestResult && (
            <div className="pred-rows" style={{ marginTop: '1rem' }}>
              {latestResult.predictions.map(p => {
                const isMatchClass = p.className === latestResult.rawClass;
                const isCrackClass = p.className.toLowerCase() === 'crack';
                return (
                  <div key={p.className} className="pred-row">
                    <div className="pred-row-header">
                      <span className="pr-label" style={{ color: isMatchClass ? (isCrackClass ? 'var(--red)' : 'var(--green)') : 'var(--muted)' }}>
                        {p.className === 'No Crackl' ? 'No Crack' : p.className}
                      </span>
                      <span className="pr-pct">{(p.probability * 100).toFixed(1)}%</span>
                    </div>
                    <div className="pr-bar">
                      <div className="pr-fill" style={{ width: `${(p.probability * 100)}%`, background: isCrackClass ? 'var(--red)' : 'var(--blue)' }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {latestResult && (
          <div className="sidebar-section">
            <div className="sec-label">LOCATION</div>
            <div className="info-row">
              <span className="ir-key">Latitude</span>
              <span className="ir-val">{latestResult.gps ? latestResult.gps.latitude.toFixed(6) : 'Unknown'}</span>
            </div>
            <div className="info-row">
              <span className="ir-key">Longitude</span>
              <span className="ir-val">{latestResult.gps ? latestResult.gps.longitude.toFixed(6) : 'Unknown'}</span>
            </div>
            <div className="info-row">
              <span className="ir-key">GPS Status</span>
              <span className="ir-val" style={{ color: latestResult.gps ? 'var(--green)' : 'var(--orange)' }}>
                {latestResult.gps ? 'Acquired' : 'No EXIF Data'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div id="history">
        <div className="hist-header">
          <div className="hist-title">DETECTION HISTORY — THIS SESSION</div>
          <div id="hist-count">{results.length} events</div>
        </div>
        <div id="hist-list" style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {results.map((res, i) => (
             <div key={res.id} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
               <div className={`badge ${res.isCrack ? 'badge-danger' : 'badge-success'}`} style={{ marginTop: 0, width: '80px', textAlign: 'center' }}>
                 {res.isCrack ? 'CRACK' : 'SAFE'}
               </div>
               <div style={{ color: 'var(--muted)', fontSize: '13px', flex: 1 }}>{res.id}</div>
               <div style={{ color: res.isCrack ? 'var(--red)' : 'var(--green)', fontSize: '13px', fontWeight: 'bold' }}>
                 {(res.predictions.find(p => p.className === res.rawClass).probability * 100).toFixed(0)}%
               </div>
               <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{res.timestamp}</div>
             </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default App;
