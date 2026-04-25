import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UploadView from './components/UploadView';
import ValuacionView from './components/ValuacionView';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userEmail, setUserEmail] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [newUploadId, setNewUploadId] = useState(null);
  const [valoracionUploadId, setValoracionUploadId] = useState(null);

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserEmail(payload.sub || 'analista@shr.com');
      } catch {
        setUserEmail('analista@shr.com');
      }
    }
  }, [token]);

  const handleLoginSuccess = (newToken, email) => {
    setToken(newToken);
    setUserEmail(email);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUserEmail(null);
  };

  const handleUploadSuccess = (uploadId) => {
    setNewUploadId(uploadId);
    setActiveTab('dashboard');
  };

  const handleGoToValoracion = (uploadId) => {
    setValoracionUploadId(uploadId);
    setActiveTab('valoracion');
  };

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      user={{ email: userEmail }}
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && (
        <Dashboard
          initialUploadId={newUploadId}
          onUploadIdConsumed={() => setNewUploadId(null)}
          onGoToValoracion={handleGoToValoracion}
        />
      )}
      {activeTab === 'uploads' && (
        <UploadView onSuccess={handleUploadSuccess} />
      )}
      {activeTab === 'valoracion' && (
        <ValuacionView 
          uploadId={valoracionUploadId} 
          onBack={() => setActiveTab('dashboard')}
        />
      )}
    </Layout>
  );
}

export default App;
