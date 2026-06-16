import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type AccountTypeOption = 'buyer' | 'seller' | 'affiliate';

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-primary">
    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
  </svg>
);

const options: { type: AccountTypeOption; label: string; description: string }[] = [
  { type: 'buyer',     label: 'Buyer',     description: 'I want to hire services' },
  { type: 'seller',    label: 'Seller',    description: 'I want to sell my services' },
  { type: 'affiliate', label: 'Affiliate', description: 'I want to refer users and earn commissions' },
];

const destinationMap: Record<AccountTypeOption, string> = {
  buyer:     '/buyer-profile',
  seller:    '/seller-profile',
  affiliate: '/affiliate-profile',
};

const AccountType = () => {
  const [selectedType, setSelectedType] = useState<AccountTypeOption>('buyer');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-deep p-4">
      <div className="bg-card rounded-xl shadow-2xl p-8 lg:p-12 w-full max-w-[500px] flex flex-col items-center">

        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <UserRound strokeWidth={2} className="text-primary w-6 h-6" />
        </div>

        <h2 className="text-lg font-bold text-white mb-8">
          Select your preferred account type
        </h2>

        <div className="w-full space-y-4">
          {options.map(({ type, label, description }) => (
            <div
              key={type}
              className={`w-full p-4 rounded-xl cursor-pointer transition-colors border-2 flex justify-between items-center bg-surface-raised ${
                selectedType === type
                  ? 'border-primary'
                  : 'border-slate-700/50 hover:border-slate-600'
              }`}
              onClick={() => setSelectedType(type)}
            >
              <div>
                <div className="text-white font-medium mb-1">{label}</div>
                <div className="text-slate-400 text-sm">{description}</div>
              </div>
              {selectedType === type && <CheckIcon />}
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate(destinationMap[selectedType])}
          className="mt-8 w-full bg-primary hover:bg-blue-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          Continue
        </button>

      </div>
    </div>
  );
};

export default AccountType;
