import { useState } from 'react';
import {
    Settings as SettingsIcon, User, Bell, Lock, Eye, Database,
    Globe, HardDrive, ChevronRight, Check, Trash2, Download,
    RefreshCw, Monitor, Type, Shield, Smartphone, X,
    AlertTriangle, Info, ExternalLink
} from 'lucide-react';

export function Settings() {
    const [activeTab, setActiveTab] = useState('general');
    const [savedStatus, setSavedStatus] = useState<string | null>(null);
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [backupProgress, setBackupProgress] = useState(0);

    const handleSave = () => {
        setSavedStatus('Settings saved successfully!');
        setTimeout(() => setSavedStatus(null), 3000);
    };

    const runBackup = () => {
        setBackupProgress(10);
        const interval = setInterval(() => {
            setBackupProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setSavedStatus('Database backup complete!');
                    setTimeout(() => {
                        setSavedStatus(null);
                        setBackupProgress(0);
                    }, 3000);
                    return 100;
                }
                return prev + 15;
            });
        }, 500);
    };

    const menuItems = [
        { id: 'general', label: 'General', icon: SettingsIcon },
        { id: 'account', label: 'Account Systems', icon: User },
        { id: 'notifications', label: 'Messaging & Alerts', icon: Bell },
        { id: 'security', label: 'Enterprise Security', icon: Lock },
        { id: 'display', label: 'Interface & Display', icon: Eye },
        { id: 'data', label: 'Data & Sync', icon: Database },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            {/* Action Modals */}
            {activeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                {activeModal === 'deactivate' ? <AlertTriangle className="text-rose-500" /> : <Info className="text-blue-500" />}
                                {activeModal === 'deactivate' ? 'Deactivate Instance' : 'System Information'}
                            </h3>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {activeModal === 'deactivate' ? (
                                <>
                                    <p className="text-sm text-slate-500 leading-relaxed">
                                        Are you sure you want to deactivate the <strong>Campus Ledger</strong> instance? This will revoke access for all sub-admins and workers immediately.
                                    </p>
                                    <div className="pt-4 flex gap-3">
                                        <button onClick={() => setActiveModal(null)} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl active:scale-95 transition-all">Cancel</button>
                                        <button className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-rose-500/20">Deactivate</button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-400 font-bold">CORE VERSION</span>
                                            <span className="text-blue-500 font-black">v4.8.2-enterprise</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-400 font-bold">DATABASE CLUSTER</span>
                                            <span className="text-emerald-500 font-black">ACTIVE / OPTIMIZED</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-400 font-bold">LAST SYNC</span>
                                            <span className="text-slate-600 dark:text-slate-300">4 mins ago</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setActiveModal(null)} className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl">Close</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-end">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Global Settings</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Master control panel for campus resources and system behavior.</p>
                </div>
                {savedStatus && (
                    <div className="px-4 py-2 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2 border border-emerald-500/20 shadow-sm">
                        <Check size={14} /> {savedStatus}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden min-h-[650px]">
                {/* Sidebar */}
                <aside className="lg:col-span-3 border-r border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/30 dark:bg-slate-800/10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-4 mt-2">Configuration Modules</p>
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all group ${activeTab === item.id
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30 -translate-y-0.5'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon size={18} className={`${activeTab === item.id ? 'scale-110' : 'group-hover:text-blue-500'} transition-all`} />
                                <span className="text-sm font-bold">{item.label}</span>
                            </div>
                            <ChevronRight size={14} className={`${activeTab === item.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'} transition-all`} />
                        </button>
                    ))}
                    <div className="pt-8 px-4">
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                            <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">System Health</p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">All Nodes Operational</p>
                        </div>
                    </div>
                </aside>

                {/* Content Area */}
                <div className="lg:col-span-9 p-8">
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-400">
                            <section className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Main Instance Config</h3>
                                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500">Node ID: MCL-PRIME-01</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Campus Public Name</label>
                                        <input
                                            type="text"
                                            defaultValue="Main City University - Ledger"
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Server Timezone</label>
                                        <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-medium appearance-none">
                                            <option>India (GMT +5:30)</option>
                                            <option>UTC (GMT +0:00)</option>
                                            <option>EST (GMT -5:00)</option>
                                        </select>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4 pt-8 border-t border-slate-100 dark:border-slate-800">
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Localization Overrides</h3>
                                <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 group hover:border-blue-500/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/20 group-hover:rotate-6 transition-transform">
                                            <Globe size={24} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">Primary Interface Language</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-tight">Currently serving: English (Global Standard)</p>
                                        </div>
                                    </div>
                                    <button className="px-5 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black hover:bg-slate-50 transition-colors shadow-sm">Change Regional</button>
                                </div>
                            </section>

                            <div className="pt-8 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    className="px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-500/30 active:scale-95 text-xs uppercase tracking-widest"
                                >
                                    Commit Changes
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'account' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-400">
                            <section className="space-y-6">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Account Ecosystem</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/10 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                                                <Download size={20} />
                                            </div>
                                            <span className="text-sm font-bold">Data Sovereignty</span>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed font-medium">Export all your personal activity logs, asset assignments, and reporting history in JSON/CSV format.</p>
                                        <button className="w-full py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                                            Generate Archive <ExternalLink size={14} />
                                        </button>
                                    </div>
                                    <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/10 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
                                                <Trash2 size={20} />
                                            </div>
                                            <span className="text-sm font-bold">Account Lifecycle</span>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed font-medium">Initiate deactivation or full deletion of your identity within the Campus Ledger cluster.</p>
                                        <button onClick={() => setActiveModal('deactivate')} className="w-full py-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 border border-rose-100 dark:border-rose-500/20 rounded-xl text-xs font-black hover:bg-rose-100 transition-all">
                                            Destructive Actions
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4 pt-8 border-t border-slate-100 dark:border-slate-800">
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Identity Verification</h3>
                                <div className="p-4 bg-slate-900 rounded-2xl flex items-center justify-between text-white shadow-2xl overflow-hidden relative">
                                    <div className="absolute top-0 right-0 p-8 opacity-10">
                                        <Shield size={120} />
                                    </div>
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20">
                                            <Smartphone size={24} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold underline decoration-blue-500 underline-offset-4">Biometric Terminal Enrollment</p>
                                            <p className="text-[10px] text-slate-400">Pair your workstation with mobile biometrics for instant login.</p>
                                        </div>
                                    </div>
                                    <button className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-black transition-all relative z-10">Enroll Device</button>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-400">
                            <section className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Messaging Protocols</h3>
                                    <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        WEBHOOKS ACTIVE
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {[
                                        { label: 'Critical Failure Alert', desc: 'Notify admins instantly if server rack health drops below 40%.', active: true },
                                        { label: 'Asset Procurement High-Priority', desc: 'Sync with finance department for high-value approvals.', active: true },
                                        { label: 'Weekly Audit Dispatch', desc: 'Global list of missing/damaged items dispatched to HR.', active: false },
                                        { label: 'Mobile Device Push', desc: 'Real-time sync between mobile app and central hub.', active: true },
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/50 hover:shadow-lg transition-all group">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">{item.label}</p>
                                                <p className="text-xs text-slate-500 font-medium tracking-tight">{item.desc}</p>
                                            </div>
                                            <button className={`w-12 h-6 rounded-full p-1 transition-all flex items-center shadow-inner ${item.active ? 'bg-blue-600 justify-end' : 'bg-slate-200 dark:bg-slate-700 justify-start'}`}>
                                                <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-400">
                            <section className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Encryption & Access</h3>
                                    <Shield size={20} className="text-blue-500" />
                                </div>
                                <div className="space-y-4">
                                    <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/10 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">API Key Management</p>
                                            <p className="text-xs text-slate-500 font-medium tracking-tight">Currently using RSA-4096 Enterprise Tier encryption keys.</p>
                                        </div>
                                        <button className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-black transition-all flex items-center gap-2">
                                            Rotate Keys <RefreshCw size={14} />
                                        </button>
                                    </div>
                                    <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/10 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">Auto-Logout Session</p>
                                            <p className="text-xs text-slate-500 font-medium tracking-tight">System will terminate active session after 30 mins of inactivity.</p>
                                        </div>
                                        <select className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black outline-none">
                                            <option>15 Mins</option>
                                            <option selected>30 Mins</option>
                                            <option>1 Hour</option>
                                        </select>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'display' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-400">
                            <section className="space-y-6">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Visual Identity</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/10 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                                                <Monitor size={20} />
                                            </div>
                                            <span className="text-sm font-bold">Base Interface Mode</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {['Light', 'Dark', 'Adaptive'].map(mode => (
                                                <button key={mode} className={`flex-1 py-2 text-[10px] font-black rounded-xl border transition-all ${mode === 'Adaptive' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                                    {mode.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/10 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                                                <Type size={20} />
                                            </div>
                                            <span className="text-sm font-bold">Dynamic Typography</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs font-bold text-slate-400">A</span>
                                            <input type="range" min="12" max="18" defaultValue="14" className="flex-1 accent-blue-600" />
                                            <span className="text-lg font-bold text-slate-900 dark:text-white">A</span>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-400">
                            <section className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Mainframe Maintenance</h3>
                                    <div className="p-2 bg-blue-500/5 text-blue-500 rounded-xl">
                                        <HardDrive size={20} />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/10 flex items-center justify-between group">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">Database Snapshot & Backup</p>
                                            <p className="text-xs text-slate-500 font-medium tracking-tight">Recommended before major system updates or procurement cycles.</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {backupProgress > 0 && backupProgress < 100 && (
                                                <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${backupProgress}%` }} />
                                                </div>
                                            )}
                                            <button
                                                onClick={runBackup}
                                                disabled={backupProgress > 0 && backupProgress < 100}
                                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 active:scale-95 disabled:opacity-50"
                                            >
                                                {backupProgress > 0 && backupProgress < 100 ? 'IN PROGRESS' : 'RUN SYNC NOW'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/10 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">Audit Trail Retention</p>
                                            <p className="text-xs text-slate-500 font-medium tracking-tight">Keep historical logs of all asset movements for compliance.</p>
                                        </div>
                                        <select className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black outline-none">
                                            <option>90 Days</option>
                                            <option selected>1 Year</option>
                                            <option>Unlimited</option>
                                        </select>
                                    </div>
                                    <div className="p-6 bg-rose-500/5 border border-rose-500/10 rounded-3xl flex items-center justify-between group">
                                        <div>
                                            <p className="text-sm font-bold text-rose-600">Flush Interface Cache</p>
                                            <p className="text-xs text-rose-500/70 font-medium tracking-tight">Clear all locally stored session shards and temporary asset ghosts.</p>
                                        </div>
                                        <button className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2">
                                            Flush Now <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                                        </button>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
