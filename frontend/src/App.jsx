import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UploadView from './components/UploadView';
import ValuacionView from './components/ValuacionView';
import FormularioView from './components/FormularioView';
import HomologacionView from './components/HomologacionView';
import AnalisisView from './components/AnalisisView';

const API = import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com';

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [userEmail, setUserEmail] = useState(null);
  const [activeTab, setActiveTab] = useState('formulario');
  const [empresaId, setEmpresaId] = useState(null);

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserEmail(payload.sub || 'analista@shr.com');
      } catch {
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
    setActiveTab('formulario');
  };

  const handleEmpresaCreada = (empId) => {
    setEmpresaId(empId);
    setActiveTab('homologacion');
  };

  const handleHomologacionCompleta = () => {
    setActiveTab('valoracion');
  };

  const handleValoracionCompleta = () => {
    setActiveTab('analisis');
  };

  // Guard: sin token → login
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
      {activeTab === 'formulario' && (
        <FormularioView
          empresaId={empresaId}
          onEmpresaCreated={handleEmpresaCreada}
        />
      )}
      {activeTab === 'homologacion' && (
        <HomologacionView
          empresaId={empresaId}
          onComplete={handleHomologacionCompleta}
        />
      )}
      {activeTab === 'valoracion' && (
        <ValuacionView
          empresaId={empresaId}
          onComplete={handleValoracionCompleta}
          onBack={() => setActiveTab('homologacion')}
        />
      )}
      {activeTab === 'analisis' && (
        <AnalisisView
          empresaId={empresaId}
          onBack={() => setActiveTab('valoracion')}
        />
      )}
    </Layout>
  );
}

export default App;
