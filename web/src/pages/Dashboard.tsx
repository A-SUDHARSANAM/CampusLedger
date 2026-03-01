import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
    AreaChart, Area
} from 'recharts';
import { Package, CheckCircle, AlertTriangle, ShoppingCart, ShieldAlert, MoreHorizontal } from 'lucide-react';

const ASSETS_BY_LOCATION = [
    { name: 'CS Labs', value: 80 },
    { name: 'Electronics Lab', value: 55 },
    { name: 'Library', value: 85 },
    { name: 'Classrooms', value: 25 },
    { name: 'Auditorium', value: 50 },
    { name: 'Gymnasium', value: 45 },
    { name: 'Server Room', value: 65 },
    { name: 'Admin', value: 20 },
];

const CATEGORY_DATA = [
    { name: 'Computers', value: 28, color: '#3b82f6' },
    { name: 'Lab Equipment', value: 15, color: '#10b981' },
    { name: 'Furniture', value: 34, color: '#f59e0b' },
    { name: 'Projectors', value: 7, color: '#8b5cf6' },
    { name: 'Networking', value: 5, color: '#ef4444' },
    { name: 'Others', value: 10, color: '#6366f1' },
];

const PROCUREMENT_TREND = [
    { month: 'Sep', amount: 250000 },
    { month: 'Oct', amount: 200000 },
    { month: 'Nov', amount: 320000 },
    { month: 'Dec', amount: 180000 },
    { month: 'Jan', amount: 480000 },
    { month: 'Feb', amount: 300000 },
];

export function Dashboard() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard Overview</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back, Dr. Rajesh Kumar. Here's your campus summary.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                    { label: 'Total Assets', value: '640', trend: '+ 12% from last month', icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Active Assets', value: '582', trend: null, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Damaged Assets', value: '23', trend: null, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                    { label: 'Pending Requests', value: '8', trend: null, icon: ShoppingCart, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    { label: 'Warranty Expiring', value: '12', trend: null, icon: ShieldAlert, color: 'text-blue-500', bg: 'bg-blue-500/10' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stat.value}</h3>
                            </div>
                            <div className={`${stat.bg} p-2 rounded-lg`}>
                                <stat.icon size={20} className={stat.color} />
                            </div>
                        </div>
                        {stat.trend && (
                            <p className="text-xs text-emerald-500 font-medium">{stat.trend}</p>
                        )}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Assets by Location */}
                <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold dark:text-white flex items-center gap-2">
                            <Package size={18} className="text-blue-500" /> Assets by Location
                        </h2>
                        <MoreHorizontal size={20} className="text-slate-400 cursor-pointer" />
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={ASSETS_BY_LOCATION}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                                    contentStyle={{ backgroundColor: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '12px' }}
                                    itemStyle={{ color: 'var(--text)' }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={35} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Asset Category Distribution */}
                <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold dark:text-white">Asset Category Distribution</h2>
                        <MoreHorizontal size={20} className="text-slate-400 cursor-pointer" />
                    </div>
                    <div className="h-[300px] w-full flex flex-col md:flex-row items-center">
                        <div className="flex-1 h-full w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={CATEGORY_DATA}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {CATEGORY_DATA.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '12px' }}
                                        itemStyle={{ color: 'var(--text)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-1 gap-x-8 gap-y-2 mt-4 md:mt-0 md:pl-4 min-w-[160px]">
                            {CATEGORY_DATA.map((item, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{item.name} {item.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Procurement Trend */}
                <div className="lg:col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold dark:text-white">Monthly Procurement Trend (₹)</h2>
                        <div className="flex items-center gap-2 text-xs text-blue-500 font-medium">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>amount</span>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={PROCUREMENT_TREND}>
                                <defs>
                                    <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
                                <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value / 1000}K`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '12px' }}
                                    itemStyle={{ color: 'var(--text)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorAmt)"
                                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
