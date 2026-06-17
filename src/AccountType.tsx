import { useState } from 'react';
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-surface rounded-xl shadow-2xl p-8 lg:p-12 w-full max-w-[500px] flex flex-col items-center">

        <div className="mb-6">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="24" fill="#004F3B"/>
            <path d="M24 25C26.7614 25 29 22.7614 29 20C29 17.2386 26.7614 15 24 15C21.2386 15 19 17.2386 19 20C19 22.7614 21.2386 25 24 25Z" stroke="#00D492" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M32 33C32 30.8783 31.1571 28.8434 29.6569 27.3431C28.1566 25.8429 26.1217 25 24 25C21.8783 25 19.8434 25.8429 18.3431 27.3431C16.8429 28.8434 16 30.8783 16 33" stroke="#00D492" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
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
          className="mt-8 w-full bg-[#2b7fff] hover:bg-blue-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          Continue
        </button>

      </div>
    </div>
  );
};

export default AccountType;
