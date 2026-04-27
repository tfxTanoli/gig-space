import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Home,
  DollarSign,
  Settings,
  RefreshCw,
  Search,
  Bell,
} from 'lucide-react';
import LocationIcon from './LocationIcon';
import { CurrentUserAvatar } from './UserAvatar';
import { useAuth } from './AuthContext';

const AffiliateDashboard = () => {
  const { userProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('Home');

  const navItems = [
    { name: 'Home', icon: Home },
    { name: 'Payouts', icon: DollarSign },
    { name: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0E1422] flex text-white font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-[#111827] flex flex-col shrink-0 border-r border-slate-800 hidden md:flex">
        {/* Logo */}
        <div className="h-16 flex items-center px-6">
          <Link to="/" className="flex items-center">
            <LocationIcon className="w-6 h-6 mr-1" />
            <span className="text-xl font-bold tracking-tight text-white">igspace</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.name;
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-blue-600/10 text-primary' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                {item.name}
              </button>
            );
          })}
        </nav>

        {userProfile && (
          <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-3">
            <CurrentUserAvatar size="md" />
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{userProfile.name}</p>
              <p className="text-slate-400 text-xs truncate">@{userProfile.username}</p>
            </div>
          </div>
        )}

        {/* Bottom Switch Button */}
        <div className="p-4 border-t border-slate-800/0 space-y-1">
          <Link to="/seller-dashboard" className="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer">
            <RefreshCw className="w-5 h-5 mr-3" />
            Switch to seller dashboard
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-red-400 transition-colors"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-[#0E1422] border-b border-slate-800">
          <div className="flex items-center flex-1">
            <Search className="w-5 h-5 text-slate-500 mr-3" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent border-none text-sm text-white focus:outline-none w-full max-w-sm placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="text-slate-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-slate-700" />
            <CurrentUserAvatar size="sm" />
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-6 flex flex-col">
          {/* Placeholder Dashed Box from screenshot */}
          <div className="flex-1 border border-dashed border-slate-800 rounded-xl bg-[#0E1422] flex items-center justify-center min-h-[400px]">
          </div>
        </main>
      </div>

    </div>
  );
};

export default AffiliateDashboard;
