import React, { useRef, useEffect } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import type { Tag, Difficulty, ProblemType } from '../../types';

interface FilterPopupProps {
    isOpen: boolean;
    onClose: () => void;
    allTags: Tag[];
    selectedTags: Tag[];
    onToggleTag: (tag: Tag) => void;
    selectedDifficulty: Difficulty | 'all';
    onSelectDifficulty: (diff: Difficulty | 'all') => void;
    onClearAll: () => void;
    anchorRef: React.RefObject<HTMLButtonElement>;
}

export const FilterPopup: React.FC<FilterPopupProps> = ({
    isOpen, onClose, allTags, selectedTags, onToggleTag, 
    selectedDifficulty, onSelectDifficulty, onClearAll, anchorRef
}) => {
    const popupRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                popupRef.current && 
                !popupRef.current.contains(event.target as Node) &&
                anchorRef.current &&
                !anchorRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, anchorRef]);

    if (!isOpen) return null;

    return (
        <div 
            ref={popupRef}
            className="absolute z-50 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 animate-fade-in origin-top-right"
            style={{ 
                top: '100%', 
                right: 0 
            }}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm">Bộ lọc</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar space-y-5">
                {/* Difficulty */}
                <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Độ khó</h4>
                    <div className="flex flex-wrap gap-2">
                        {(['all', 'easy', 'medium', 'hard'] as const).map((diff) => (
                            <button
                                key={diff}
                                onClick={() => onSelectDifficulty(diff)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                    selectedDifficulty === diff
                                        ? 'bg-slate-800 text-white border-slate-800'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                {diff === 'all' ? 'Tất cả' : diff.charAt(0).toUpperCase() + diff.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tags */}
                <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                        {allTags.map(tag => {
                            const isSelected = selectedTags.some(t => t.id === tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    onClick={() => onToggleTag(tag)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all border ${
                                        isSelected
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {isSelected && <Check className="w-3 h-3" />}
                                    {tag.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl flex justify-between items-center">
                <button
                    onClick={onClearAll}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1"
                >
                    <RotateCcw className="w-3 h-3" /> Xóa lọc
                </button>
                <button
                    onClick={onClose}
                    className="px-4 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all shadow-sm"
                >
                    Áp dụng
                </button>
            </div>
        </div>
    );
};