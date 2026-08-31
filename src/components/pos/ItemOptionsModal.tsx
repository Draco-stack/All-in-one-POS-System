import React from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { MenuItem, MenuItemOption } from '../../types';
import { X, Plus, Check } from 'lucide-react';

interface ItemOptionsModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (customization: string, options: { optionName: string; choice: string; extraPrice: number }[]) => void;
}

export const ItemOptionsModal: React.FC<ItemOptionsModalProps> = ({ item, onClose, onConfirm }) => {
  const [selectedChoices, setSelectedChoices] = React.useState<Record<string, { choice: string; extraPrice: number }>>({});
  const [specialInstructions, setSpecialInstructions] = React.useState('');

  React.useEffect(() => {
    if (item && item.options) {
      const defaults: Record<string, { choice: string; extraPrice: number }> = {};
      item.options.forEach((opt: any) => {
        if (opt.choices && opt.choices.length > 0) {
          const firstChoice = opt.choices[0];
          defaults[opt.name] = {
            choice: firstChoice.label || firstChoice.name || '',
            extraPrice: firstChoice.extraPrice ?? firstChoice.price ?? 0,
          };
        }
      });
      setSelectedChoices(defaults);
    } else {
      setSelectedChoices({});
    }
    setSpecialInstructions('');
  }, [item]);

  if (!item) return null;

  const handleSelectChoice = (optionName: string, choiceLabel: string, extraPrice: number) => {
    setSelectedChoices((prev) => ({
      ...prev,
      [optionName]: { choice: choiceLabel, extraPrice },
    }));
  };

  const extraTotal = (Object.values(selectedChoices) as { choice: string; extraPrice: number }[]).reduce(
    (acc, curr) => acc + curr.extraPrice,
    0
  );
  const finalPrice = item.price + extraTotal;

  const handleAdd = () => {
    const formattedOptions = (Object.entries(selectedChoices) as [string, { choice: string; extraPrice: number }][]).map(
      ([optName, data]) => ({
        optionName: optName,
        choice: data.choice,
        extraPrice: data.extraPrice,
      })
    );

    onConfirm(specialInstructions.trim(), formattedOptions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-white/10 ring-1 ring-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-stone-950/60 backdrop-blur-xs border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={item.image}
              alt={item.name}
              className="w-12 h-12 rounded-xl object-cover border border-white/10 shadow-sm"
              referrerPolicy="no-referrer"
            />
            <div>
              <h3 className="text-base font-extrabold text-white leading-tight">{item.name}</h3>
              <p className="text-xs text-stone-400 font-mono font-bold">Base: PKR {item.price.toFixed(0)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/5 text-stone-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {item.options && item.options.length > 0 ? (
            item.options.map((opt) => (
              <div key={opt.name} className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-300 flex items-center justify-between">
                  <span>{opt.name}</span>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase">Select one</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(opt as any).choices?.map((choice: any) => {
                    const choiceLabel = choice.label || choice.name || '';
                    const choiceExtraPrice = choice.extraPrice ?? choice.price ?? 0;
                    const isSelected = selectedChoices[opt.name]?.choice === choiceLabel;
                    return (
                      <button
                        key={choiceLabel}
                        type="button"
                        onClick={() => handleSelectChoice(opt.name, choiceLabel, choiceExtraPrice)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30'
                            : 'bg-stone-900 border-white/5 text-stone-300 hover:bg-stone-800 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold">{choiceLabel}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <span className="text-[10px] font-mono text-stone-400 font-bold mt-1.5">
                          {choiceExtraPrice > 0 ? `+PKR ${choiceExtraPrice.toFixed(0)}` : 'Included'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-stone-500">No default modifiers defined for this dish.</p>
          )}

          {/* Kitchen / Special Instructions */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-300">
              Kitchen Notes / Custom Instructions
            </label>
            <input
              type="text"
              placeholder="e.g. Extra spicy, dressing on side, no ice, allergy alert"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="w-full bg-stone-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-950/60 border-t border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Total Line Price</span>
            <span className="text-lg font-black text-emerald-400 font-mono">PKR {finalPrice.toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 border border-white/5 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg border border-emerald-400/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Order</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
