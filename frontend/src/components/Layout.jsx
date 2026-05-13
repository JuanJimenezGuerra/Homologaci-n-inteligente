import React from 'react';
import { LayoutDashboard, LogOut, User as UserIcon, ShieldCheck, Building2, Link2, Target, TrendingUp, Scale, History, GitBranch, ClipboardList } from 'lucide-react';
import { motion } from 'framer-motion';
import logoShr from '../assets/logo_shr.png?v=2';

const Layout = ({ children, activeTab, setActiveTab, user, onLogout }) => {

  const menuItems = [
    // ── Flujo Principal (Nuevo Pipeline) ──
    { id: 'formulario', label: '1. Formulario', icon: Building2, desc: 'Cargar requerimientos', primary: true },
    { id: 'organizacion', label: '2. Organización', icon: GitBranch, desc: 'Crear organigrama', primary: true },
    { id: 'sesiones', label: '3. Sesiones', icon: ClipboardList, desc: 'Taller de valoración', primary: true },
    // ── Flujo Anterior (Legado) ──
    { id: 'valoracion', label: '4. Valoración', icon: Target, desc: 'Evaluación IA (legado)', primary: false },
    { id: 'homologacion', label: '5. Homologación', icon: Link2, desc: 'Matching (legado)', primary: false },
    { id: 'analisis', label: '6. Análisis', icon: TrendingUp, desc: 'Curvas (legado)', primary: false },
    { id: 'equidad', label: '7. Equidad', icon: Scale, desc: 'Nivelación (legado)', primary: false },
    { id: 'historial', label: '8. Historial', icon: History, desc: 'Procesos ejecutados', primary: true },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-emerald-100 flex flex-col shadow-xl z-20">
        
        <div className="p-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/10 p-2 border border-emerald-50">
              <img src={logoShr} alt="SHR Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="font-bold text-xl text-forest leading-tight">SHR</h2>
              <p className="text-[10px] text-emerald-600 font-bold tracking-widest uppercase">Automatización</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {menuItems.map((item, idx) => (
            <React.Fragment key={item.id}>
              {idx === 3 && <div className="my-2 border-t border-slate-200 pt-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-2">Legado</span>
              </div>}
              <button
                onClick={() => setActiveTab(item.id)}
                className={`nav-link w-full ${activeTab === item.id ? 'active' : ''} ${item.primary === false ? 'opacity-60 hover:opacity-100' : ''}`}
              >
                <item.icon size={20} className={activeTab === item.id ? 'text-white' : 'text-emerald-600'} />
                <div className="text-left">
                  <span className="font-semibold">{item.label}</span>
                  {item.desc && (
                    <span className={`block text-xs ${activeTab === item.id ? 'text-white/70' : 'text-slate-400'}`}>
                      {item.desc}
                    </span>
                  )}
                </div>

                {activeTab === item.id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="ml-auto w-1.5 h-5 bg-white/40 rounded-full"
                  />
                )}
              </button>
            </React.Fragment>
          ))}
        </nav>

        {/* User Card */}
        <div className="p-6 mt-auto">
          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex flex-col gap-4">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-md">
                <UserIcon size={18} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate text-forest">
                  {user?.email || 'Admin User'}
                </p>
                <div className="flex items-center gap-1">
                  <ShieldCheck size={10} className="text-emerald-500" />
                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">
                    Analista Senior
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl transition-all duration-300 border border-slate-200 text-xs font-bold"
            >
              <LogOut size={14} />
              Cerrar Sesión
            </button>
          </div>
        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-transparent">
        
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-emerald-100 px-8 py-4 flex justify-between items-center">
          
          <h2 className="text-lg font-bold text-forest">
            {menuItems.find(i => i.id === activeTab)?.label}
          </h2>

          <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
            Conexión Segura • Producción
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>

      </main>
    </div>
  );
};

export default Layout;
