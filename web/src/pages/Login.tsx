import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, ChevronRight, UserCircle, Microscope, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<'Admin' | 'Lab Incharge' | 'Service'>('Admin');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await login(selectedRole, email, password);
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Access Denied: Terminal hand-shake failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const roles = [
        { id: 'Admin', title: 'System Administrator', icon: <UserCircle className="w-5 h-5" />, desc: 'Full institutional control' },
        { id: 'Lab Incharge', title: 'Lab Management', icon: <Microscope className="w-5 h-5" />, desc: 'Asset & maintenance logs' },
        { id: 'Service', title: 'Service & Maintenance', icon: <Settings className="w-5 h-5" />, desc: 'Field terminal access' },
    ];

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-[#1e293b] skew-y-3 -translate-y-24 z-0"></div>

            <div className="z-10 w-full max-w-[1000px] grid lg:grid-cols-2 gap-8 bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
                {/* Left Side: Branding */}
                <div className="hidden lg:flex flex-col justify-between p-12 bg-[#3b82f6] text-white">
                    <div>
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                            <ShieldCheck className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-4xl font-black mb-4 tracking-tight leading-tight">Campus Ledger<br />Terminal v4.8</h1>
                        <p className="text-blue-100 text-lg font-medium opacity-80 leading-relaxed">
                            Institutional secure gateway for asset tracking, inventory management, and predictive maintenance.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Lock className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs uppercase font-black tracking-widest opacity-60">Security Protocol</p>
                                <p className="font-bold">AES-256 Encrypted Tunnel</p>
                            </div>
                        </div>
                        <p className="text-xs opacity-50 font-medium">© 2026 Main City University • All Rights Reserved</p>
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="p-8 lg:p-12">
                    <div className="mb-8">
                        <h2 className="text-2xl font-black text-[#1e293b] mb-2 tracking-tight">System Authentication</h2>
                        <p className="text-slate-500 font-medium text-sm">Select your institutional role to initialize session.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 mb-8">
                        {roles.map((role) => (
                            <button
                                key={role.id}
                                type="button"
                                onClick={() => setSelectedRole(role.id as any)}
                                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 text-left group ${selectedRole === role.id
                                    ? 'border-[#3b82f6] bg-[#eff6ff]'
                                    : 'border-slate-100 hover:border-slate-200'
                                    }`}
                            >
                                <div className={`p-3 rounded-xl transition-colors ${selectedRole === role.id ? 'bg-[#3b82f6] text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'
                                    }`}>
                                    {role.icon}
                                </div>
                                <div>
                                    <p className={`font-bold text-sm ${selectedRole === role.id ? 'text-[#3b82f6]' : 'text-[#1e293b]'}`}>
                                        {role.title}
                                    </p>
                                    <p className="text-[11px] text-slate-400 font-medium leading-none mt-1 uppercase tracking-wider italic">
                                        {role.desc}
                                    </p>
                                </div>
                                {selectedRole === role.id && (
                                    <div className="ml-auto w-5 h-5 bg-[#3b82f6] rounded-full flex items-center justify-center animate-in zoom-in">
                                        <ShieldCheck className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-5 h-5 text-red-500" />
                            </div>
                            <p className="text-sm font-bold text-red-900 leading-tight">
                                {error}
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-4 w-5 h-5 text-slate-400 group-focus-within:text-[#3b82f6] transition-colors" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="rajesh.kumar@campus.edu"
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-[#3b82f6] outline-none transition-all font-medium text-[#1e293b]"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Pin / Password</label>
                                <button type="button" className="text-[10px] font-black text-[#3b82f6] uppercase tracking-wider">Recovery Options</button>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-4 w-5 h-5 text-slate-400 group-focus-within:text-[#3b82f6] transition-colors" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-[#3b82f6] outline-none transition-all font-medium text-[#1e293b]"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-[#3b82f6] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#2563eb] transition-all active:scale-[0.98] shadow-lg shadow-blue-200 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Initialize Session
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            <div className="mt-8 text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest z-10">
                Institutional Access Only • Authorized Personnel Only
            </div>
        </div>
    );
}
