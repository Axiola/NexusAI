import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import { base44 } from "@/api/base44Client";
import { 
  LayoutDashboard, 
  Zap, 
  Users, 
  MessageSquareWarning, 
  FileWarning, 
  BrainCircuit, 
  History, 
  CreditCard,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  Bookmark,
  GitCompare,
  Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";

// --- Glitch Styles & Animations ---
const glitchStyles = `
  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100%); }
  }
  .nexus-scanline {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: linear-gradient(to bottom, transparent 50%, rgba(0, 255, 0, 0.02) 51%);
    background-size: 100% 4px;
    pointer-events: none;
    z-index: 9999;
  }
  .nexus-glitch-text:hover {
    text-shadow: 2px 0 #ff003c, -2px 0 #00e5ff;
    transition: all 0.1s;
  }
  .nexus-border {
    border: 1px solid #333;
    position: relative;
    overflow: hidden;
  }
  .nexus-border::before {
    content: '';
    position: absolute;
    top: 0; left: 0; width: 2px; height: 100%;
    background: #333;
    transition: height 0.3s;
  }
  .nexus-active::before {
    background: #ff003c;
    box-shadow: 0 0 10px #ff003c;
  }
  
  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #050505; }
  ::-webkit-scrollbar-thumb { background: #333; }
  ::-webkit-scrollbar-thumb:hover { background: #ff003c; }
`;

export default function Layout({ children }) {
  const [profile, setProfile] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [showSecurityPopup, setShowSecurityPopup] = useState(false);
  const [isSessionVerified, setIsSessionVerified] = useState(true); // Default true until profile check
  const [verificationCode, setVerificationCode] = useState('');
  const location = useLocation();

  // Desktop default open, Mobile default closed
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      const user = await base44.auth.me();
      if (!user) return;

      const profiles = await base44.entities.NexusProfile.filter({ created_by: user.email });
      let currentProfile;

      if (profiles && profiles.length > 0) {
        currentProfile = profiles[0];
        setProfile(currentProfile);

        // Check for IP change on login
        const { SecurityService } = await import("@/components/SecurityService");
        await SecurityService.checkLoginSecurity(currentProfile);

      } else {
        // Auto-create profile logic
        try {
          // Check if ANY owner exists
          const owners = await base44.entities.NexusProfile.filter({ role: 'owner' });
          const isFirstUser = owners.length === 0;

          const newProfile = await base44.entities.NexusProfile.create({
            plan: isFirstUser ? 'elite' : 'free',
            credits: isFirstUser ? 1000 : 20,
            total_usage: 0,
            role: isFirstUser ? 'owner' : 'user'
          });
          currentProfile = newProfile;
          setProfile(newProfile);

          // Log Registration
          try {
             const { SecurityService } = await import("@/components/SecurityService");
             await SecurityService.logSecurityEvent(newProfile, 'register', {
               role: isFirstUser ? 'OWNER (First User)' : 'User',
               details: 'New account created'
             });
          } catch(e) {}

        } catch (error) {
          console.error("Failed to init profile", error);
        }
      }

      // Security Check Popup
      if (currentProfile && !currentProfile.two_fa_enabled && !sessionStorage.getItem('security_popup_dismissed')) {
         setShowSecurityPopup(true);
      }
      
      // Check for Lockdown
      if (currentProfile?.is_blocked || currentProfile?.security_lockdown) {
         // Optionally redirect to lockdown page or show error
      }

      // Check Session Verification
      if (currentProfile?.two_fa_enabled) {
        const verified = sessionStorage.getItem('nexus_session_verified');
        if (!verified) {
          setIsSessionVerified(false);
        }
      }
    };
    fetchProfile();
  }, [location.pathname]);

  // Close sidebar on route change for mobile
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  const navItems = [
    { icon: LayoutDashboard, label: "DASHBOARD", path: "/" },
    { icon: Zap, label: "VIRAL SIMULATOR", path: "/ViralSimulator" },
    { icon: Users, label: "PSYCH PROFILE", path: "/PsychProfile" },
    { icon: MessageSquareWarning, label: "CONFLICT GEN", path: "/ConflictGen" },
    { icon: FileWarning, label: "DEAD TEXT", path: "/DeadText" },
    { icon: BrainCircuit, label: "PERSONAS", path: "/Personas" },
    { icon: "Bookmark", label: "BANCO DE PADRÕES", path: "/PatternBank" },
    { icon: "GitCompare", label: "TESTE A/B", path: "/ABTester" },
    { icon: History, label: "HISTÓRICO", path: "/History" },
    { icon: CreditCard, label: "UPGRADE / PLANOS", path: "/Plans" },
    { icon: ShieldAlert, label: "SEGURANÇA", path: "/Security" },
  ];

  if (profile?.role === 'admin' || profile?.role === 'owner') {
    navItems.push({ icon: ShieldAlert, label: "ADMIN", path: "/Admin" });
  }

  if (profile?.role === 'owner') {
    navItems.push({ icon: Crown, label: "OWNER", path: "/Owner" });
  }

  const handleSessionVerification = async (e) => {
    e.preventDefault();
    const { SecurityService } = await import("@/components/SecurityService");
    
    // Try TOTP
    let isValid = await SecurityService.verify2FA(verificationCode, profile.two_fa_secret);
    
    // Try Backup Code if TOTP fails (length 8 usually backup)
    if (!isValid && verificationCode.length === 8) {
      isValid = await SecurityService.verifyBackupCode(profile.id, verificationCode);
    }

    if (isValid) {
      sessionStorage.setItem('nexus_session_verified', 'true');
      setIsSessionVerified(true);
      // Log event
    } else {
      // toast error
      alert("Código inválido");
    }
  };

  // Force 2FA Setup for Owner/Admin
  if (profile && (profile.role === 'owner' || profile.role === 'admin') && !profile.two_fa_enabled) {
    if (location.pathname !== '/Security') {
      return (
         <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
          <style>{glitchStyles}</style>
          <div className="nexus-scanline"></div>
          <div className="max-w-md w-full border border-red-900 bg-[#0a0a0a] p-8 rounded-lg shadow-[0_0_50px_rgba(255,0,0,0.2)] text-center">
             <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
             <h2 className="text-2xl font-bold text-white mb-2">SEGURANÇA CRÍTICA</h2>
             <p className="text-gray-400 mb-6">
               Contas com privilégios de {profile.role.toUpperCase()} OBRIGATORIAMENTE precisam de Autenticação de Dois Fatores (2FA).
             </p>
             <Link to="/Security">
               <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
                 CONFIGURAR 2FA AGORA
               </Button>
             </Link>
          </div>
         </div>
      );
    }
  }

  if (!isSessionVerified && profile?.two_fa_enabled) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <style>{glitchStyles}</style>
        <div className="nexus-scanline"></div>
        <div className="max-w-md w-full border border-[#333] bg-[#0a0a0a] p-8 rounded-lg shadow-[0_0_50px_rgba(0,255,255,0.1)] relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-cyan-600 animate-pulse"></div>
           <div className="text-center mb-8">
             <ShieldAlert className="w-12 h-12 text-cyan-500 mx-auto mb-4" />
             <h2 className="text-xl font-bold text-white tracking-widest uppercase">Verificação de Identidade</h2>
             <p className="text-xs text-gray-500 mt-2">Sua conta está protegida por 2FA. Insira o código do seu app ou um código de backup.</p>
           </div>
           <form onSubmit={handleSessionVerification} className="space-y-4">
             <input 
               type="text" 
               value={verificationCode}
               onChange={e => setVerificationCode(e.target.value)}
               className="w-full bg-[#050505] border border-gray-800 p-3 text-center text-white font-mono text-xl tracking-widest focus:border-cyan-500 outline-none"
               placeholder="000000"
               autoFocus
             />
             <Button className="w-full bg-cyan-900/20 hover:bg-cyan-900/40 text-cyan-500 border border-cyan-900/50">
               LIBERAR ACESSO
             </Button>
           </form>
           <div className="mt-6 text-center">
              <button onClick={() => base44.auth.logout()} className="text-xs text-gray-600 hover:text-white">
                Logar com outra conta
              </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-sans selection:bg-[#ff003c] selection:text-white overflow-x-hidden">
      <style>{glitchStyles}</style>
      <div className="nexus-scanline"></div>

      {/* Mobile Header */}
      <div className="lg:hidden flex justify-between items-center p-4 border-b border-gray-900 bg-[#0a0a0a] z-50 relative">
      <div className="text-xl font-bold tracking-tighter text-white">
        NEXUS<span className="text-[#ff003c]">_IA</span>
      </div>
      <Button variant="ghost" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-white hover:bg-white/10">
        {isSidebarOpen ? <X /> : <Menu />}
      </Button>
      </div>

      <div className="flex relative">
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:sticky top-0 left-0 z-40 h-screen bg-[#0a0a0a] border-r border-gray-900 
          transition-all duration-300 ease-in-out shrink-0 overflow-hidden
          ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0 lg:border-none'}
        `}
      >
          <div className="p-6">
            <h1 className="text-2xl font-bold tracking-tighter text-white mb-2 hidden lg:block nexus-glitch-text cursor-default">
              NEXUS<span className="text-[#ff003c]">_IA</span>
            </h1>
            <div className="mt-6 mb-8 p-3 border border-gray-800 bg-[#050505] relative group">
              <div className="absolute top-0 right-0 w-2 h-2 bg-[#ff003c] opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">STATUS</p>
              <div className="flex justify-between items-end">
                <span className="text-sm font-mono text-[#ff003c] font-bold">
                  {profile?.plan?.toUpperCase() || 'FREE'}
                </span>
                <span className="text-xl font-bold text-white font-mono">
                  {profile?.credits || 0} <span className="text-xs text-gray-600">CRD</span>
                </span>
              </div>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link 
                    key={item.path} 
                    to={item.path}
                    className={`
                      flex items-center gap-3 px-3 py-3 text-sm font-medium transition-all duration-200
                      nexus-border hover:bg-[#111] hover:text-white
                      ${isActive ? 'bg-[#111] text-white nexus-active' : 'text-gray-500 border-transparent'}
                    `}
                  >
                    <item.icon className={`w-4 h-4 ${isActive ? 'text-[#ff003c]' : ''}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          
          <div className="absolute bottom-0 w-full p-6 border-t border-gray-900">
            <button onClick={() => base44.auth.logout()} className="flex items-center gap-2 text-xs text-gray-600 hover:text-red-500 transition-colors">
              <LogOut className="w-3 h-3" />
              ENCERRAR SESSÃO
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 bg-[#050505] min-h-screen flex flex-col">
          <div className="hidden lg:flex items-center p-4 border-b border-gray-900 bg-[#0a0a0a]">
             <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="mr-4">
               <Menu className="w-5 h-5" />
             </Button>
             <div className="text-sm font-mono text-gray-500">
               NEXUS_OS // {location.pathname === '/' ? 'DASHBOARD' : location.pathname.substring(1).toUpperCase()}
             </div>
          </div>
          <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
            {children}
            </div>
            </main>

            {/* Security Popup */}
            {showSecurityPopup && (
            <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
             <div className="bg-[#111] border border-red-500/50 p-4 w-80 rounded-lg shadow-[0_0_30px_rgba(255,0,0,0.1)] relative">
               <button 
                 onClick={() => {setShowSecurityPopup(false); sessionStorage.setItem('security_popup_dismissed', 'true')}}
                 className="absolute top-2 right-2 text-gray-500 hover:text-white"
               >
                 <X className="w-4 h-4" />
               </button>
               <div className="flex items-start gap-3 mb-3">
                 <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
                 <div>
                   <h4 className="font-bold text-white text-sm">Conta em Risco</h4>
                   <p className="text-xs text-gray-400 mt-1">
                     Sem 2FA, qualquer pessoa com sua senha pode acessar sua conta. Proteja-se agora.
                   </p>
                 </div>
               </div>
               <Link to="/Security">
                 <Button size="sm" className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50">
                   ATIVAR PROTEÇÃO
                 </Button>
               </Link>
             </div>
            </div>
            )}
            </div>
            </div>
            );
            }