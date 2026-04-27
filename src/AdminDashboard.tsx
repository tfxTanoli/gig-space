import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Home,
  Edit3,
  Tag,
  Users,
  Package,
  CreditCard,
  Link2,
  Settings,
  Search,
  Bell,
} from 'lucide-react';
import LocationIcon from './LocationIcon';
import { CurrentUserAvatar } from './UserAvatar';

const navItems = [
  { name: 'Home',          icon: Home },
  { name: 'Posts',         icon: Edit3 },
  { name: 'Listings',      icon: Tag },
  { name: 'Users',         icon: Users },
  { name: 'Orders',        icon: Package },
  { name: 'Subscriptions', icon: CreditCard },
  { name: 'Affiliates',    icon: Link2 },
  { name: 'Settings',      icon: Settings },
];

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('Home');

  return (
    <div className="min-h-screen bg-[#0E1422] flex text-white font-sans">

      {/* ── Sidebar ── */}
      <aside className="w-72 bg-[#111827] flex flex-col shrink-0 border-r border-slate-800 min-h-screen">
        {/* Logo */}
        <div className="h-16 flex items-center px-6">
          <Link to="/" className="flex items-center gap-0.5">
            <LocationIcon className="w-6 h-6" />
            <span className="text-xl font-bold tracking-tight text-white">igspace</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ name, icon: Icon }) => {
            const isActive = activeTab === name;
            return (
              <button
                key={name}
                onClick={() => setActiveTab(name)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/10 text-primary'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                {name}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-[#0E1422] border-b border-slate-800">
          {/* Search */}
          <div className="flex items-center gap-2 text-slate-500 flex-1">
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">Search...</span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-4">
            <Bell className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer transition-colors" />
            <div className="w-px h-6 bg-slate-700" />
            <CurrentUserAvatar size="sm" />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          <div className="w-full h-full border border-dashed border-slate-700/60 rounded-xl" style={{ minHeight: 'calc(100vh - 7rem)' }} />
        </main>

      </div>
    </div>
  );
};

export default AdminDashboard;
