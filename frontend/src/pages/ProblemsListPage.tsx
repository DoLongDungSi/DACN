import React, { useMemo, useState } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import type { Problem, Tag } from '../types';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { PlusCircle, Search, SlidersHorizontal, Users, Star, Clock, Tag as TagIcon } from 'lucide-react';

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
    const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');

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
                const tagMatch = selectedFilterTags.every((tag) => problem.tags.includes(tag.id));
                const difficultyOk = difficultyFilter === 'all' ? true : problem.difficulty === difficultyFilter;
                return nameMatch && tagMatch && difficultyOk;
            })
            .sort((a, b) => b.id - a.id);
    }, [problems, searchTerm, selectedFilterTags, difficultyFilter]);

    const tagMap = useMemo(() => Object.fromEntries(allTags.map((t) => [t.id, t.name])), [allTags]);

    const participantCountByProblem = useMemo(() => {
        const userSets = new Map<number, Set<number>>();
        submissions.forEach((sub) => {
            if (!userSets.has(sub.problemId)) {
                userSets.set(sub.problemId, new Set());
            }
            userSets.get(sub.problemId)!.add(sub.userId);
        });
        const counts = new Map<number, number>();
        userSets.forEach((set, id) => counts.set(id, set.size));
        return counts;
    }, [submissions]);

    const ProblemCard = ({ problem }: { problem: Problem }) => {
        const problemTags = problem.tags.map((tagId) => tagMap[tagId]).filter(Boolean).slice(0, 4);
        const cover = problem.coverImageUrl;
        const participants = participantCountByProblem.get(problem.id) || 0;
        const canEditDelete =
            currentUser && (currentUser.role === 'owner' || problem.authorId === currentUser.id);
        const summaryText =
            problem.summary ||
            toPlainText(problem.content).slice(0, 180) ||
            'No description provided yet.';

        return (
            <div
                onClick={() => handleProblemClick(problem)}
                className="group h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg cursor-pointer"
            >
                <div className="relative h-40 bg-slate-100">
                    {cover ? (
                        <img src={cover} alt={problem.name} className="h-full w-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                            <TagIcon className="w-5 h-5 mr-2" />
                            No cover image
                        </div>
                    )}
                    <div className="absolute top-3 right-3 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                        <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${difficultyBadge[problem.difficulty] || 'bg-slate-100 text-slate-700 border-slate-200'}`}
                        >
                            {problem.difficulty}
                        </span>
                        <span className="text-slate-500 uppercase tracking-wide text-[10px]">
                            {problem.problemType}
                        </span>
                    </div>
                </div>
                <div className="p-5 space-y-3">
                    <h3 className="text-lg font-semibold text-slate-900 line-clamp-2">{problem.name}</h3>
                    <p className="text-sm text-slate-600 line-clamp-3">{summaryText}</p>
                    {problemTags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {problemTags.map((tag) => (
                                <span
                                    key={tag}
                                    className="text-[11px] uppercase tracking-wide px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="grid grid-cols-3 gap-3 text-slate-600 text-xs">
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <Users className="w-4 h-4 text-slate-500" />
                            <div>
                                <div className="text-slate-900 font-semibold">{participants}</div>
                                <div>Teams</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <Star className="w-4 h-4 text-slate-500" />
                            <div>
                                <div className="text-slate-900 font-semibold">{problem.metrics?.length || 1}</div>
                                <div>Metrics</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <Clock className="w-4 h-4 text-slate-500" />
                            <div>
                                <div className="text-slate-900 font-semibold">Open</div>
                                <div>Rolling</div>
                            </div>
                        </div>
                    </div>
                    {canEditDelete && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingProblem(problem);
                                    navigate('problem-editor');
                                }}
                                className="text-xs font-semibold text-slate-700 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100"
                            >
                                Edit
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteProblem(problem.id);
                                }}
                                className="text-xs font-semibold text-rose-600 px-3 py-2 rounded-lg border border-rose-200 hover:bg-rose-50"
                            >
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full py-16 text-slate-500">
                <LoadingSpinner />
                <span className="ml-3">Loading competitions...</span>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 text-slate-900">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Competitions</p>
                            <h1 className="text-3xl sm:text-4xl font-bold">Machine Learning Competitions</h1>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            {canCreate && (
                                <button
                                    onClick={() => {
                                        setEditingProblem('new');
                                        navigate('problem-editor');
                                    }}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white shadow hover:bg-indigo-700"
                                >
                                    <PlusCircle className="w-4 h-4" /> Host a competition
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="relative max-w-4xl">
                        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search competitions..."
                            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm focus:border-indigo-400 focus:ring-indigo-400"
                        />
                    </div>
                </div>

                {filteredProblems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
                        No competitions found. Adjust filters or create a new one.
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredProblems.map((problem) => (
                            <ProblemCard key={problem.id} problem={problem} />
                        ))}
                    </div>
                )}

                {/* Filters Section at Bottom */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <SlidersHorizontal className="w-4 h-4" />
                            Filters
                        </div>
                        <button
                            onClick={() => { setSelectedFilterTags([]); setDifficultyFilter('all'); }}
                            className="px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
                        >
                            Clear all
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(['all', 'easy', 'medium', 'hard'] as const).map((level) => (
                            <button
                                key={level}
                                onClick={() => setDifficultyFilter(level)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                                    difficultyFilter === level
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {level === 'all' ? 'All difficulties' : level}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase text-slate-500">Tags</div>
                        <div className="flex flex-wrap gap-2">
                            {allTags.map((tag) => {
                                const active = selectedFilterTags.some((t) => t.id === tag.id);
                                return (
                                    <button
                                        key={tag.id}
                                        onClick={() => toggleTag(tag)}
                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                                            active
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        <TagIcon className="w-3 h-3" />
                                        {tag.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
