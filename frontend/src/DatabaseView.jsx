import React, { useEffect, useState } from 'react';
import { FiX, FiDatabase, FiMapPin, FiClock, FiActivity, FiImage, FiAlertCircle } from 'react-icons/fi';

function DatabaseView({ onClose }) {
  const [cracks, setCracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCracks() {
      try {
        const response = await fetch('http://localhost:5000/api/get-cracks');
        const result = await response.json();
        if (result.success) {
          setCracks(result.data);
        } else {
          setError('Failed to load database.');
        }
      } catch (err) {
        console.error(err);
        setError('Could not connect to database server.');
      } finally {
        setLoading(false);
      }
    }
    fetchCracks();
  }, []);

  return (
    <div className="db-overlay">
      <div className="db-modal">
        
        {/* Header */}
        <div className="db-header">
          <div className="db-title-group">
            <FiDatabase className="db-icon" />
            <div>
              <h2 className="db-title">Crack Detection Database</h2>
              <p className="db-subtitle">Restricted Access: BMC Officials Only</p>
            </div>
          </div>
          <button className="db-close" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="db-content">
          {loading ? (
            <div className="db-message">Loading database records...</div>
          ) : error ? (
            <div className="db-message db-error">
              <FiAlertCircle size={20} /> {error}
            </div>
          ) : cracks.length === 0 ? (
            <div className="db-message">No cracks have been recorded yet.</div>
          ) : (
            <div className="table-wrapper">
              <table className="db-table">
                <thead>
                  <tr>
                    <th><div className="th-content"><FiImage /> Photo</div></th>
                    <th><div className="th-content"><FiClock /> Timestamp</div></th>
                    <th><div className="th-content"><FiMapPin /> Location (Lat, Lng)</div></th>
                    <th><div className="th-content"><FiActivity /> Confidence</div></th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cracks.map((crack) => (
                    <tr key={crack.id}>
                      <td className="td-image">
                        <img src={crack.preview} alt="Detected Crack" className="db-thumbnail" />
                      </td>
                      <td className="td-time">
                        {new Date(crack.timestamp).toLocaleString()}
                      </td>
                      <td className="td-location">
                        {crack.gps ? (
                          <span>
                            {crack.gps.latitude.toFixed(5)}, {crack.gps.longitude.toFixed(5)}
                            {crack.gps.accuracy && ` (±${crack.gps.accuracy.toFixed(0)}m)`}
                          </span>
                        ) : (
                          <span className="no-data">Unknown</span>
                        )}
                      </td>
                      <td className="td-confidence">
                        <div className="conf-pill">
                          {(crack.confidence || 99.0).toFixed(1)}%
                        </div>
                      </td>
                      <td className="td-status">
                        <span className="status-badge">Logged</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DatabaseView;
