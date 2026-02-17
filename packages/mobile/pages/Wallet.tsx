import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, Copy, Check, X, ShieldCheck, Globe, ChevronDown, Lock, Smartphone, Clock, ExternalLink, Activity, Filter } from 'lucide-react';
import { Card, Button } from '../components/Shared';
import { CURRENT_USER, MOCK_TRANSACTIONS } from '../mockData';
import { Transaction } from '../types';

const NETWORKS = ['Stellar', 'Solana Mainnet', 'Ethereum (ERC20)', 'Polygon', 'Arbitrum One'];

export const Wallet: React.FC = () => {
   const [isScrolled, setIsScrolled] = useState(false);
   const [showAddressSheet, setShowAddressSheet] = useState(false);
   const [showWithdrawSheet, setShowWithdrawSheet] = useState(false);
   const [copied, setCopied] = useState(false);
   const [pinRequested, setPinRequested] = useState(false);

   // New State for features
   const [showSuccessModal, setShowSuccessModal] = useState(false);
   const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

   // Date Filter State
   const [showDateFilter, setShowDateFilter] = useState(false);
   const [dateRange, setDateRange] = useState({ start: '', end: '' });

   const [withdrawForm, setWithdrawForm] = useState({
      network: NETWORKS[0],
      address: '',
      amount: '',
      twoFactor: '',
      pin: ''
   });

   // Mock full address since the user object has a truncated one
   const fullAddress = "GDSp4s7m8g5f29X7Z3b4n5m6k7j8h9g0f1d2s3a4";

   useEffect(() => {
      const scrollContainer = document.querySelector('main');

      const handleScroll = () => {
         if (scrollContainer) {
            setIsScrolled(scrollContainer.scrollTop > 20);
         }
      };

      if (scrollContainer) {
         scrollContainer.addEventListener('scroll', handleScroll);
         // Check initial state
         handleScroll();
      }

      return () => {
         if (scrollContainer) {
            scrollContainer.removeEventListener('scroll', handleScroll);
         }
      };
   }, []);

   const handleCopy = () => {
      navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
   };

   const handleRequestPin = () => {
      setPinRequested(true);
      // Logic to send email would go here
      setTimeout(() => setPinRequested(false), 5000);
   };

   const handleWithdraw = (e: React.FormEvent) => {
      e.preventDefault();

      // Prevent submission if amount is invalid or form incomplete
      const amountVal = parseFloat(withdrawForm.amount);
      const isFormComplete =
         withdrawForm.network.trim() !== '' &&
         withdrawForm.address.trim() !== '' &&
         withdrawForm.amount.trim() !== '' &&
         withdrawForm.twoFactor.trim() !== '' &&
         withdrawForm.pin.trim() !== '';

      if (isNaN(amountVal) || amountVal > CURRENT_USER.totalEarned || !isFormComplete) {
         return;
      }

      setShowWithdrawSheet(false);
      setShowSuccessModal(true);

      // Submit logic would go here
      setWithdrawForm({
         network: NETWORKS[0],
         address: '',
         amount: '',
         twoFactor: '',
         pin: ''
      });
   };

   const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;

      // Allow empty string to clear input
      if (val === '') {
         setWithdrawForm(prev => ({ ...prev, amount: '' }));
         return;
      }

      // Regex for valid currency format (integers or floats with up to 2 decimal places)
      if (!/^\d*\.?\d{0,2}$/.test(val)) {
         return;
      }

      // Allow user to type any valid number, we will show error if it exceeds balance
      setWithdrawForm(prev => ({ ...prev, amount: val }));
   };

   const handleTwoFactorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      // Regex for integers only
      if (/^\d*$/.test(val)) {
         setWithdrawForm(prev => ({ ...prev, twoFactor: val }));
      }
   };

   const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      // Regex for integers only
      if (/^\d*$/.test(val)) {
         setWithdrawForm(prev => ({ ...prev, pin: val }));
      }
   };

   const amountVal = parseFloat(withdrawForm.amount || '0');
   const hasInsufficientFunds = !isNaN(amountVal) && amountVal > CURRENT_USER.totalEarned;

   const isFormComplete =
      withdrawForm.network.trim() !== '' &&
      withdrawForm.address.trim() !== '' &&
      withdrawForm.amount.trim() !== '' &&
      withdrawForm.twoFactor.trim() !== '' &&
      withdrawForm.pin.trim() !== '';

   const getStatusColor = (status: Transaction['status']) => {
      switch (status) {
         case 'Completed': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
         case 'Pending': return 'text-warning bg-warning/10 border-warning/20';
         case 'Failed': return 'text-error bg-error/10 border-error/20';
         default: return 'text-text-secondary bg-white/5 border-white/10';
      }
   };

   const getStatusIcon = (status: Transaction['status']) => {
      switch (status) {
         case 'Completed': return <Check size={12} strokeWidth={3} />;
         case 'Pending': return <Clock size={12} strokeWidth={3} />;
         case 'Failed': return <X size={12} strokeWidth={3} />;
         default: return null;
      }
   };

   // Filter transactions based on date range
   const filteredTransactions = MOCK_TRANSACTIONS.filter(tx => {
      if (dateRange.start && tx.date < dateRange.start) return false;
      if (dateRange.end && tx.date > dateRange.end) return false;
      return true;
   });

   const formattedBalance = CURRENT_USER.totalEarned.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
   });

   return (
      <div className="min-h-full flex flex-col relative">
         {/* Sticky Header / Widget */}
         <div className={`sticky top-0 z-30 transition-all duration-300 ${isScrolled ? 'bg-background/95 backdrop-blur-xl border-b border-white/5 pt-2 px-3 pb-2' : 'pt-6 px-5 pb-2 bg-transparent'}`}>

            {/* Balance Card */}
            <div className={`
          relative overflow-hidden rounded-2xl bg-gradient-to-br from-surface to-[#222] border border-border shadow-2xl transition-all duration-500
          ${isScrolled ? 'p-4 flex items-center justify-between' : 'p-6 flex flex-col items-center text-center'}
        `}>
               <div className="absolute top-0 right-0 p-32 bg-primary/10 blur-[80px] rounded-full pointer-events-none"></div>

               <div className="relative z-10 w-full">
                  <div className={isScrolled ? 'flex items-baseline gap-3' : 'flex flex-col items-center'}>
                     <p className={`text-text-secondary font-medium tracking-wider uppercase transition-all duration-300 ${isScrolled ? 'text-[10px] mb-0' : 'text-sm mb-2'}`}>
                        Total Balance
                     </p>
                     <h1 className={`font-bold text-white tracking-tighter transition-all duration-300 ${isScrolled ? 'text-2xl' : 'text-3xl mb-2'}`}>
                        ${formattedBalance} <span className={`text-primary font-normal ${isScrolled ? 'text-sm' : 'text-lg'}`}>USDC</span>
                     </h1>

                     {/* Collapsible Address */}
                     <div className={`transition-all duration-300 overflow-hidden ${isScrolled ? 'h-0 w-0 opacity-0 hidden' : 'h-auto opacity-100 mt-1 mb-8'}`}>
                        <button
                           onClick={() => setShowAddressSheet(true)}
                           className="text-xs text-text-secondary bg-black/30 px-3 py-1.5 rounded-full inline-flex items-center gap-2 font-mono border border-white/5 hover:bg-black/50 hover:text-white transition-colors cursor-pointer group"
                        >
                           {CURRENT_USER.walletAddress}
                           <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                        </button>
                     </div>

                     {/* Collapsible Withdraw Button */}
                     <div className={`transition-all duration-300 overflow-hidden w-full ${isScrolled ? 'h-0 w-0 opacity-0 hidden' : 'h-12 opacity-100'}`}>
                        <Button
                           className="flex gap-2 justify-center"
                           fullWidth
                           size="lg"
                           onClick={() => setShowWithdrawSheet(true)}
                        >
                           <ArrowDownLeft size={18} /> Withdraw
                        </Button>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Transactions List */}
         <div className="px-5 pt-4 pb-24">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-lg font-bold text-white">Recent Transactions</h3>
               <button
                  onClick={() => setShowDateFilter(!showDateFilter)}
                  className={`p-2 rounded-lg transition-colors ${showDateFilter || (dateRange.start || dateRange.end) ? 'bg-primary/20 text-primary' : 'bg-surface text-text-secondary hover:text-white'}`}
               >
                  <Filter size={18} />
               </button>
            </div>

            {/* Date Filter Panel */}
            {showDateFilter && (
               <div className="mb-4 p-4 bg-surface border border-white/5 rounded-2xl animate-in slide-in-from-top-2 fade-in duration-200 space-y-3">
                  <div className="flex gap-3">
                     <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Start Date</label>
                        <div className="relative">
                           <input
                              type="date"
                              value={dateRange.start}
                              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                              className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none [color-scheme:dark]"
                           />
                        </div>
                     </div>
                     <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">End Date</label>
                        <div className="relative">
                           <input
                              type="date"
                              value={dateRange.end}
                              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                              className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none [color-scheme:dark]"
                           />
                        </div>
                     </div>
                  </div>
                  {(dateRange.start || dateRange.end) && (
                     <div className="flex justify-end">
                        <button
                           onClick={() => setDateRange({ start: '', end: '' })}
                           className="text-xs text-text-secondary hover:text-white flex items-center gap-1"
                        >
                           <X size={12} /> Clear Filter
                        </button>
                     </div>
                  )}
               </div>
            )}

            <div className="space-y-3">
               {filteredTransactions.length > 0 ? (
                  filteredTransactions.map(tx => {
                     const isFailed = tx.status === 'Failed';
                     return (
                        <Card
                           key={tx.id}
                           className="flex items-center justify-between py-3.5 hover:bg-white/5 transition-colors group"
                           onClick={() => setSelectedTransaction(tx)}
                        >
                           <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center border border-white/5 relative ${isFailed
                                    ? 'bg-error/10 text-error'
                                    : tx.type === 'Earning' ? 'bg-success/10 text-success' : 'bg-text-secondary/10 text-text-secondary'
                                 }`}>
                                 {tx.type === 'Earning' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                 {/* Status Indicator Dot */}
                                 <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface flex items-center justify-center ${tx.status === 'Completed' ? 'bg-blue-500 text-black' :
                                       tx.status === 'Pending' ? 'bg-yellow-500 text-black' :
                                          'bg-red-500 text-white'
                                    }`}>
                                    {getStatusIcon(tx.status)}
                                 </div>
                              </div>
                              <div>
                                 <div className="font-medium text-sm text-white group-hover:text-primary transition-colors">{tx.description}</div>
                                 <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-text-secondary">{tx.date}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusColor(tx.status)}`}>
                                       {tx.status}
                                    </span>
                                 </div>
                              </div>
                           </div>
                           <div className={`font-mono font-bold text-sm ${isFailed ? 'text-error' : (tx.type === 'Earning' ? 'text-success' : 'text-white')
                              }`}>
                              {tx.type === 'Earning' ? (isFailed ? '' : '+') : '-'}${tx.amount.toLocaleString()}
                           </div>
                        </Card>
                     );
                  })
               ) : (
                  <div className="text-center py-8 text-text-secondary text-sm bg-surface/30 rounded-xl border border-white/5 border-dashed">
                     No transactions found for this period.
                  </div>
               )}
            </div>
         </div>

         {/* Wallet Details Bottom Sheet */}
         {showAddressSheet && (
            <div className="fixed inset-0 z-[60] flex items-end justify-center">
               {/* Backdrop */}
               <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                  onClick={() => setShowAddressSheet(false)}
               ></div>

               {/* Sheet */}
               <div className="relative w-full max-w-lg bg-[#111] border-t border-white/10 rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
                  <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6"></div>

                  <div className="space-y-4">
                     {/* Network Card */}
                     <div className="bg-surface p-4 rounded-xl border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                              <Globe size={20} />
                           </div>
                           <div>
                              <div className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">Network</div>
                              <div className="text-white font-medium">Stellar</div>
                           </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-green-500 bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20">
                           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                           Active
                        </div>
                     </div>

                     {/* Address Card */}
                     <div className="bg-surface p-4 rounded-xl border border-white/5 space-y-3">
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-2">
                              <ShieldCheck size={16} className="text-primary" />
                              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">Wallet Address</span>
                           </div>
                        </div>

                        <button
                           onClick={handleCopy}
                           className="w-full text-left font-mono text-sm text-white/80 break-all bg-black/40 p-3.5 rounded-lg border border-white/5 hover:bg-black/60 transition-colors flex items-start justify-between gap-4 group"
                        >
                           <span>{fullAddress}</span>
                           <div className={`p-1.5 rounded-md transition-colors shrink-0 ${copied ? 'text-green-500 bg-green-500/10' : 'text-text-secondary group-hover:text-white'}`}>
                              {copied ? <Check size={16} /> : <Copy size={16} />}
                           </div>
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* Withdrawal Bottom Sheet */}
         {showWithdrawSheet && (
            <div className="fixed inset-0 z-[60] flex items-end justify-center">
               {/* Backdrop */}
               <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                  onClick={() => setShowWithdrawSheet(false)}
               ></div>

               {/* Sheet */}
               <div className="relative w-full max-w-lg bg-[#111] border-t border-white/10 rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
                  <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0"></div>

                  <div className="flex justify-between items-center mb-6 px-1">
                     <h2 className="text-xl font-bold text-white">Withdraw Funds</h2>
                     <button
                        onClick={() => setShowWithdrawSheet(false)}
                        className="p-2 bg-surface rounded-full text-text-secondary hover:text-white border border-white/5 transition-colors"
                     >
                        <X size={20} />
                     </button>
                  </div>

                  <form onSubmit={handleWithdraw} className="overflow-y-auto hide-scrollbar flex-1 space-y-5 px-1 pb-4">
                     {/* Network Selection */}
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1">Network</label>
                        <div className="relative">
                           <select
                              value={withdrawForm.network}
                              onChange={(e) => setWithdrawForm({ ...withdrawForm, network: e.target.value })}
                              className="w-full appearance-none bg-surface border border-white/10 rounded-xl p-4 text-sm text-white focus:border-primary focus:outline-none"
                           >
                              {NETWORKS.map(net => <option key={net} value={net}>{net}</option>)}
                           </select>
                           <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={18} />
                        </div>
                     </div>

                     {/* Wallet Address */}
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1">Wallet Address</label>
                        <input
                           type="text"
                           placeholder="GA..."
                           value={withdrawForm.address}
                           onChange={(e) => setWithdrawForm({ ...withdrawForm, address: e.target.value })}
                           className="w-full bg-surface border border-white/10 rounded-xl p-4 text-sm text-white focus:border-primary focus:outline-none placeholder:text-text-secondary/50 font-mono"
                        />
                     </div>

                     {/* Amount */}
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1">Amount (USDC)</label>
                        <div className="relative">
                           <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={withdrawForm.amount}
                              onChange={handleAmountChange}
                              className={`w-full bg-surface border rounded-xl p-4 text-sm text-white focus:outline-none placeholder:text-text-secondary/50 font-mono ${hasInsufficientFunds ? 'border-error/50 focus:border-error' : 'border-white/10 focus:border-primary'}`}
                           />
                           <button
                              type="button"
                              onClick={() => setWithdrawForm({ ...withdrawForm, amount: CURRENT_USER.totalEarned.toString() })}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-white/10 hover:bg-white/20 text-primary px-2 py-1 rounded transition-colors"
                           >
                              MAX
                           </button>
                        </div>
                        {hasInsufficientFunds ? (
                           <div className="text-left text-[10px] text-error font-bold pr-1 mt-1 animate-in slide-in-from-top-1">
                              Amount {withdrawForm.amount} is above your available balance of {CURRENT_USER.totalEarned.toLocaleString()}
                           </div>
                        ) : (
                           <div className="text-right text-[10px] text-text-secondary pr-1">
                              Available: ${CURRENT_USER.totalEarned.toLocaleString()}
                           </div>
                        )}
                     </div>

                     {/* 2FA Code */}
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-1.5">
                           <Smartphone size={12} /> 2FA Code
                        </label>
                        <input
                           type="text"
                           inputMode="numeric"
                           placeholder="000 000"
                           maxLength={6}
                           value={withdrawForm.twoFactor}
                           onChange={handleTwoFactorChange}
                           className="w-full bg-surface border border-white/10 rounded-xl p-4 text-sm text-white focus:border-primary focus:outline-none placeholder:text-text-secondary/50 font-mono text-center tracking-widest"
                        />
                     </div>

                     {/* Authorization PIN */}
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-1.5">
                           <Lock size={12} /> Email Authorization PIN
                        </label>
                        <div className="relative">
                           <input
                              type="text"
                              inputMode="numeric"
                              placeholder="Enter PIN"
                              value={withdrawForm.pin}
                              onChange={handlePinChange}
                              className="w-full bg-surface border border-white/10 rounded-xl p-4 pr-32 text-sm text-white focus:border-primary focus:outline-none placeholder:text-text-secondary/50 font-mono"
                           />
                           <button
                              type="button"
                              onClick={handleRequestPin}
                              className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-1 transition-colors ${pinRequested ? 'text-success' : 'text-primary hover:text-white'}`}
                           >
                              {pinRequested ? 'PIN Sent!' : 'Request PIN'}
                           </button>
                        </div>
                        <p className="text-[10px] text-text-secondary pl-1">
                           Check your registered email for the authorization PIN.
                        </p>
                     </div>

                     <div className="pt-4">
                        <Button
                           fullWidth
                           size="lg"
                           className="shadow-xl shadow-primary/20"
                           disabled={hasInsufficientFunds || !isFormComplete}
                        >
                           Complete Withdrawal
                        </Button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         {/* Withdrawal Success Popup */}
         {showSuccessModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"></div>
               <div className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-300 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20 relative">
                     <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin"></div>
                     <ArrowUpRight size={24} className="text-primary" />
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">Withdrawal in Progress</h3>
                  <p className="text-text-secondary text-sm leading-relaxed mb-6">
                     Your request has been initiated on the blockchain. Funds will arrive in your wallet shortly.
                  </p>

                  <Button
                     fullWidth
                     onClick={() => setShowSuccessModal(false)}
                     className="shadow-lg shadow-primary/20"
                  >
                     Done
                  </Button>
               </div>
            </div>
         )}

         {/* Transaction Detail Modal */}
         {selectedTransaction && (
            <div className="fixed inset-0 z-[60] flex items-end justify-center">
               {/* Backdrop */}
               <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                  onClick={() => setSelectedTransaction(null)}
               ></div>

               {/* Sheet */}
               <div className="relative w-full max-w-lg bg-[#111] border-t border-white/10 rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
                  <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6"></div>

                  <div className="flex flex-col items-center mb-6">
                     <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-white/10 ${selectedTransaction.status === 'Failed' ? 'bg-error/10 text-error' :
                           selectedTransaction.status === 'Pending' ? 'bg-warning/10 text-warning' :
                              'bg-blue-500/10 text-blue-400'
                        }`}>
                        {getStatusIcon(selectedTransaction.status)}
                     </div>
                     <div className="text-2xl font-bold text-white mb-1">
                        {selectedTransaction.type === 'Earning' ? '+' : '-'}${selectedTransaction.amount.toLocaleString()} USDC
                     </div>
                     <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(selectedTransaction.status)}`}>
                        {selectedTransaction.status}
                     </div>
                  </div>

                  <div className="space-y-3 bg-surface border border-white/5 rounded-2xl p-4 mb-6">
                     <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-sm text-text-secondary">Type</span>
                        <span className="text-sm font-medium text-white">{selectedTransaction.type}</span>
                     </div>
                     <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-sm text-text-secondary">Date</span>
                        <span className="text-sm font-medium text-white">{selectedTransaction.date}</span>
                     </div>
                     <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-sm text-text-secondary">Reference ID</span>
                        <span className="text-sm font-mono text-text-secondary">#{selectedTransaction.id.toUpperCase().padStart(8, '0')}</span>
                     </div>
                     <div className="flex justify-between py-2">
                        <span className="text-sm text-text-secondary">Network</span>
                        <span className="text-sm font-medium text-white">Solana Mainnet</span>
                     </div>
                  </div>

                  <div className="space-y-3">
                     <p className="text-xs text-center text-text-secondary">
                        {selectedTransaction.description}
                     </p>

                     <Button
                        fullWidth
                        variant="outline"
                        className="border-white/10 hover:bg-white/5 text-white gap-2 h-12"
                        onClick={() => window.open(`https://solscan.io/tx/${selectedTransaction.id}`, '_blank')}
                     >
                        <Activity size={16} />
                        View on Blockchain Explorer
                        <ExternalLink size={14} className="opacity-50" />
                     </Button>

                     <Button
                        fullWidth
                        variant="ghost"
                        onClick={() => setSelectedTransaction(null)}
                     >
                        Close
                     </Button>
                  </div>
               </div>
            </div>
         )}

      </div>
   );
};