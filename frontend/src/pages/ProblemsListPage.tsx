import React, { useState, useMemo } from 'react'; // Added useState, useMemo
import { Edit2, Trash2, PlusCircle, Search, Tag as TagIcon, X } from 'lucide-react'; // Added Search, TagIcon, X
import { useAppContext } from '../hooks/useAppContext';
import { Problem, Tag } from '../types'; // Added Tag type
import { LoadingSpinner } from '../components/Common/LoadingSpinner';

export const ProblemsListPage: React.FC = () => {
    const {
        problems,
        allTags,
        currentUser,
        setPage,
        setSelectedProblem,
        setEditingProblem,
        handleDeleteProblem,
        setViewingPost,
        loading,
    } = useAppContext();

    // --- State for Filtering ---
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFilterTags, setSelectedFilterTags] = useState<Tag[]>([]);
    const [tagSearch, setTagSearch] = useState(''); // For tag filter input
    const [showTagFilterDropdown, setShowTagFilterDropdown] = useState(false);

    const handleProblemClick = (problem: Problem) => {
         setSelectedProblem(problem);
         setPage("problem-detail");
         setViewingPost(null);
     }

     const handleEditClick = (e: React.MouseEvent, problem: Problem) => {
         e.stopPropagation();
         if (currentUser?.role === 'owner' || problem.authorId === currentUser?.id) {
             setEditingProblem(problem);
             setPage("problem-editor");
         } else {
             console.warn("User not authorized to edit this problem.");
         }
     };

     const handleDeleteClick = (e: React.MouseEvent, id: number, authorId: number | undefined) => {
         e.stopPropagation();
         if (currentUser?.role === 'owner' || authorId === currentUser?.id) {
             handleDeleteProblem(id);
         } else {
              console.warn("User not authorized to delete this problem.");
         }
     };

     const getDifficultyClass = (difficulty: string) => {
        switch (difficulty) {
            case 'easy': return 'bg-green-100 text-green-800 border-green-200';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'hard': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    const canCreate = currentUser?.role === 'owner' || currentUser?.role === 'creator';

    // --- Filtering Logic ---
    const filteredProblems = useMemo(() => {
        return problems
            .filter(problem => {
                // Filter by search term (name)
                const nameMatch = problem.name.toLowerCase().includes(searchTerm.toLowerCase());
                // Filter by selected tags (must have ALL selected tags)
                const tagMatch = selectedFilterTags.every(filterTag =>
                    problem.tags.includes(filterTag.id)
                );
                return nameMatch && tagMatch;
            })
            .sort((a, b) => a.id - b.id); // Keep the sort
    }, [problems, searchTerm, selectedFilterTags]);

    // --- Tag Filter Handlers ---
    const handleAddFilterTag = (tag: Tag) => {
        if (!selectedFilterTags.some(t => t.id === tag.id)) {
            setSelectedFilterTags(prev => [...prev, tag]);
        }
        setTagSearch(''); // Clear search
        setShowTagFilterDropdown(false); // Hide dropdown
    };

    const handleRemoveFilterTag = (tagIdToRemove: number) => {
        setSelectedFilterTags(prev => prev.filter(tag => tag.id !== tagIdToRemove));
    };

     const availableFilterTags = useMemo(() => {
        if (!tagSearch) return allTags.filter(tag => !selectedFilterTags.some(st => st.id === tag.id));
        return allTags.filter(tag =>
            !selectedFilterTags.some(st => st.id === tag.id) &&
            tag.name.toLowerCase().includes(tagSearch.toLowerCase())
        );
    }, [tagSearch, allTags, selectedFilterTags]);


    return (
        <div>
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-slate-900">Danh sách bài toán</h1>
                {canCreate && (
                    <button
                        onClick={() => { setEditingProblem("new"); setPage('problem-editor'); }}
                        className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-2.5 px-5 rounded-lg flex items-center justify-center hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg text-sm flex-shrink-0" // Added flex-shrink-0
                        >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Tạo bài toán mới
                    </button>
                 )}
            </div>

            {/* --- Filter Bar --- */}
            <div className="mb-8 p-4 bg-white rounded-lg shadow border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
                {/* Search Input */}
                <div className="relative flex-grow w-full md:w-auto">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
                    </div>
                    <input
                        type="text"
                        placeholder="Tìm theo tên bài toán..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>

                 {/* Tag Filter */}
                 <div className="relative w-full md:w-72 flex-shrink-0">
                     <label className="sr-only">Lọc theo tags</label>
                     <div className="flex flex-wrap gap-1 items-center p-2 border border-slate-300 rounded-md min-h-[40px] bg-white cursor-text" onClick={() => setShowTagFilterDropdown(true)}>
                        {selectedFilterTags.map(tag => (
                             <span key={tag.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {tag.name}
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleRemoveFilterTag(tag.id); }}
                                    className="ml-1 p-0.5 rounded-full text-blue-600 hover:bg-blue-200 focus:outline-none"
                                    aria-label={`Remove ${tag.name} filter`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                         <input
                            type="text"
                            value={tagSearch}
                            onChange={(e) => { setTagSearch(e.target.value); setShowTagFilterDropdown(true); }}
                            onFocus={() => setShowTagFilterDropdown(true)}
                            placeholder={selectedFilterTags.length === 0 ? "Lọc theo tags..." : "+ Thêm tag lọc"}
                            className="flex-grow p-1 text-sm outline-none bg-transparent placeholder-slate-500"
                        />
                     </div>
                     {/* Tag Dropdown */}
                     {showTagFilterDropdown && (
                        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-300 rounded-md shadow-lg max-h-48 overflow-y-auto scrollbar-thin">
                             {availableFilterTags.length > 0 ? (
                                <ul>
                                    {availableFilterTags.map(tag => (
                                        <li key={tag.id}>
                                            <button
                                                type="button"
                                                onClick={() => handleAddFilterTag(tag)}
                                                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2"
                                            >
                                                <TagIcon className="w-3.5 h-3.5 text-slate-400"/>
                                                {tag.name}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="px-3 py-2 text-sm text-slate-500 italic">Không tìm thấy tag phù hợp.</p>
                            )}
                        </div>
                    )}
                    {/* Click outside detector for dropdown */}
                    {showTagFilterDropdown && <button type="button" onClick={() => setShowTagFilterDropdown(false)} tabIndex={-1} className="fixed inset-0 cursor-default -z-1"></button>}
                 </div>
            </div>


            {/* Loading State */}
            {loading && problems.length === 0 && ( /* Show loading only if problems haven't loaded yet */
                <div className="flex justify-center items-center py-10 text-slate-500">
                    <LoadingSpinner />
                    <span className="ml-2">Đang tải danh sách bài toán...</span>
                </div>
            )}

            {/* Empty State (after filtering) */}
            {!loading && filteredProblems.length === 0 && (
                <div className="text-center py-16 px-6 bg-white rounded-xl shadow border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Không tìm thấy bài toán</h3>
                     <p className="text-slate-500 mb-4">
                        {problems.length === 0 ? 'Hiện tại chưa có bài toán nào được tạo.' : 'Không có bài toán nào khớp với bộ lọc của bạn.'}
                    </p>
                    {/* Keep the create button for the absolute empty state */}
                    {problems.length === 0 && canCreate && (
                         <button
                            onClick={() => { setEditingProblem("new"); setPage('problem-editor'); }}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg text-sm mx-auto"
                            >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Tạo bài toán đầu tiên
                        </button>
                    )}
                </div>
            )}

            {/* Problem List Grid - Now uses filteredProblems */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {filteredProblems.map((problem) => { // Use filteredProblems
                    const canEditDelete = currentUser && (currentUser.role === "owner" || problem.authorId === currentUser.id);
                    const problemTags = problem.tags
                        .map((tagId) => allTags.find((t) => t.id === tagId)?.name)
                        .filter(Boolean);

                    return (
                        <div
                            key={problem.id}
                            className="bg-white rounded-xl shadow-md p-6 flex flex-col justify-between border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ease-in-out cursor-pointer group focus-within:ring-2 focus-within:ring-indigo-400 focus-within:ring-offset-2"
                            onClick={() => handleProblemClick(problem)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleProblemClick(problem);}}
                        >
                            {/* Card Content... (no changes needed inside the card) */}
                             <div>
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="text-lg font-semibold text-slate-800 break-words pr-2 group-hover:text-indigo-600 transition-colors duration-200 ease-in-out">
                                         {problem.name}
                                    </h3>
                                     {canEditDelete && (
                                        <div className="flex space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 ease-in-out">
                                            <button
                                                 onClick={(e) => handleEditClick(e, problem)}
                                                className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 z-10"
                                                aria-label={`Edit ${problem.name}`}
                                                title="Chỉnh sửa"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                             <button
                                                  onClick={(e) => handleDeleteClick(e, problem.id, problem.authorId)}
                                                className="text-slate-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 z-10"
                                                aria-label={`Delete ${problem.name}`}
                                                 title="Xóa"
                                             >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center flex-wrap gap-2 mb-4">
                                    <span
                                         className={`px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-wider ${getDifficultyClass(problem.difficulty)}`}
                                    >
                                        {problem.difficulty}
                                    </span>
                                    <span className="px-3 py-1 rounded-full border text-xs font-medium bg-slate-100 text-slate-700 border-slate-200 capitalize">
                                        {problem.problemType}
                                    </span>
                                </div>
                                 {problemTags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-4 max-h-12 overflow-hidden">
                                        {problemTags.map((tag) => (
                                            <span key={tag} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <p className="text-slate-600 text-sm line-clamp-3 leading-relaxed">
                                     {problem.content ? problem.content.replace(/<[^>]*>/g, '').substring(0, 150) + (problem.content.length > 150 ? '...' : '') : <span className="italic">Không có mô tả.</span>}
                                </p>
                            </div>
                             <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                                <p className="text-xs text-slate-500">
                                     Tạo bởi: <strong className="text-slate-600">{problem.authorUsername || 'N/A'}</strong>
                                </p>
                                <span className="text-indigo-600 font-semibold text-sm opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 ease-in-out">
                                     Xem chi tiết &rarr;
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Scrollbar Style */}
            <style>{`
                .scrollbar-thin { scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f5f9; }
                .scrollbar-thin::-webkit-scrollbar { width: 6px; }
                .scrollbar-thin::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 3px; border: 1px solid #f1f5f9; }
            `}</style>
        </div>
    );
};

