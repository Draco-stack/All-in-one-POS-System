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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={item.image}
              alt={item.name}
              className="w-12 h-12 rounded-xl object-cover border border-stone-800"
              referrerPolicy="no-referrer"
            />
            <div>
              <h3 className="text-base font-bold text-white leading-tight">{item.name}</h3>
              <p className="text-xs text-stone-400 font-mono">Base: ${item.price.toFixed(2)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {item.options && item.options.length > 0 ? (
            item.options.map((opt) => (
              <div key={opt.name} className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-300 flex items-center justify-between">
                  <span>{opt.name}</span>
                  <span className="text-[10px] text-amber-500 font-normal">Select one</span>
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
                        className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                          isSelected
                            ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                            : 'bg-stone-800/60 border-stone-700/60 text-stone-300 hover:bg-stone-800 hover:border-stone-600'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-semibold">{choiceLabel}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                        <span className="text-[11px] font-mono text-stone-400 mt-1">
                          {choiceExtraPrice > 0 ? `+$${choiceExtraPrice.toFixed(2)}` : 'Included'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-stone-400">No default modifiers defined for this dish.</p>
          )}

          {/* Kitchen / Special Instructions */}
          <div className="space-y-2 pt-2 border-t border-stone-800">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-300">
              Kitchen Notes / Custom Instructions
            </label>
            <input
              type="text"
              placeholder="e.g. Extra spicy, dressing on side, no ice, allergy alert"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2.5 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-400 block">Total Line Price</span>
            <span className="text-lg font-black text-amber-400 font-mono">${finalPrice.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-600/30 transition cursor-pointer"
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
