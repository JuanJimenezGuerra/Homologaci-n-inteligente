import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UploadView from './components/UploadView';
import ValuacionView from './components/ValuacionView';
import FormularioView from './components/FormularioView';
import HomologacionView from './components/HomologacionView';
import AnalisisView from './components/AnalisisView';

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [userEmail, setUserEmail] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [newUploadId, setNewUploadId] = useState(null);
  const [valoracionUploadId, setValoracionUploadId] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserEmail(payload.sub || 'analista@shr.com');
      } catch {
        // Token malformado — limpiar sesión
        localStorage.removeItem('token');
        setToken(null);
      }
    }
  }, [token]);

  const handleLoginSuccess = (newToken, email) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUserEmail(email);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUserEmail(null);
    setActiveTab('dashboard');
  };

  const handleUploadSuccess = (uploadId) => {
    setNewUploadId(uploadId);
    setActiveTab('dashboard');
  };

  const handleGoToValoracion = (uploadId) => {
    setValoracionUploadId(uploadId);
    setActiveTab('valoracion');
  };

  const handleEmpresaSelect = (empId) => {
    setEmpresaId(empId);
  };

  // Guard: sin token → pantalla de login
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
          onEmpresaSelect={handleEmpresaSelect}
        />
      )}
      {activeTab === 'formulario' && (
        <FormularioView
          empresaId={empresaId}
          onEmpresaCreated={(id) => {
            setEmpresaId(id);
            setActiveTab('homologacion');
          }}
        />
      )}
      {activeTab === 'homologacion' && (
        <HomologacionView
          empresaId={empresaId}
          onComplete={() => setActiveTab('valoracion')}
        />
      )}
      {activeTab === 'valoracion' && (
        <ValuacionView
          uploadData={valoracionUploadId}
          empresaId={empresaId}
          onComplete={() => setActiveTab('analisis')}
          onBack={() => setActiveTab('homologacion')}
        />
      )}
      {activeTab === 'analisis' && (
        <AnalisisView
          empresaId={empresaId}
          onBack={() => setActiveTab('valoracion')}
        />
      )}
      {activeTab === 'uploads' && (
        <UploadView onSuccess={handleUploadSuccess} />
      )}
    </Layout>
  );
}

export default App;
