import { useState } from 'react';
import {
    Mail, Edit, Activity, Truck, Calendar, ArrowUpRight,
    Check, X, Save, Bell, ShieldCheck, Fingerprint, Shield,
    Smartphone, ExternalLink, History
} from 'lucide-react';

export function Profile() {
    const [activeTab, setActiveTab] = useState('general');
    const [isEditing, setIsEditing] = useState(false);
    const [showSuccess, setShowSuccess] = useState<string | null>(null);
    const [activeModal, setActiveModal] = useState<string | null>(null);

    const [user, setUser] = useState({
        name: "Dr. Rajesh Kumar",
        role: "Senior Administrator",
        employeeId: "EMP-2024-089",
        joiningDate: "Jan 15, 2021",
        supervisor: "Dr. Ananya Sharma (Director, Operations)",
        email: "rajesh.kumar@campus.edu",
        phone: "+91 98765 43210",
        location: "Administrative Block, Wing A",
        department: "Campus Operations & Inventory",
        lastLogin: "Today, 10:45 AM",
        avatar: "RK"
    });

    const [notifications, setNotifications] = useState([
        { id: 1, title: "Critical Asset Alerts", desc: "Real-time alerts for server rack failures & high-value item movements.", active: true },
        { id: 2, title: "Procurement Requests", desc: "Notification for items ready for final approval.", active: true },
        { id: 3, title: "Weekly Compliance Report", desc: "Inventory audit summaries sent every Monday.", active: false },
        { id: 4, title: "System Maintenance", desc: "Updates on backend syncs and scheduled downtime.", active: true }
    ]);

    const loginHistory = [
        { id: 1, date: "Oct 24, 2024, 10:45 AM", location: "Campus Main Lab (IP: 192.168.1.45)", device: "MacBook Pro - Chrome", status: "Success" },
        { id: 2, date: "Oct 23, 2024, 02:15 PM", location: "Admin Block (IP: 192.168.1.12)", device: "Mobile App - iPhone 15", status: "Success" },
        { id: 3, date: "Oct 22, 2024, 09:00 AM", location: "Home Network (IP: 172.56.2.89)", device: "Windows Desktop - Edge Lite", status: "Success" },
    ];

    interface Notification {
        id: number;
        title: string;
        desc: string;
        active: boolean;
    }

    const handleSaveProfile = () => {
        setIsEditing(false);
        triggerSuccess("Professional profile updated successfully!");
    };

    const toggleNotification = (id: number) => {
        setNotifications(notifications.map((n: Notification) => n.id === id ? { ...n, active: !n.active } : n));
        triggerSuccess("Notification preference updated.");
    };

    const triggerSuccess = (msg: string) => {
        setShowSuccess(msg);
        setTimeout(() => setShowSuccess(null), 3000);
    };

    const assetStats = [
        { label: "Assets Tracked", value: "412", icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10", detail: "85% in Lab A" },
        { label: "Maintenace Alerts", value: "3", icon: Calendar, color: "text-amber-500", bg: "bg-amber-500/10", detail: "Critical: Server Rack B" },
        { label: "Assets Requested", value: "18", icon: Truck, color: "text-emerald-500", bg: "bg-emerald-500/10", detail: "Expected Friday" }
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            {/* Modal Overlay */}
            {activeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {activeModal === 'password' ? 'Update Password' :
                                    activeModal === '2fa' ? 'Two-Factor Authentication' : 'Asset Detail View'}
                            </h3>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {activeModal === 'password' && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Current Password</label>
                                        <input type="password" placeholder="••••••••" className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">New Password</label>
                                        <input type="password" placeholder="Enter new password" className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
                                    </div>
                                    <div className="pt-2">
                                        <button onClick={() => { setActiveModal(null); triggerSuccess("Password updated!"); }} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20">
                                            Confirm Update
                                        </button>
                                    </div>
                                </>
                            )}
                            {activeModal === '2fa' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Choose your preferred secondary verification method:</p>
                                    {[
                                        { icon: Smartphone, label: 'Authenticator App (Recommended)', desc: 'Use Google or Microsoft Authenticator' },
                                        { icon: Mail, label: 'Email Verification', desc: 'Receive code on rajesh.k@campus.edu' },
                                        { icon: ShieldCheck, label: 'Hardware Key', desc: 'U2F/WebAuthn standard keys' }
                                    ].map((m, i) => (
                                        <button key={i} className="w-full flex items-center gap-4 p-4 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-left group">
                                            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                                <m.icon size={20} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{m.label}</p>
                                                <p className="text-[10px] text-slate-500">{m.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-end">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Profile Dashboard</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Secure enterprise management terminal for individual profiles.</p>
                </div>
                {showSuccess && (
                    <div className="px-4 py-2 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2 shadow-sm border border-emerald-500/20">
                        <Check size={14} /> {showSuccess}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column - User Info */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm relative group overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500 opacity-20 group-hover:opacity-100 transition-opacity" />

                        <div className="relative inline-flex mb-4">
                            <div className="h-24 w-24 rounded-full bg-blue-600 items-center justify-center text-white font-bold text-3xl ring-4 ring-blue-500/20 overflow-hidden">
                                {user.avatar}
                                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Fingerprint size={32} className="text-white/50" />
                                </div>
                            </div>
                            <div className="absolute -bottom-1 -right-1 h-8 w-8 bg-emerald-500 border-4 border-white dark:border-slate-900 rounded-full flex items-center justify-center text-white" title="Identity Verified">
                                <ShieldCheck size={14} />
                            </div>
                        </div>

                        {isEditing ? (
                            <div className="space-y-4 text-left mt-2 animate-in zoom-in-95 duration-200">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Name</label>
                                    <input
                                        type="text" value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none dark:text-white focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Role</label>
                                    <input
                                        type="text" value={user.role} onChange={(e) => setUser({ ...user, role: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none dark:text-white focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button onClick={handleSaveProfile} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95">
                                        <Save size={14} /> Save
                                    </button>
                                    <button onClick={() => setIsEditing(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all">
                                        <X size={14} /> Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="animate-in fade-in duration-300">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{user.name}</h2>
                                <p className="text-blue-500 font-bold text-sm mb-1 uppercase tracking-tight">{user.role}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">{user.employeeId}</p>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 active:scale-95 border border-slate-200 dark:border-slate-700"
                                >
                                    <Edit size={16} /> Update Bio
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 px-1">Professional Context</h3>
                        <div className="space-y-4 text-slate-700 dark:text-slate-300">
                            <div className="flex flex-col gap-1 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-default border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reporting To</span>
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-white font-bold">AS</div>
                                    <span className="text-xs font-medium">{user.supervisor}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all group">
                                <Calendar size={18} className="text-slate-400 group-hover:text-blue-500" />
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Joining Date</p>
                                    <p className="text-xs font-medium">{user.joiningDate}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all group">
                                <Mail size={18} className="text-slate-400 group-hover:text-blue-500" />
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Work Email</p>
                                    <p className="text-xs font-medium">{user.email}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column - Tabs/Details */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden min-h-[550px]">
                        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                            <nav className="flex px-6 overflow-x-auto no-scrollbar">
                                {[
                                    { id: 'general', label: 'Operations', icon: Activity },
                                    { id: 'security', label: 'Identity & Access', icon: Shield },
                                    { id: 'notifications', label: 'Messaging Prefs', icon: Bell }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => { setActiveTab(tab.id); setIsEditing(false); }}
                                        className={`py-4 px-6 border-b-2 text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 relative ${activeTab === tab.id
                                            ? 'border-blue-500 text-blue-500'
                                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                    >
                                        <tab.icon size={16} />
                                        {tab.label}
                                        {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 animate-in slide-in-from-left-4" />}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        <div className="p-8">
                            {activeTab === 'general' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-400">
                                    <section>
                                        <div className="flex justify-between items-center mb-6">
                                            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Admin Scoped Insights</h4>
                                            <button className="text-xs font-bold text-blue-500 flex items-center gap-1 hover:underline">
                                                Download Report <ExternalLink size={12} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                            {assetStats.map((stat, i) => (
                                                <div key={i} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/20 transition-all cursor-pointer group">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                                                            <stat.icon size={20} />
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                                    </div>
                                                    <p className="text-3xl font-black text-slate-900 dark:text-white mb-1 tracking-tighter">{stat.value}</p>
                                                    <p className="text-[10px] text-slate-500 bg-white dark:bg-slate-800 inline-block px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-700">{stat.detail}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="p-5 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-blue-500/10 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/30 group-hover:rotate-12 transition-transform">
                                                        <Activity size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">Predictive Maintenance Alert (Lab B)</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">3 Server Racks reaching 85% operational limit. Recommended inspection by Oct 30.</p>
                                                    </div>
                                                </div>
                                                <div className="h-8 w-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all translate-x-2">
                                                    <ArrowUpRight size={18} className="text-blue-500" />
                                                </div>
                                            </div>
                                            <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-emerald-500/10 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                                                        <Truck size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">Asset In-Transit: Batch #9022</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">12 Precision Balances for Science Department - Current Status: Local Hub.</p>
                                                    </div>
                                                </div>
                                                <div className="h-8 w-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all translate-x-2">
                                                    <ArrowUpRight size={18} className="text-emerald-500" />
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {activeTab === 'security' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-400">
                                    <section>
                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                            Access Control Terminal <ShieldCheck size={18} className="text-emerald-500" />
                                        </h4>
                                        <div className="space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/10 hover:border-blue-500/50 transition-colors">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Professional Authentication</p>
                                                    <p className="text-xs text-slate-500 leading-relaxed max-w-sm">Last rotation was 42 days ago. Corporate policy requires rotation every 90 days.</p>
                                                </div>
                                                <button onClick={() => setActiveModal('password')} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg active:scale-95">
                                                    Update Password
                                                </button>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/10 active:bg-slate-100">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Multi-Factor Configuration</p>
                                                    <p className="text-xs text-slate-500 leading-relaxed max-w-sm">Authenticator App (TOTP) is currently active on iPhone 15 Pro.</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] uppercase font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">Verified</span>
                                                    <button onClick={() => setActiveModal('2fa')} className="px-5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 transition-all shadow-sm">
                                                        Manage
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="pt-8 border-t border-slate-100 dark:border-slate-800">
                                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                            Login & Security History <History size={16} />
                                        </h4>
                                        <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-2xl">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold">
                                                    <tr>
                                                        <th className="px-4 py-3">Timestamp / Locale</th>
                                                        <th className="px-4 py-3">Hardware / Client</th>
                                                        <th className="px-4 py-3">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                                                    {loginHistory.map(log => (
                                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-4 py-4">
                                                                <p className="font-bold">{log.date}</p>
                                                                <p className="text-[10px] text-slate-400">{log.location}</p>
                                                            </td>
                                                            <td className="px-4 py-4 font-medium">{log.device}</td>
                                                            <td className="px-4 py-4">
                                                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 font-bold rounded-full border border-emerald-500/10">
                                                                    {log.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {activeTab === 'notifications' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-400">
                                    <section>
                                        <div className="flex justify-between items-center mb-6">
                                            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Enterprise Messaging Prefs</h4>
                                            <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 uppercase tracking-widest">Master Switch: ON</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {notifications.map((item: Notification) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-start justify-between p-6 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/50 hover:shadow-xl hover:shadow-slate-200/40 dark:hover:shadow-black/20 transition-all group"
                                                >
                                                    <div className="max-w-[75%]">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                                                            {item.title}
                                                            {item.active && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{item.desc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleNotification(item.id)}
                                                        className={`w-12 h-6 rounded-full p-1 transition-all flex items-center shadow-inner relative overflow-hidden ${item.active ? 'bg-blue-600 justify-end' : 'bg-slate-200 dark:bg-slate-700 justify-start'
                                                            }`}
                                                    >
                                                        <div className="w-4 h-4 bg-white rounded-full shadow-lg transition-all active:scale-90 z-10" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                    <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-white">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-white/10 rounded-xl">
                                                <Smartphone size={24} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">Push Notifications</p>
                                                <p className="text-[11px] text-slate-400">Receive alerts directly on your registered mobile device (Octa-Core Terminal v2.1)</p>
                                            </div>
                                        </div>
                                        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-black transition-all">Configure Device</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
