import React, { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // [THÊM] Import useNavigate chuẩn
import { useAppContext } from '../hooks/useAppContext';
import type { Problem, Tag, Difficulty } from '../types';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { PlusCircle, Search, SlidersHorizontal, Users, Clock, Tag as TagIcon, Trophy } from 'lucide-react';
import { FilterPopup } from '../components/Problem/FilterPopup';

const difficultyBadge: Record<string, string> = {
    easy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    hard: 'bg-rose-50 text-rose-700 border-rose-200',
};

const toPlainText = (content?: string | null) => (content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export const ProblemsListPage: React.FC = () => {
    // Vẫn giữ navigate từ context cho các chức năng khác (như nút "Tổ chức cuộc thi")
    const { problems, allTags, submissions, currentUser, setSelectedProblem, setEditingProblem, loading, navigate: ctxNavigate } = useAppContext();
    
    // [THÊM] Sử dụng hook điều hướng chuẩn của React Router
    const routerNavigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFilterTags, setSelectedFilterTags] = useState<Tag[]>([]);
    const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>('all');
    
    // Filter Popup State
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterButtonRef = useRef<HTMLButtonElement>(null);

    const handleProblemClick = (problem: Problem) => {
        setSelectedProblem(problem);
        // [SỬA] Dùng routerNavigate để chuyển trang trực tiếp theo URL
        routerNavigate(`/problems/${problem.id}`);
    };

    const toggleTag = (tag: Tag) => {
        setSelectedFilterTags((prev) => prev.some((t) => t.id === tag.id) ? prev.filter((t) => t.id !== tag.id) : [...prev, tag]);
    };

    const canCreate = currentUser?.role === 'owner' || currentUser?.role === 'creator';

    const filteredProblems = useMemo(() => {
        return problems.filter((problem) => {
            const nameMatch = problem.name.toLowerCase().includes(searchTerm.toLowerCase());
            const tagMatch = selectedFilterTags.length === 0 || selectedFilterTags.every((tag) => problem.tags.includes(tag.id));
            const difficultyOk = difficultyFilter === 'all' ? true : problem.difficulty === difficultyFilter;
            return nameMatch && tagMatch && difficultyOk;
        }).sort((a, b) => b.id - a.id);
    }, [problems, searchTerm, selectedFilterTags, difficultyFilter]);

    const tagMap = useMemo(() => Object.fromEntries(allTags.map((t) => [t.id, t.name])), [allTags]);
    const participantCountByProblem = useMemo(() => {
        const userSets = new Map<number, Set<number>>();
        submissions.forEach((sub) => { if (!userSets.has(sub.problemId)) userSets.set(sub.problemId, new Set()); userSets.get(sub.problemId)!.add(sub.userId); });
        const counts = new Map<number, number>();
        userSets.forEach((set, id) => counts.set(id, set.size));
        return counts;
    }, [submissions]);

    const activeFiltersCount = (difficultyFilter !== 'all' ? 1 : 0) + selectedFilterTags.length;

    const ProblemCard = ({ problem }: { problem: Problem }) => {
        const problemTags = (problem.tags || []).map((tagId) => tagMap[tagId]).filter(Boolean).slice(0, 4);
        const cover = problem.coverImageUrl;
        const participants = participantCountByProblem.get(problem.id) || 0;
        const summaryText = problem.summary || toPlainText(problem.content).slice(0, 120) + '...' || 'Chưa có mô tả.';

        return (
            <div onClick={() => handleProblemClick(problem)} className="group flex flex-col h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer">
                <div className="relative h-48 bg-slate-100 overflow-hidden">
                    {cover ? (
                        <img src={cover} alt={problem.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                            <Trophy className="w-12 h-12 mb-2 opacity-50" />
                            <span className="text-xs font-bold uppercase tracking-widest">No Cover</span>
                        </div>
                    )}
                    <div className="absolute top-3 right-3 flex gap-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase border shadow-sm bg-white/90 backdrop-blur-sm ${difficultyBadge[problem.difficulty]}`}>
                            {problem.difficulty}
                        </span>
                    </div>
                </div>
                <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-bold text-slate-900 line-clamp-2 mb-2 group-hover:text-indigo-600 transition-colors">{problem.name}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">{summaryText}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                        {problemTags.map((tag) => (
                            <span key={tag} className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md bg-slate-100 text-slate-600">
                                {tag}
                            </span>
                        ))}
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                            <div className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {participants} đội thi</div>
                            <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> Đang diễn ra</div>
                        </div>
                        {problem.prizes && <div className="flex items-center gap-1 text-xs font-bold text-amber-600"><Trophy className="w-3 h-3"/> Có thưởng</div>}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

    return (
        <div className="bg-slate-50 pb-20">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Tất cả cuộc thi</h1>
                        <p className="text-slate-500">Khám phá và tham gia các thử thách Machine Learning hấp dẫn.</p>
                    </div>
                    {canCreate && (
                        // Vẫn dùng ctxNavigate (custom) để điều hướng tới editor, vì logic này trong AppContext xử lý ổn cho các trang không cần tham số ID động phức tạp
                        <button onClick={() => { setEditingProblem('new'); ctxNavigate('problem-editor'); }} className="btn-primary shadow-lg shadow-indigo-200">
                            <PlusCircle className="w-5 h-5" /> Tổ chức cuộc thi
                        </button>
                    )}
                </div>

                {/* Search & Filter */}
                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm kiếm cuộc thi..." className="w-full pl-12 pr-4 py-3 rounded-xl bg-transparent outline-none text-sm font-medium" />
                    </div>
                    <div className="relative">
                        <button
                            ref={filterButtonRef}
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-sm border text-sm ${
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
                        <FilterPopup
                            isOpen={isFilterOpen}
                            onClose={() => setIsFilterOpen(false)}
                            allTags={allTags}
                            selectedTags={selectedFilterTags}
                            onToggleTag={toggleTag}
                            selectedDifficulty={difficultyFilter}
                            onSelectDifficulty={setDifficultyFilter}
                            onClearAll={() => { setSelectedFilterTags([]); setDifficultyFilter('all'); }}
                            anchorRef={filterButtonRef}
                        />
                    </div>
                </div>

                {filteredProblems.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                        <Search className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-bold text-slate-700">Không tìm thấy cuộc thi nào</h3>
                        <p className="text-slate-500">Thử thay đổi bộ lọc hoặc tìm kiếm từ khóa khác.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredProblems.map(p => <ProblemCard key={p.id} problem={p} />)}
                    </div>
                )}
            </div>
        </div>
    );
};