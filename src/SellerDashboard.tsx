import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Home,
  Edit3,
  Package,
  MessageSquare,
  FileText,
  DollarSign,
  Settings,
  RefreshCw,
  Search,
  Bell,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { CurrentUserAvatar } from './UserAvatar';

const SellerDashboard = () => {
  const { userProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('Home');

  const navItems = [
    { name: 'Home', icon: Home },
    { name: 'Posts', icon: Edit3 },
    { name: 'Orders', icon: Package },
    { name: 'Messages', icon: MessageSquare },
    { name: 'Statements', icon: FileText },
    { name: 'Payouts', icon: DollarSign },
    { name: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0E1422] flex text-white font-sans">

      {/* Sidebar */}
      <aside className="w-64 bg-[#111827] flex flex-col shrink-0 border-r border-slate-800 hidden md:flex">
        <div className="h-16 flex items-center px-6">
          <Link to="/" className="flex items-center">
            <MapPin className="text-primary w-6 h-6 mr-1" fill="currentColor" />
            <span className="text-xl font-bold tracking-tight text-white">igspace</span>
          </Link>
        </div>

        {userProfile && (
          <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-3">
            <CurrentUserAvatar size="md" />
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{userProfile.name}</p>
              <p className="text-slate-400 text-xs truncate">@{userProfile.username}</p>
            </div>
          </div>
        )}

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

        <div className="p-4 border-t border-slate-800 space-y-1">
          <Link to="/buyer-dashboard" className="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer">
            <RefreshCw className="w-5 h-5 mr-3" />
            Switch to buyer dashboard
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
            <Link to="/post-service" className="hidden sm:flex items-center gap-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              + New Post
            </Link>
            <CurrentUserAvatar size="sm" />
          </div>
        </header>

        <main className="flex-1 p-6 flex flex-col">
          {activeTab === 'Home' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Welcome back{userProfile?.name ? `, ${userProfile.name}` : ''}!
                </h2>
                <p className="text-slate-400 text-sm mt-1">Here's an overview of your seller activity.</p>
              </div>
              <div className="flex-1 border border-dashed border-slate-800 rounded-xl bg-[#0E1422] flex flex-col items-center justify-center min-h-[300px] gap-4">
                <p className="text-slate-500 text-sm">You have no posts yet.</p>
                <Link to="/post-service" className="bg-primary hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors">
                  Create your first post
                </Link>
              </div>
            </div>
          )}
          {activeTab !== 'Home' && (
            <div className="flex-1 border border-dashed border-slate-800 rounded-xl bg-[#0E1422] flex items-center justify-center min-h-[400px]">
              <p className="text-slate-500 text-sm">{activeTab} — coming soon</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SellerDashboard;
