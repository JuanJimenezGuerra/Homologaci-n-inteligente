import React from 'react';
import { LayoutDashboard, FileUp, Database, LogOut, User as UserIcon } from 'lucide-react';

const Layout = ({ children, activeTab, setActiveTab, user, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Panel Principal', icon: LayoutDashboard },
    { id: 'uploads', label: 'Nuevo Proceso', icon: FileUp },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f172a] text-slate-200">
      {/* Sidebar */}
      <aside className="w-64 glass border-r border-slate-800 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-900/20">
            <Database className="text-white" size={24} />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">SHR Match</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="p-4 glass-card rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <UserIcon size={20} className="text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{user?.email || 'Analista'}</p>
              <p className="text-xs text-slate-500 truncate">Analista RH</p>
            </div>
            <button 
              onClick={onLogout}
              className="p-2 text-slate-500 hover:text-red-400 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        {/* Background blobs for aesthetics */}
        <div className="absolute top-0 right-0 -z-10 w-96 h-96 bg-primary-600/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 -z-10 w-64 h-64 bg-indigo-600/10 blur-[80px] rounded-full" />
        
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
