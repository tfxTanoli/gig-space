import { useState } from 'react';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AccountType = () => {
  const [selectedType, setSelectedType] = useState<'buyer' | 'seller'>('buyer');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#818791] p-4">
      <div className="bg-[#0E1422] rounded-xl shadow-2xl p-8 lg:p-12 w-full max-w-[500px] flex flex-col items-center">
        
        {/* Top Green Checkmark */}
        <div className="w-12 h-12 bg-[#0C4A26] rounded-full flex items-center justify-center mb-6">
          <Check strokeWidth={3} className="text-[#2EEA60] w-6 h-6" />
        </div>

        <h2 className="text-lg font-bold text-white mb-8">
          Select your preferred account type
        </h2>

        <div className="w-full space-y-4">
          {/* Buyer Option */}
          <div 
            className={`w-full p-4 rounded-xl cursor-pointer transition-colors border-2 flex justify-between items-center ${
              selectedType === 'buyer' 
                ? 'border-primary' 
                : 'border-slate-700/50 hover:border-slate-600'
            }`}
            onClick={() => setSelectedType('buyer')}
          >
            <div>
              <div className="text-white font-medium mb-1">Buyer</div>
              <div className="text-slate-400 text-sm">I want to hire services</div>
            </div>
            {selectedType === 'buyer' && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-primary">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          {/* Seller Option */}
          <div 
            className={`w-full p-4 rounded-xl cursor-pointer transition-colors border-2 flex justify-between items-center ${
              selectedType === 'seller' 
                ? 'border-primary' 
                : 'border-slate-700/50 hover:border-slate-600'
            }`}
            onClick={() => setSelectedType('seller')}
          >
            <div>
              <div className="text-white font-medium mb-1">Seller</div>
              <div className="text-slate-400 text-sm">I want to sell my services</div>
            </div>
            {selectedType === 'seller' && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-primary">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>

        <button
          onClick={() => navigate(selectedType === 'buyer' ? '/buyer-profile' : '/seller-profile')}
          className="mt-8 w-full bg-primary hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          Continue
        </button>

      </div>
    </div>
  );
};

export default AccountType;
