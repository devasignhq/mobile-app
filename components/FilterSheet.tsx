import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { Button } from './Shared';

export interface FilterState {
  categories: string[];
  minAmount: number;
  maxAmount: number;
  difficulty: string;
  languages: string[];
}

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  currentFilters: FilterState;
}

const CATEGORIES = ['All', 'Frontend', 'Backend', 'Security', 'Mobile', 'DevOps'];
const LANGUAGES = ['Rust', 'TypeScript', 'Solidity', 'React', 'Python', 'Go', 'C++'];
const DIFFICULTIES = ['Easy', 'Intermediate', 'Advanced'];

const LANGUAGE_LOGOS: Record<string, string> = {
  'Rust': 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Rust_programming_language_black_logo.svg',
  'TypeScript': 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg',
  'Solidity': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Solidity_logo.svg',
  'React': 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg',
  'Python': 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Python-logo-notext.svg',
  'Go': 'https://upload.wikimedia.org/wikipedia/commons/0/05/Go_Logo_Blue.svg',
  'C++': 'https://upload.wikimedia.org/wikipedia/commons/1/18/ISO_C%2B%2B_Logo.svg'
};

export const FilterSheet: React.FC<FilterSheetProps> = ({ isOpen, onClose, onApply, currentFilters }) => {
  const [filters, setFilters] = useState<FilterState>(currentFilters);

  // Sync state when opening
  useEffect(() => {
    if (isOpen) {
      setFilters(currentFilters);
    }
  }, [isOpen, currentFilters]);

  const toggleCategory = (cat: string) => {
    if (cat === 'All') {
      setFilters(prev => ({ ...prev, categories: ['All'] }));
      return;
    }
    
    setFilters(prev => {
      const newCats = prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories.filter(c => c !== 'All'), cat];
      
      return {
        ...prev,
        categories: newCats.length === 0 ? ['All'] : newCats
      };
    });
  };

  const toggleLanguage = (lang: string) => {
    setFilters(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang]
    }));
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(Number(e.target.value), filters.maxAmount - 100);
    setFilters(prev => ({ ...prev, minAmount: val }));
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(Number(e.target.value), filters.minAmount + 100);
    setFilters(prev => ({ ...prev, maxAmount: val }));
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleClear = () => {
    setFilters({
      categories: ['All'],
      minAmount: 0,
      maxAmount: 2000,
      difficulty: 'All',
      languages: []
    });
  };

  if (!isOpen) return null;

  const minPercent = (filters.minAmount / 2000) * 100;
  const maxPercent = (filters.maxAmount / 2000) * 100;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      ></div>
      
      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-[#111] border-t border-white/10 rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
        
        {/* Scrollable Content */}
        <div className="overflow-y-auto hide-scrollbar flex-1 p-6 pb-4">
          {/* Handle */}
          <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0"></div>

          <div className="space-y-8">
            
            {/* Categories */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => {
                  const isSelected = filters.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`
                        px-4 py-2 rounded-full text-sm font-medium transition-all border
                        ${isSelected 
                          ? 'bg-primary/10 border-primary text-primary font-bold shadow-[0_0_15px_-5px_rgba(254,137,31,0.2)]' 
                          : 'bg-surface border-white/10 text-text-secondary hover:border-white/20 hover:text-white'
                        }
                      `}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount Slider */}
            <div className="space-y-6">
               <div className="flex justify-between items-end">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Bounty Amount (USDC)</h3>
                  <div className="text-primary font-mono font-bold">
                    {filters.minAmount.toLocaleString()} - {filters.maxAmount >= 2000 ? '2,000+' : filters.maxAmount.toLocaleString()}
                  </div>
               </div>
               
               <div className="relative h-6 flex items-center select-none group">
                  {/* Styles for range inputs */}
                  <style>{`
                    .range-input::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      pointer-events: auto;
                      width: 24px;
                      height: 24px;
                      border-radius: 50%;
                      background: white;
                      border: 4px solid #FE891F;
                      cursor: pointer;
                      box-shadow: 0 0 10px rgba(0,0,0,0.3);
                      transition: transform 0.1s;
                    }
                    .range-input::-webkit-slider-thumb:hover {
                      transform: scale(1.1);
                    }
                    .range-input::-moz-range-thumb {
                      pointer-events: auto;
                      width: 24px;
                      height: 24px;
                      border-radius: 50%;
                      background: white;
                      border: 4px solid #FE891F;
                      cursor: pointer;
                      box-shadow: 0 0 10px rgba(0,0,0,0.3);
                      transition: transform 0.1s;
                    }
                    .range-input::-moz-range-thumb:hover {
                      transform: scale(1.1);
                    }
                  `}</style>

                  {/* Track Background */}
                  <div className="absolute w-full h-1.5 bg-surface rounded-full overflow-hidden">
                     {/* Active Track */}
                     <div 
                       className="absolute h-full bg-primary" 
                       style={{ 
                         left: `${minPercent}%`, 
                         width: `${maxPercent - minPercent}%` 
                       }}
                     ></div>
                  </div>

                  {/* Min Input */}
                  <input 
                    type="range" 
                    min="0" 
                    max="2000" 
                    step="50"
                    value={filters.minAmount}
                    onChange={handleMinChange}
                    className="range-input absolute w-full h-0 appearance-none bg-transparent pointer-events-none z-30 outline-none"
                    style={{ zIndex: filters.minAmount > 1800 ? 50 : 30 }}
                  />

                  {/* Max Input */}
                  <input 
                    type="range" 
                    min="0" 
                    max="2000" 
                    step="50"
                    value={filters.maxAmount}
                    onChange={handleMaxChange}
                    className="range-input absolute w-full h-0 appearance-none bg-transparent pointer-events-none z-40 outline-none"
                  />
               </div>
               
               <div className="flex justify-between text-[10px] text-text-secondary font-mono">
                  <span>0 USDC</span>
                  <span>1k</span>
                  <span>2k+</span>
               </div>
            </div>

            {/* Difficulty */}
            <div className="space-y-3">
               <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Difficulty Level</h3>
               <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map(diff => {
                     const isSelected = filters.difficulty === diff;
                     return (
                        <button
                          key={diff}
                          onClick={() => setFilters(prev => ({ ...prev, difficulty: isSelected ? 'All' : diff }))}
                          className={`
                            px-4 py-2 rounded-full text-sm font-medium transition-all border
                            ${isSelected 
                              ? 'bg-primary/10 border-primary text-primary font-bold shadow-[0_0_15px_-5px_rgba(254,137,31,0.2)]' 
                              : 'bg-surface border-white/10 text-text-secondary hover:border-white/20 hover:text-white'
                            }
                          `}
                        >
                           {diff}
                        </button>
                     );
                  })}
               </div>
            </div>

            {/* Programming Languages */}
            <div className="space-y-3">
               <div className="flex justify-between items-center">
                 <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Programming Languages</h3>
                 <span className="text-[10px] text-text-secondary italic">Select multiple</span>
               </div>
               
               <div className="space-y-2">
                  {LANGUAGES.map(lang => {
                     const isSelected = filters.languages.includes(lang);
                     return (
                        <div 
                          key={lang} 
                          onClick={() => toggleLanguage(lang)}
                          className={`
                            flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.99]
                            ${isSelected 
                              ? 'bg-surface border-primary/50 shadow-[0_0_15px_-5px_rgba(254,137,31,0.2)]' 
                              : 'bg-surface/50 border-white/5 hover:border-white/10'
                            }
                          `}
                        >
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#111] border border-white/10 p-1.5 overflow-hidden shrink-0">
                                 <img 
                                    src={LANGUAGE_LOGOS[lang]} 
                                    alt={lang} 
                                    className={`w-full h-full object-contain ${['Rust', 'Solidity'].includes(lang) ? 'invert' : ''}`}
                                 />
                              </div>
                              <span className={`font-medium ${isSelected ? 'text-white' : 'text-text-secondary'}`}>{lang}</span>
                           </div>
                           
                           <div className={`
                              w-5 h-5 rounded flex items-center justify-center transition-colors border
                              ${isSelected ? 'bg-primary border-primary' : 'border-white/20 bg-transparent'}
                           `}>
                              {isSelected && <Check size={14} className="text-black" strokeWidth={3} />}
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>
          </div>
        </div>

        {/* Sticky Action Buttons */}
        <div className="flex items-center gap-4 p-6 pt-4 border-t border-white/5 bg-[#111] mt-auto pb-8 md:pb-6">
           <Button 
             variant="secondary"
             className="flex-1"
             onClick={handleClear}
           >
              Clear
           </Button>
           <Button 
             className="flex-1 shadow-xl shadow-primary/20"
             onClick={handleApply}
           >
              Apply
           </Button>
        </div>

      </div>
    </div>
  );
};