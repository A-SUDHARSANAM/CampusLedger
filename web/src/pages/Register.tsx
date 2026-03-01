import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, ChevronRight, UserCircle, Microscope, Settings, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<'Admin' | 'LabIncharge' | 'Service'>('Admin');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const navigate = useNavigate();
    const { register } = useAuth();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess(false);

        try {
            await register(name, email, password, selectedRole);
            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Registration failed. Check network or terminal logs.');
        } finally {
            setIsLoading(false);
        }
    };

    const roles = [
        { id: 'Admin', title: 'System Administrator', icon: <UserCircle className="w-5 h-5" />, desc: 'Full institutional control' },
        { id: 'LabIncharge', title: 'Lab Management', icon: <Microscope className="w-5 h-5" />, desc: 'Asset & maintenance logs' },
        { id: 'Service', title: 'Service & Maintenance', icon: <Settings className="w-5 h-5" />, desc: 'Field terminal access' },
    ];

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-[#1e293b] -skew-y-3 -translate-y-24 z-0"></div>

            <div className="z-10 w-full max-w-[1000px] grid lg:grid-cols-2 gap-8 bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
                {/* Left Side: Branding */}
                <div className="hidden lg:flex flex-col justify-between p-12 bg-[#3b82f6] text-white">
                    <div>
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                            <ShieldCheck className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-4xl font-black mb-4 tracking-tight leading-tight">Campus Ledger<br />Enrollment</h1>
                        <p className="text-blue-100 text-lg font-medium opacity-80 leading-relaxed">
                            Create your institutional identity to begin tracking assets and managing campus inventory.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs uppercase font-black tracking-widest opacity-60">Identity verified</p>
                                <p className="font-bold">Institutional SSO Ready</p>
                            </div>
                        </div>
                        <p className="text-xs opacity-50 font-medium">© 2026 Main City University • Technical Services</p>
                    </div>
                </div>

                {/* Right Side: Register Form */}
                <div className="p-8 lg:p-12 overflow-y-auto max-h-[90vh]">
                    <div className="mb-8">
                        <h2 className="text-2xl font-black text-[#1e293b] mb-2 tracking-tight">System Enrollment</h2>
                        <p className="text-slate-500 font-medium text-sm">Fill in your professional details to register.</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                            <ShieldCheck className="w-5 h-5 text-red-500 shrink-0" />
                            <p className="text-sm font-bold text-red-900 leading-tight">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                            <p className="text-sm font-bold text-emerald-900 leading-tight">Registration successful! Redirecting to login terminal...</p>
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-[#3b82f6] transition-colors" />
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your full name"
                                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-[#3b82f6] outline-none transition-all font-medium text-[#1e293b]"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-[#3b82f6] transition-colors" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="rajesh.kumar@campus.edu"
                                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-[#3b82f6] outline-none transition-all font-medium text-[#1e293b]"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Pin / Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-[#3b82f6] transition-colors" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Create a strong password"
                                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-[#3b82f6] outline-none transition-all font-medium text-[#1e293b]"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Designated Role</label>
                            <div className="grid grid-cols-3 gap-2">
                                {roles.map((role) => (
                                    <button
                                        key={role.id}
                                        type="button"
                                        onClick={() => setSelectedRole(role.id as any)}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 text-center ${selectedRole === role.id
                                            ? 'border-[#3b82f6] bg-[#eff6ff]'
                                            : 'border-slate-100 hover:border-slate-200'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg transition-colors ${selectedRole === role.id ? 'bg-[#3b82f6] text-white' : 'bg-slate-50 text-slate-400'}`}>
                                            {role.icon}
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-tight ${selectedRole === role.id ? 'text-[#3b82f6]' : 'text-slate-400'}`}>
                                            {role.id === 'LabIncharge' ? 'Lab Mgr' : role.id}
                                        </span>
                                    </button>
                                ))}
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
                                    Complete Registration
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-slate-500 font-medium text-sm">
                        Existing staff? <Link to="/login" className="text-[#3b82f6] font-bold hover:underline">Access Terminal</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
