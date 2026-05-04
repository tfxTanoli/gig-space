export interface AdminAffiliate {
  uid: string;
  name: string;
  email: string;
  username: string;
  photoURL: string;
  referralCode: string;
  totalReferrals: number;
  lifetimeEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  createdAt: number;
}

interface Props {
  affiliates: AdminAffiliate[];
  loading: boolean;
}

export default function AdminAffiliatesTable({ affiliates, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (affiliates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-white font-semibold text-base">No affiliates yet</p>
        <p className="text-slate-500 text-sm mt-1">Affiliates will appear here once they sign up.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[780px]">
          <thead>
            <tr className="text-slate-500 text-xs border-b border-slate-800 bg-[#0E1422]/60">
              <th className="text-left px-5 py-3.5 font-medium">Affiliate</th>
              <th className="text-left px-5 py-3.5 font-medium">Referral Code</th>
              <th className="text-left px-5 py-3.5 font-medium">Referrals</th>
              <th className="text-left px-5 py-3.5 font-medium">Lifetime Earnings</th>
              <th className="text-left px-5 py-3.5 font-medium">Available</th>
              <th className="text-left px-5 py-3.5 font-medium">Pending</th>
              <th className="text-left px-5 py-3.5 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {affiliates.map((a) => (
              <tr
                key={a.uid}
                className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 transition-colors"
              >
                {/* Name + email */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {a.photoURL ? (
                      <img
                        src={a.photoURL}
                        alt={a.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{a.name}</p>
                      <p className="text-slate-500 text-xs truncate">{a.email}</p>
                    </div>
                  </div>
                </td>

                {/* Referral code */}
                <td className="px-5 py-4">
                  {a.referralCode ? (
                    <span className="text-slate-300 font-mono text-xs bg-slate-800 px-2 py-1 rounded">
                      {a.referralCode}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </td>

                <td className="px-5 py-4 text-slate-300">{a.totalReferrals}</td>

                <td className="px-5 py-4 text-white font-semibold">
                  ${a.lifetimeEarnings.toFixed(2)}
                </td>

                <td className="px-5 py-4">
                  <span className="text-emerald-400 font-semibold">
                    ${a.availableBalance.toFixed(2)}
                  </span>
                </td>

                <td className="px-5 py-4">
                  <span className="text-yellow-400">
                    ${a.pendingBalance.toFixed(2)}
                  </span>
                </td>

                <td className="px-5 py-4 text-slate-500 text-xs">
                  {new Date(a.createdAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
