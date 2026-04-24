import React, { useState } from 'react';
import { Database, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import axios from 'axios';
import { motion } from 'framer-motion';
import logoShr from '../assets/logo_shr.png';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // URL de la API: Sanitizar para evitar doble barra si el usuario pone una barra al final en Render
    let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    if (apiUrl.endsWith('/')) {
      apiUrl = apiUrl.slice(0, -1);
    }
    
    try {
      // Intentar login con formato de formulario (común en FastAPI/OAuth2)
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const response = await axios.post(`${apiUrl}/token`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      localStorage.setItem('token', response.data.access_token);
      onLoginSuccess(response.data.access_token, email);
    } catch (err) {
      console.error("Login Error:", err);
      if (!err.response) {
        setError('No se pudo conectar con el servidor. Verifica la URL de la API.');
      } else {
        setError('Correo o contraseña incorrectos');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Blobs - Green Inspired */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-green-600/20 blur-[100px] rounded-full" />

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-28 h-28 bg-white rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-900/20 mx-auto mb-6 p-4 border border-emerald-50"
          >
            <img src={logoShr} alt="Logo SHR" className="w-full h-full object-contain" />
          </motion.div>
          <h1 className="text-3xl font-bold text-forest tracking-tight">Homologación Inteligente</h1>
          <p className="text-emerald-700/70 mt-2 font-medium">Gestión de Talento Humano</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-3xl shadow-2xl border border-white/40"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-600 p-4 rounded-xl text-sm text-center font-medium"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-emerald-900 ml-1">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600/50" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/50 border border-emerald-100 rounded-xl py-3 pl-12 pr-4 text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-emerald-300"
                  placeholder="analista@shr.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-emerald-900 ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600/50" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/50 border border-emerald-100 rounded-xl py-3 pl-12 pr-4 text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-emerald-300"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 text-lg"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <>
                  Ingresar
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-[10px] text-emerald-600/50 uppercase tracking-[0.2em] font-bold">Secure Access • SHR Automatización</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
