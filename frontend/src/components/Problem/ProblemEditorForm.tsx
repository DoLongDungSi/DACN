import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { Problem, Tag, Metric, Difficulty, ProblemType } from '../../types';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { Info, Tag as TagIcon, BarChart3, Upload, FileText, X, Eye, EyeOff, FileCode2, FileUp } from 'lucide-react';

interface ProblemEditorFormProps {
    initialProblem: Problem | "new";
    onSave: (
        data: Partial<Problem> & { evaluationScriptContent: string },
        tagIds: number[],
        metricIds: number[],
        files: { trainFile: File | null; testFile: File | null; groundTruthFile: File | null }
    ) => void;
    onCancel: () => void;
    allTags: Tag[];
    allMetrics: Metric[];
    loading: boolean;
}

const defaultFormatCheckScript = `# Example evaluation script\nimport sys\nimport pandas as pd\nfrom sklearn.metrics import accuracy_score\n\ndef evaluate(submission_path, ground_truth_path, public_test_path, output_path):\n    sub_df = pd.read_csv(submission_path)\n    gt_df = pd.read_csv(ground_truth_path)\n    # Basic format check\n    required = {'id', 'prediction'}\n    if not required.issubset(sub_df.columns):\n        with open(output_path, 'w') as f: f.write('0.0'); sys.exit(1)\n    merged = pd.merge(sub_df[['id', 'prediction']], gt_df, on='id', how='inner')\n    score = accuracy_score(merged['prediction'].round().astype(int), merged.iloc[:, -1])\n    with open(output_path, 'w') as f: f.write(str(float(score)))\n\nif __name__ == '__main__':\n    evaluate(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])\n`;

export const ProblemEditorForm: React.FC<ProblemEditorFormProps> = ({
    initialProblem,
    onSave,
    onCancel,
    allTags,
    allMetrics,
    loading,
}) => {
    const isNew = initialProblem === 'new';

    // --- State ---
    const [name, setName] = useState(isNew ? '' : initialProblem.name);
    const [difficulty, setDifficulty] = useState<Difficulty>(isNew ? 'easy' : initialProblem.difficulty);
    const [problemType, setProblemType] = useState<ProblemType>(isNew ? 'classification' : initialProblem.problemType);
    const [content, setContent] = useState(isNew ? '## Overview\n\nDescribe the problem, data, and submission format.' : initialProblem.content);
    const [summary, setSummary] = useState(isNew ? '' : initialProblem.summary || '');
    const [coverImageUrl, setCoverImageUrl] = useState(isNew ? '' : initialProblem.coverImageUrl || '');
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>(isNew ? [] : initialProblem.tags || []);
    const [selectedMetricIds, setSelectedMetricIds] = useState<number[]>(isNew ? [] : initialProblem.metrics || []);
    const [trainFile, setTrainFile] = useState<File | null>(null);
    const [testFile, setTestFile] = useState<File | null>(null);
    const [groundTruthFile, setGroundTruthFile] = useState<File | null>(null);
    const [scriptContent, setScriptContent] = useState<string>(isNew ? defaultFormatCheckScript : (initialProblem.evaluationScript || defaultFormatCheckScript));
    const [showPreview, setShowPreview] = useState(true);
    const [tagSearch, setTagSearch] = useState('');
    const [showTagDropdown, setShowTagDropdown] = useState(false);
    const [selectedTab, setSelectedTab] = useState<'overview' | 'data' | 'evaluation' | 'meta'>('overview');
    const scriptFileReaderRef = useRef<HTMLInputElement>(null);

    // --- Effects ---
    useEffect(() => {
        if (initialProblem === 'new') {
            setName('');
            setDifficulty('easy');
            setProblemType('classification');
            setContent('## Overview\n\nDescribe the problem, data, and submission format.');
            setSelectedTagIds([]);
            setSelectedMetricIds([]);
            setTrainFile(null);
            setTestFile(null);
            setGroundTruthFile(null);
            setScriptContent(defaultFormatCheckScript);
            setSummary('');
            setCoverImageUrl('');
        } else {
            setName(initialProblem.name);
            setDifficulty(initialProblem.difficulty);
            setProblemType(initialProblem.problemType);
            setContent(initialProblem.content);
            setSelectedTagIds(initialProblem.tags || []);
            setSelectedMetricIds(initialProblem.metrics || []);
            setTrainFile(null);
            setTestFile(null);
            setGroundTruthFile(null);
            setScriptContent(initialProblem.evaluationScript || defaultFormatCheckScript);
            setSummary(initialProblem.summary || '');
            setCoverImageUrl(initialProblem.coverImageUrl || '');
        }
    }, [initialProblem]);

    // --- Helpers ---
    const filteredTags = useMemo(() => {
        if (!tagSearch) return allTags.filter(tag => !selectedTagIds.includes(tag.id));
        return allTags.filter(tag => !selectedTagIds.includes(tag.id) && tag.name.toLowerCase().includes(tagSearch.toLowerCase()));
    }, [tagSearch, allTags, selectedTagIds]);

    const selectedTagObjects = useMemo(() => selectedTagIds.map(id => allTags.find(tag => tag.id === id)).filter(Boolean) as Tag[], [selectedTagIds, allTags]);

    const handleAddTagById = (tagId: number) => { if (!selectedTagIds.includes(tagId)) { setSelectedTagIds(prev => [...prev, tagId]); } setTagSearch(''); setShowTagDropdown(false); };
    const handleRemoveTag = (tagId: number) => setSelectedTagIds(prev => prev.filter(id => id !== tagId));
    const handleMetricChange = (metricId: number, checked: boolean) => setSelectedMetricIds(prev => checked ? [...prev, metricId] : prev.filter(id => id !== metricId));

    const handleScriptFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result;
                if (typeof text === 'string') { setScriptContent(text); }
            };
            reader.readAsText(file);
        }
        event.target.value = '';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !content.trim() || !scriptContent.trim()) {
            alert('Please fill name, description, and evaluation script.');
            return;
        }
        if (isNew && (!trainFile || !testFile || !groundTruthFile)) {
            alert('Upload train, public test, and ground truth for a new problem.');
            return;
        }
        const problemData: Partial<Problem> & { evaluationScriptContent: string } = {
            name,
            difficulty,
            problemType,
            content,
            summary,
            coverImageUrl,
            evaluationScriptContent: scriptContent,
        };
        onSave(problemData, selectedTagIds, selectedMetricIds, { trainFile, testFile, groundTruthFile });
    };

    const currentTrainFileMeta = !isNew && Array.isArray(initialProblem.datasets) ? initialProblem.datasets.find(d => d.split === 'train') : undefined;
    const currentTestFileMeta = !isNew && Array.isArray(initialProblem.datasets) ? initialProblem.datasets.find(d => d.split === 'public_test') : undefined;
    const currentGroundTruthExists = !isNew && initialProblem.hasGroundTruth;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                {([
                    { id: 'overview', label: 'Overview' },
                    { id: 'data', label: 'Data' },
                    { id: 'evaluation', label: 'Evaluation' },
                    { id: 'meta', label: 'Meta' },
                ] as const).map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSelectedTab(tab.id)}
                        className={`px-3 py-2 text-sm font-semibold rounded-md ${selectedTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {selectedTab === 'overview' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 space-y-4">
                        <h2 className="text-xl font-semibold text-gray-800 flex items-center"><Info className="w-5 h-5 mr-2 text-indigo-600" /> Basic info</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="input-label" htmlFor="problemName">Name</label>
                                <input id="problemName" value={name} onChange={(e) => setName(e.target.value)} required className="input-style" placeholder="e.g. Titanic survival" />
                            </div>
                            <div>
                                <label className="input-label">Difficulty</label>
                                <div className="flex flex-wrap gap-2">
                                    {(['easy','medium','hard'] as Difficulty[]).map(diff => (
                                        <button key={diff} type="button" onClick={() => setDifficulty(diff)} className={`px-3 py-2 rounded-lg border text-sm font-semibold ${difficulty === diff ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>
                                            {diff}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="input-label" htmlFor="problemType">Problem type</label>
                                <select id="problemType" value={problemType} onChange={(e) => setProblemType(e.target.value as ProblemType)} className="input-style bg-white">
                                    <option value="classification">Classification</option>
                                    <option value="regression">Regression</option>
                                </select>
                            </div>
                            <div>
                                <label className="input-label" htmlFor="summary">Short summary</label>
                                <textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="input-style" placeholder="One-liner description shown on cards" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="input-label" htmlFor="cover">Cover image URL</label>
                                <input id="cover" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} className="input-style" placeholder="https://..." />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-800 flex items-center"><FileText className="w-5 h-5 mr-2 text-indigo-600" /> Description</h2>
                            <button type="button" onClick={() => setShowPreview(!showPreview)} className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
                                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {showPreview ? 'Hide preview' : 'Show preview'}
                            </button>
                        </div>
                        <div className={`grid ${showPreview ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                            <div>
                                <label className="sr-only" htmlFor="content">Content</label>
                                <textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} rows={showPreview ? 18 : 14} required className="content-textarea" placeholder="Markdown description, rules, submission format..." />
                            </div>
                            {showPreview && (
                                <div className="md:border-l md:pl-4 border-slate-200">
                                    <div className="text-sm font-semibold text-slate-700 mb-2">Preview</div>
                                    <div className="content-preview-container">
                                        <article className="prose prose-sm max-w-none prose-slate prose-headings:font-semibold prose-a:text-indigo-600">
                                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                {content || '*No content*'}
                                            </ReactMarkdown>
                                        </article>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {selectedTab === 'data' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 space-y-4">
                        <h2 className="text-xl font-semibold text-gray-800 flex items-center"><Upload className="w-5 h-5 mr-2 text-indigo-600" /> Datasets</h2>
                        <p className="text-xs text-slate-600">Upload CSV files. Train + public test are shown to users; ground truth stays hidden.</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label htmlFor="trainFile" className="input-label-file">Train (.csv)</label>
                                <input id="trainFile" type="file" accept=".csv" onChange={(e) => setTrainFile(e.target.files?.[0] || null)} className="file-input-style" />
                                {currentTrainFileMeta && !trainFile && (
                                    <p className="file-status-ok">Current: <strong>{currentTrainFileMeta.filename}</strong></p>
                                )}
                                {trainFile && <p className="file-status-new">New: <strong>{trainFile.name}</strong></p>}
                                {isNew && !trainFile && <p className="file-status-required">Required for new problem.</p>}
                            </div>
                            <div>
                                <label htmlFor="testFile" className="input-label-file">Public test (.csv)</label>
                                <input id="testFile" type="file" accept=".csv" onChange={(e) => setTestFile(e.target.files?.[0] || null)} className="file-input-style" />
                                {currentTestFileMeta && !testFile && (
                                    <p className="file-status-ok">Current: <strong>{currentTestFileMeta.filename}</strong></p>
                                )}
                                {testFile && <p className="file-status-new">New: <strong>{testFile.name}</strong></p>}
                                {isNew && !testFile && <p className="file-status-required">Required for new problem.</p>}
                            </div>
                            <div>
                                <label htmlFor="groundTruthFile" className="input-label-file">Ground truth (.csv)</label>
                                <input id="groundTruthFile" type="file" accept=".csv" onChange={(e) => setGroundTruthFile(e.target.files?.[0] || null)} className="file-input-style" />
                                {currentGroundTruthExists && !groundTruthFile && <p className="file-status-ok">Ground truth already uploaded.</p>}
                                {groundTruthFile && <p className="file-status-new">New: <strong>{groundTruthFile.name}</strong></p>}
                                {!isNew && !currentGroundTruthExists && !groundTruthFile && <p className="file-status-required">Required if none exists.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedTab === 'evaluation' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-800 flex items-center"><FileCode2 className="w-5 h-5 mr-2 text-indigo-600" /> Evaluation script</h2>
                            <div className="flex items-center gap-2">
                                <input type="file" accept=".py,.txt" ref={scriptFileReaderRef} onChange={handleScriptFileChange} className="hidden" />
                                <button type="button" onClick={() => scriptFileReaderRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                                    <FileUp className="w-4 h-4" /> Upload .py
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-slate-600">Python function signature: evaluate(submission_path, ground_truth_path, public_test_path, output_path). Write score to output_path.</p>
                        <textarea value={scriptContent} onChange={(e) => setScriptContent(e.target.value)} rows={16} required className="content-textarea" spellCheck={false} />
                    </div>
                </div>
            )}

            {selectedTab === 'meta' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 space-y-4">
                        <h2 className="text-xl font-semibold text-gray-800 flex items-center"><BarChart3 className="w-5 h-5 mr-2 text-indigo-600" /> Metrics & tags</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="input-label">Metrics (for display/leaderboard)</label>
                                <div className="space-y-2">
                                    {allMetrics.length === 0 && <p className="text-xs text-slate-500 italic">No metrics defined.</p>}
                                    {allMetrics.sort((a,b) => a.key.localeCompare(b.key)).map(metric => (
                                        <label key={metric.id} className="metric-label group">
                                            <input type="checkbox" checked={selectedMetricIds.includes(metric.id)} onChange={(e) => handleMetricChange(metric.id, e.target.checked)} className="metric-checkbox" />
                                            <span className="metric-key">{metric.key}</span>
                                            <span className="metric-direction">({metric.direction === 'maximize' ? 'maximize' : 'minimize'})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="input-label">Tags</label>
                                <div className="tag-input-container">
                                    {selectedTagObjects.map(tag => (
                                        <span key={tag.id} className="tag-selected">
                                            <TagIcon className="w-3 h-3 mr-1.5" /> {tag.name}
                                            <button type="button" onClick={() => handleRemoveTag(tag.id)} className="tag-remove-button" aria-label={`Remove ${tag.name}`}>
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={tagSearch}
                                            onChange={(e) => setTagSearch(e.target.value)}
                                            onFocus={() => setShowTagDropdown(true)}
                                            className="tag-search-input"
                                            placeholder="+ Add tag..."
                                        />
                                        {showTagDropdown && filteredTags.length > 0 && (
                                            <div className="tag-dropdown">
                                                <ul>
                                                    {filteredTags.map(tag => (
                                                        <li key={tag.id}>
                                                            <button type="button" onClick={() => handleAddTagById(tag.id)} className="tag-dropdown-item">{tag.name}</button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                    {showTagDropdown && <button type="button" onClick={() => setShowTagDropdown(false)} className="fixed inset-0 cursor-default -z-1"></button>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2">
                    {loading && <LoadingSpinner size="sm" />} Save
                </button>
            </div>
        </form>
    );
};
