import { useState } from 'react';
import { Search, Bell } from 'lucide-react';
import { CurrentUserAvatar } from '../../UserAvatar';

const AdminTopbar = () => {
  const [query, setQuery] = useState('');

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-[#0E1422] border-b border-slate-800 sticky top-0 z-10">
      <div className="flex items-center gap-2 bg-[#1A2035] border border-slate-700/50 rounded-lg px-3 py-2 w-72 focus-within:border-slate-600 transition-colors">
        <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="bg-transparent text-sm text-slate-300 placeholder-slate-500 outline-none w-full"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
        </button>
        <div className="w-px h-6 bg-slate-700" />
        <CurrentUserAvatar size="sm" />
      </div>
    </header>
  );
};

export default AdminTopbar;
