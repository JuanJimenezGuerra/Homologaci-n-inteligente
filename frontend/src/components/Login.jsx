import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import axios from 'axios';
import { motion } from 'framer-motion';

const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // FastAPI OAuth2PasswordRequestForm espera x-www-form-urlencoded
    // con campos 'username' (no 'email') y 'password'
    const params = new URLSearchParams();
    params.append('username', email.trim());
    params.append('password', password);

    try {
      const response = await axios.post(
        `${getApiUrl()}/token`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const accessToken = response.data?.access_token;
      if (!accessToken) {
        setError('Respuesta inválida del servidor.');
        return;
      }

      // El padre (App.jsx) se encarga de guardar en localStorage
      onLoginSuccess(accessToken, email.trim());

    } catch (err) {
      if (!err.response) {
        setError('No se pudo conectar con el servidor. Verifica que el backend esté activo.');
      } else if (err.response.status === 401 || err.response.status === 422) {
        setError('Correo o contraseña incorrectos.');
      } else {
        setError(`Error del servidor (${err.response.status}). Intenta de nuevo.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-green-600/20 blur-[100px] rounded-full" />

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-900/30 mx-auto mb-6"
          >
            <span className="text-white text-4xl font-black">S</span>
          </motion.div>
          <h1 className="text-3xl font-bold text-forest tracking-tight">Homologación Inteligente</h1>
          <p className="text-emerald-700/70 mt-2 font-medium">Gestión de Talento Humano · SHR</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-3xl shadow-2xl border border-white/40"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-600 p-3 rounded-xl text-sm text-center font-medium"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-emerald-900 ml-1">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600/50" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/50 border border-emerald-100 rounded-xl py-3 pl-12 pr-4 text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-emerald-300"
                  placeholder="analista@shr.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-emerald-900 ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600/50" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/50 border border-emerald-100 rounded-xl py-3 pl-12 pr-4 text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-emerald-300"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 text-base mt-2"
            >
              {loading
                ? <Loader2 className="animate-spin" size={20} />
                : <><span>Ingresar</span><ArrowRight size={18} /></>
              }
            </button>
          </form>

          <p className="mt-6 text-center text-[10px] text-emerald-600/40 uppercase tracking-[0.2em] font-bold">
            Secure Access · SHR Automatización
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;

