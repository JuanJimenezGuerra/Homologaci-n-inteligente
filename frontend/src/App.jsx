import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UploadView from './components/UploadView';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userEmail, setUserEmail] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (token) {
      // Potentially verify token here
      setUserEmail('analista@shr.com'); // Mocking for now
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
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'uploads' && <UploadView onSuccess={() => setActiveTab('dashboard')} />}
    </Layout>
  );
}

export default App;
