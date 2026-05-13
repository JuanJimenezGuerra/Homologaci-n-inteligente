import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UploadView from './components/UploadView';
import ValuacionView from './components/ValuacionView';
import FormularioView from './components/FormularioView';
import HomologacionView from './components/HomologacionView';
import AnalisisView from './components/AnalisisView';
import EquidadView from './components/EquidadView';
import HistorialView from './components/HistorialView';
import OrganizacionView from './components/OrganizacionView';
import SesionesView from './components/SesionesView';
import ErrorBoundary from './components/ErrorBoundary';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [userEmail, setUserEmail] = useState(null);
  const [activeTab, setActiveTab] = useState('formulario');
  const [empresaId, setEmpresaId] = useState(null);
  const [cargosHomologacion, setCargosHomologacion] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shr_cargos_homologacion') || 'null'); } catch { return null; }
  });
  const [valoracionesData, setValoracionesData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shr_valoraciones') || 'null'); } catch { return null; }
  });

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
    setActiveTab('organizacion');
  };

  const handleValoracionCompleta = (valoraciones) => {
    if (valoraciones) {
      setValoracionesData(valoraciones);
      try { localStorage.setItem('shr_valoraciones', JSON.stringify(valoraciones)); } catch {}
    }
    setActiveTab('homologacion');
  };

  const handleHomologacionCompleta = (cargos) => {
    if (cargos) {
      setCargosHomologacion(cargos);
      try { localStorage.setItem('shr_cargos_homologacion', JSON.stringify(cargos)); } catch {}
    }
    setActiveTab('analisis');
  };

const handleAnalisisCompleta = () => {
    setActiveTab('equidad');
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
      <ErrorBoundary>
        {activeTab === 'formulario' && (
          <FormularioView
            key={empresaId || 'new'}
            empresaId={empresaId}
            onEmpresaCreated={handleEmpresaCreada}
          />
        )}
      </ErrorBoundary>

      <ErrorBoundary>
        {activeTab === 'organizacion' && (
          <OrganizacionView onNavigate={(tab) => setActiveTab(tab)} />
        )}
      </ErrorBoundary>

      <ErrorBoundary>
        {activeTab === 'sesiones' && (
          <SesionesView initialEmpresaId={empresaId} />
        )}
      </ErrorBoundary>

      <ErrorBoundary>
        {activeTab === 'homologacion' && (
          <HomologacionView
            key={empresaId || 'new'}
            empresaId={empresaId}
            onComplete={handleHomologacionCompleta}
          />
        )}
      </ErrorBoundary>

      <ErrorBoundary>
        {activeTab === 'valoracion' && (
          <ValuacionView
            key={empresaId || 'new'}
            uploadId={empresaId}
            onValoracionesChange={(vals) => {
              setValoracionesData(vals);
              try { localStorage.setItem('shr_valoraciones', JSON.stringify(vals)); } catch {}
            }}
            onComplete={handleValoracionCompleta}
            onBack={() => setActiveTab('homologacion')}
          />
        )}
      </ErrorBoundary>

      <ErrorBoundary>
        {activeTab === 'analisis' && (
          <AnalisisView
            key={empresaId || 'new'}
            empresaId={empresaId}
            onBack={() => setActiveTab('valoracion')}
            onNext={handleAnalisisCompleta}
          />
        )}
      </ErrorBoundary>

      <ErrorBoundary>
        {activeTab === 'equidad' && (
          <EquidadView
            key={empresaId || 'new'}
            uploadData={empresaId}
            onBack={() => setActiveTab('analisis')}
          />
        )}
      </ErrorBoundary>

      <ErrorBoundary>
        {activeTab === 'historial' && (
          <HistorialView />
        )}
      </ErrorBoundary>
    </Layout>
  );
}

export default App;
