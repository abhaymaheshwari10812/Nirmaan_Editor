import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiAlertTriangle, FiCpu } from 'react-icons/fi';
import * as tmImage from '@teachablemachine/image';
import '@tensorflow/tfjs';

const URL = 'https://teachablemachine.withgoogle.com/models/JILKj4N_4/';

function App() {
  const [model, setModel] = useState(null);
  const [isLoadingModel, setIsLoadingModel] = useState(true);
  const [results, setResults] = useState([]);
  const [alertSent, setAlertSent] = useState(false);

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
            image: base64data
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
            isCrack
          });
        }
      };
    });
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    const newResults = await Promise.all(acceptedFiles.map(file => processImage(file)));
    setResults(prev => [...prev, ...newResults]);
  }, [model, alertSent]);

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

  return (
    <div className="app-container">
      <header className="header" id="header">
        <div className="brand">
          <div className="brand-logo">N</div>
          <div className="brand-text">
            <h1>Nirmaan Detection</h1>
            <p>AI-Powered Crack Detection</p>
          </div>
        </div>
        <div className="header-right">
          <div id="sys-status">
            <div className="status-dot"></div>
            SYSTEM ONLINE
          </div>
        </div>
      </header>

      <main className="main-content">
        {alertSent && (
          <div className="alert-banner">
            <FiAlertTriangle size={24} />
            <div>
              <strong>Alert Sent!</strong> An email has been dispatched regarding the detected crack.
            </div>
          </div>
        )}

        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <FiUploadCloud className="dropzone-icon" />
          <h3 style={{fontSize: '1.2rem', marginBottom: '0.5rem'}}>
            {isDragActive ? "Drop images here..." : "Drag & Drop images here, or click to select"}
          </h3>
          <p style={{color: 'var(--muted)', fontSize: '0.9rem'}}>Upload structures, walls, or surfaces for automated inspection.</p>
        </div>

        {results.length > 0 && (
          <div className="results-grid">
            {results.map((res) => (
              <div key={res.id} className="result-card">
                <img src={res.preview} alt="Upload preview" className="result-image" />
                <div className="result-content">
                  <h4 className="result-title">Analysis Result</h4>
                  <div className="result-prediction">
                    <span className={`prediction-label ${res.isCrack ? 'text-red' : 'text-green'}`} style={{ color: res.isCrack ? 'var(--red)' : 'var(--green)' }}>
                      {res.topClass}
                    </span>
                    <span className="prediction-score">{(res.predictions.find(p => p.className === res.rawClass).probability * 100).toFixed(1)}%</span>
                  </div>
                  <div className={`badge ${res.isCrack ? 'badge-danger' : 'badge-success'}`}>
                    {res.isCrack ? 'Crack Detected' : 'Safe'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
