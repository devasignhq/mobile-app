import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, Bell, ArrowRight } from 'lucide-react';
import { MOCK_BOUNTIES, CURRENT_USER } from '../mockData';
import { Bounty } from '../types';
import { useNotifications } from '../contexts/NotificationContext';
import { FilterSheet, FilterState } from '../components/FilterSheet';
import { theme } from '../styles/theme';

export const Explorer: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const { unreadCount } = useNotifications();

  // Advanced Filter State
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    categories: ['All'],
    minAmount: 0,
    maxAmount: 2000,
    difficulty: 'All',
    languages: []
  });



  // Helper to map categories to tags/properties for filtering
  const matchesCategory = (bounty: Bounty, categories: string[]) => {
    if (categories.includes('All')) return true;
    // Simple mapping logic
    const categoryMap: Record<string, string[]> = {
      'Frontend': ['React', 'CSS', 'JavaScript', 'TypeScript', 'Tailwind'],
      'Backend': ['Node.js', 'Rust', 'Go', 'Python', 'C++'],
      'Security': ['Smart Contract', 'Audit'],
      'Mobile': ['React Native', 'Swift', 'Kotlin'],
      'DevOps': ['Docker', 'AWS', 'Networking', 'Documentation']
    };

    return categories.some(cat => {
      const relatedTags = categoryMap[cat] || [];
      return bounty.tags.some(tag => relatedTags.includes(tag) || relatedTags.some(rt => bounty.title.includes(rt)));
    });
  };

  // Filter bounties based on all criteria
  const filteredBounties = MOCK_BOUNTIES.filter(b => {
    // 1. Text Search
    const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;

    // 2. Quick Filters (Removed)


    // 3. Advanced Filters
    if (b.amount < advancedFilters.minAmount) return false;
    if (advancedFilters.maxAmount < 2000 && b.amount > advancedFilters.maxAmount) return false;
    if (advancedFilters.difficulty !== 'All' && b.difficulty !== advancedFilters.difficulty) return false;

    if (advancedFilters.languages.length > 0) {
      const hasLang = advancedFilters.languages.some(lang => b.tags.includes(lang));
      if (!hasLang) return false;
    }

    if (!matchesCategory(b, advancedFilters.categories)) return false;

    return true;
  });

  const activeAdvancedCount =
    (advancedFilters.categories.includes('All') ? 0 : 1) +
    (advancedFilters.minAmount > 0 ? 1 : 0) +
    (advancedFilters.maxAmount < 2000 ? 1 : 0) +
    (advancedFilters.difficulty !== 'All' ? 1 : 0) +
    advancedFilters.languages.length;

  const totalBountyValue = MOCK_BOUNTIES.reduce((acc, b) => acc + b.amount, 0);

  return (
    <div className="min-h-full bg-background text-white pb-24">

      {/* 1. Top Header (Scrolls away) */}
      <div className="px-5 pt-6 pb-4">
        <div className={theme.layout.rowBetween}>
          <div className={theme.layout.rowCenter + " gap-3"}>
            <div className="relative">
              <img
                src={CURRENT_USER.avatarUrl}
                alt="User"
                className="w-10 h-10 rounded-full border border-white/10 object-cover"
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background"></div>
            </div>
            <div>
              <div className="text-xs text-text-secondary leading-none mb-1">Welcome back,</div>
              <div className="font-bold text-sm text-white leading-none">{CURRENT_USER.username}</div>
            </div>
          </div>
          <button
            onClick={() => navigate('/notifications')}
            className="w-10 h-10 flex items-center justify-center bg-surface rounded-full border border-white/5 text-white hover:bg-white/5 transition-colors relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-primary rounded-full border border-surface"></span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Sticky Search Bar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md px-5 pb-4 pt-2 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.5)]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${theme.components.input} pl-11`}
            placeholder="Search by bounty, language, or ID..."
          />
          <button
            onClick={() => setIsFilterSheetOpen(true)}
            className={`
              absolute right-3 top-1/2 -translate-y-1/2 p-1.5 transition-colors rounded-lg
              ${activeAdvancedCount > 0 ? 'text-primary bg-primary/10' : 'text-text-secondary hover:text-white'}
            `}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* 3. Main Content */}
      <div className="px-5">

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 mb-8 pt-2">
          <div className="bg-surface border border-white/5 rounded-2xl p-4 relative overflow-hidden">
            <div className={theme.typography.captionLabel + " mb-1.5"}>bounty value</div>
            <div className="text-xl font-bold text-white tracking-tight">${totalBountyValue.toLocaleString()} <span className="text-xs font-medium text-text-secondary">USDC</span></div>
          </div>
          <div className="bg-surface border border-white/5 rounded-2xl p-4 relative overflow-hidden">
            <div className={theme.typography.captionLabel + " mb-1.5"}>open bounties</div>
            <div className="flex items-baseline gap-2">
              <div className="text-xl font-bold text-white tracking-tight">{MOCK_BOUNTIES.length}</div>
              <div className="text-xs font-bold text-green-500">+2 new</div>
            </div>
          </div>
        </div>



        {/* Bounty List */}
        <div className="space-y-4">
          <div className={theme.layout.rowBetween + " mb-4"}>
            <h3 className={theme.typography.captionLabel}>Available Bounties</h3>
            {filteredBounties.length !== MOCK_BOUNTIES.length && (
              <span className="text-xs text-primary font-medium">{filteredBounties.length} found</span>
            )}
          </div>

          <div className="space-y-4">
            {filteredBounties.length > 0 ? (
              filteredBounties.map((bounty, index) => (
                <BountyListItem key={bounty.id} bounty={bounty} index={index} onClick={() => navigate(`/bounty/${bounty.id}`)} />
              ))
            ) : (
              <div className="py-12 text-center text-text-secondary bg-surface/30 rounded-2xl border border-white/5 border-dashed">
                <p>No bounties match your filters.</p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setAdvancedFilters({
                      categories: ['All'],
                      minAmount: 0,
                      maxAmount: 2000,
                      difficulty: 'All',
                      languages: []
                    });
                  }}
                  className={theme.typography.link + " text-sm mt-2"}
                >
                  Clear all filters
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      <FilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        onApply={setAdvancedFilters}
        currentFilters={advancedFilters}
      />
    </div>
  );
};

const BountyListItem: React.FC<{ bounty: Bounty; index: number; onClick: () => void }> = ({ bounty, index, onClick }) => {
  const isCritical = index === 0;
  const isFeature = index === 2;

  const badgeStyle = isCritical
    ? "bg-red-500/20 text-red-400 border-red-500/20"
    : isFeature
      ? "bg-blue-500/20 text-blue-400 border-blue-500/20"
      : "bg-purple-500/20 text-purple-400 border-purple-500/20";

  const badgeText = isCritical ? "CRITICAL" : isFeature ? "FEATURE" : "FRONTEND";

  return (
    <div onClick={onClick} className={theme.components.cardHover}>
      {/* Content Wrapper */}
      <div className="flex flex-col gap-1">

        {/* Content */}
        <div className="w-full flex flex-col justify-between">
          {/* Top Row */}
          <div className={theme.layout.rowBetween + " mb-2"}>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${badgeStyle}`}>
              {badgeText}
            </span>
            <span className={theme.typography.mono + " text-text-secondary"}>#BT-429{index + 1}</span>
          </div>

          {/* Title & Desc */}
          <div className="space-y-1">
            <h4 className="font-bold text-white text-base leading-tight truncate">{bounty.title}</h4>
            <p className={theme.typography.body + " text-xs line-clamp-2"}>
              {bounty.description}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Row */}
      <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5">
        <div className="space-y-0.5">
          <div className={theme.typography.captionLabel}>Bounty</div>
          <div className="text-lg font-bold text-primary">
            ${bounty.amount.toLocaleString()} <span className="text-xs font-medium text-primary/60">USDC</span>
          </div>
        </div>

        <button className="bg-transparent border border-white/20 text-white hover:bg-white/5 text-sm font-medium px-5 py-2 rounded-lg flex items-center gap-1 transition-colors">
          Apply <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};