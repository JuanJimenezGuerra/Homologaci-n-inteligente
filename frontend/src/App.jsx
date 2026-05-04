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

const API = import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com';

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
    setActiveTab('homologacion');
  };

  const handleHomologacionCompleta = (cargos) => {
    if (cargos) {
      setCargosHomologacion(cargos);
      try { localStorage.setItem('shr_cargos_homologacion', JSON.stringify(cargos)); } catch {}
    }
    setActiveTab('valoracion');
  };

  const handleValoracionCompleta = (valoraciones) => {
    if (valoraciones) {
      setValoracionesData(valoraciones);
      try { localStorage.setItem('shr_valoraciones', JSON.stringify(valoraciones)); } catch {}
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
          uploadId={empresaId}
          cargosIniciales={cargosHomologacion}
          valoracionesIniciales={valoracionesData}
          onCargosChange={(cargos) => {
            setCargosHomologacion(cargos);
            try { localStorage.setItem('shr_cargos_homologacion', JSON.stringify(cargos)); } catch {}
          }}
          onValoracionesChange={(vals) => {
            setValoracionesData(vals);
            try { localStorage.setItem('shr_valoraciones', JSON.stringify(vals)); } catch {}
          }}
          onComplete={handleValoracionCompleta}
          onBack={() => setActiveTab('homologacion')}
        />
      )}
      {activeTab === 'analisis' && (
        <AnalisisView
          empresaId={empresaId}
          onBack={() => setActiveTab('valoracion')}
          onNext={handleAnalisisCompleta}
        />
      )}
      {activeTab === 'equidad' && (
        <EquidadView
          uploadData={empresaId}
          onBack={() => setActiveTab('analisis')}
        />
      )}
    </Layout>
  );
}

export default App;
