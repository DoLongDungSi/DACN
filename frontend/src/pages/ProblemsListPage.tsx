import React, { useMemo, useState, useRef } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import type { Problem, Tag, Difficulty } from '../types'; // Removed unused imports
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { PlusCircle, Search, SlidersHorizontal, Users, Star, Clock, Tag as TagIcon } from 'lucide-react';
import { FilterPopup } from '../components/Problem/FilterPopup';

const difficultyBadge: Record<string, string> = {
    easy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    hard: 'bg-rose-50 text-rose-700 border-rose-200',
};

const toPlainText = (content?: string | null) =>
    (content || '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

export const ProblemsListPage: React.FC = () => {
    const {
        problems,
        allTags,
        submissions,
        currentUser,
        setSelectedProblem,
        setEditingProblem,
        handleDeleteProblem,
        setViewingPost,
        loading,
        navigate,
    } = useAppContext();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFilterTags, setSelectedFilterTags] = useState<Tag[]>([]);
    const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>('all');
    
    // Filter Popup State
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterButtonRef = useRef<HTMLButtonElement>(null);

    const handleProblemClick = (problem: Problem) => {
        setSelectedProblem(problem);
        setViewingPost(null);
        navigate('problem-detail', problem.id);
    };

    const toggleTag = (tag: Tag) => {
        setSelectedFilterTags((prev) =>
            prev.some((t) => t.id === tag.id) ? prev.filter((t) => t.id !== tag.id) : [...prev, tag]
        );
    };

    const canCreate = currentUser?.role === 'owner' || currentUser?.role === 'creator';

    const filteredProblems = useMemo(() => {
        return problems
            .filter((problem) => {
                const nameMatch = problem.name.toLowerCase().includes(searchTerm.toLowerCase());
                const tagMatch = selectedFilterTags.length === 0 || selectedFilterTags.every((tag) => problem.tags.includes(tag.id));
                const difficultyOk = difficultyFilter === 'all' ? true : problem.difficulty === difficultyFilter;
                return nameMatch && tagMatch && difficultyOk;
            })
            .sort((a, b) => b.id - a.id);
    }, [problems, searchTerm, selectedFilterTags, difficultyFilter]);

    const tagMap = useMemo(() => Object.fromEntries(allTags.map((t) => [t.id, t.name])), [allTags]);

    const participantCountByProblem = useMemo(() => {
        const counts = new Map<number, number>();
        submissions.forEach(s => {
             if(!counts.has(s.problemId)) counts.set(s.problemId, 0);
             counts.set(s.problemId, counts.get(s.problemId)! + 1);
        });
        return counts;
    }, [submissions]);

    const activeFiltersCount = (difficultyFilter !== 'all' ? 1 : 0) + selectedFilterTags.length;

    return (
        <div className="animate-fade-in max-w-5xl mx-auto">
            {/* Header Section */}
            <div className="mb-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Cuộc thi & Bài toán</h1>
                        <p className="text-slate-500">Khám phá, tham gia và rèn luyện kỹ năng Machine Learning.</p>
                    </div>
                     {canCreate && (
                        <button
                            onClick={() => {
                                setEditingProblem('new');
                                navigate('problem-editor');
                            }}
                            className="btn-primary shadow-lg shadow-indigo-200 bg-slate-900 hover:bg-black border-transparent text-white"
                        >
                            <PlusCircle className="w-5 h-5" /> Tạo cuộc thi mới
                        </button>
                    )}
                </div>

                {/* Search and Filter Bar */}
                <div className="flex gap-3 relative z-10">
                    <div className="relative flex-1 group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-full text-sm shadow-sm placeholder-slate-400
                                     focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            placeholder="Tìm kiếm bài toán..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="relative">
                        <button
                            ref={filterButtonRef}
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`px-5 py-3 rounded-full font-semibold flex items-center gap-2 transition-all shadow-sm border text-sm ${
                                activeFiltersCount > 0 || isFilterOpen
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            <span className="hidden sm:inline">Bộ lọc</span>
                            {activeFiltersCount > 0 && (
                                <span className="ml-1 bg-white/20 text-white text-xs py-0.5 px-1.5 rounded-full">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </button>

                        {/* Filter Popup - Absolute positioned relative to button */}
                        <FilterPopup
                            isOpen={isFilterOpen}
                            onClose={() => setIsFilterOpen(false)}
                            allTags={allTags}
                            selectedTags={selectedFilterTags}
                            onToggleTag={toggleTag}
                            selectedDifficulty={difficultyFilter}
                            onSelectDifficulty={setDifficultyFilter}
                            onClearAll={() => {
                                setSelectedFilterTags([]);
                                setDifficultyFilter('all');
                            }}
                            anchorRef={filterButtonRef}
                        />
                    </div>
                </div>
            </div>

            {/* Problem List Grid */}
            {loading ? (
                 <div className="py-20 flex justify-center"><LoadingSpinner /></div>
            ) : filteredProblems.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                    <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <Search className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">Không tìm thấy kết quả</h3>
                    <p className="text-slate-500 mb-6">Thử thay đổi từ khóa hoặc bộ lọc của bạn.</p>
                    <button 
                        onClick={() => { setSearchTerm(''); setSelectedFilterTags([]); setDifficultyFilter('all'); }}
                        className="text-indigo-600 font-semibold hover:underline"
                    >
                        Xóa toàn bộ bộ lọc
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredProblems.map((problem) => (
                        <div
                            key={problem.id}
                            onClick={() => handleProblemClick(problem)}
                            className="group bg-white rounded-2xl border border-slate-200 p-1 hover:shadow-xl hover:border-indigo-200 transition-all duration-300 cursor-pointer flex flex-col sm:flex-row gap-4 overflow-hidden"
                        >
                            {/* Thumbnail */}
                            <div className="sm:w-48 h-32 bg-slate-100 rounded-xl overflow-hidden relative shrink-0">
                                {problem.coverImageUrl ? (
                                    <img 
                                        src={problem.coverImageUrl} 
                                        alt={problem.name} 
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 bg-slate-50">
                                        <TagIcon className="w-8 h-8 mb-1 opacity-50" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">No Cover</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 py-2 pr-4 pl-2 flex flex-col">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-1" title={problem.name}>
                                        {problem.name}
                                    </h3>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border tracking-wide ${difficultyBadge[problem.difficulty]}`}>
                                        {problem.difficulty}
                                    </span>
                                </div>
                                
                                <p className="text-sm text-slate-500 line-clamp-2 mb-3 flex-1">
                                    {problem.summary || toPlainText(problem.content).slice(0, 150)}
                                </p>

                                <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                                    <div className="flex gap-2">
                                        {problem.tags.slice(0, 3).map(tagId => {
                                            const tag = tagMap[tagId];
                                            return tag ? (
                                                <span key={tagId} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium border border-slate-200">
                                                    {tag}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                                        <div className="flex items-center gap-1">
                                            <Users className="w-3.5 h-3.5" />
                                            <span>{participantCountByProblem.get(problem.id) || 0} tham gia</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>Ongoing</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};