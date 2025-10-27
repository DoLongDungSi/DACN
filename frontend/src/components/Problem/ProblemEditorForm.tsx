import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; // Import KaTeX CSS
import { Problem, Tag, Metric, Difficulty, ProblemType, Dataset } from '../../types';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { Info, Tag as TagIcon, BarChart3, Upload, FileText, X, Plus, Check, Eye, EyeOff } from 'lucide-react';

interface ProblemEditorFormProps {
    initialProblem: Problem | "new";
    onSave: (
        data: Partial<Problem>, // Only name, difficulty, type, content
        tagIds: number[],
        metricIds: number[],
        files: { trainFile: File | null; testFile: File | null }
    ) => void;
    onCancel: () => void;
    allTags: Tag[];
    allMetrics: Metric[];
    loading: boolean;
}

export const ProblemEditorForm: React.FC<ProblemEditorFormProps> = ({
    initialProblem,
    onSave,
    onCancel,
    allTags,
    allMetrics,
    loading,
}) => {
    const isNew = initialProblem === "new";

    // --- State Initialization ---
    const [name, setName] = useState(isNew ? "" : initialProblem.name);
    const [difficulty, setDifficulty] = useState<Difficulty>(isNew ? "easy" : initialProblem.difficulty);
    const [problemType, setProblemType] = useState<ProblemType>(isNew ? "classification" : initialProblem.problemType);
    const [content, setContent] = useState(isNew ? "## Mô tả\n\nViết mô tả chi tiết bài toán...\n\n## Dữ liệu\n\nMô tả dữ liệu train/test...\n\n## Định dạng nộp bài\n\nChỉ rõ định dạng file submission...\n\n## Tiêu chí đánh giá\n\nGiải thích metric được sử dụng...\n\nSử dụng **Markdown** và công thức LaTeX như $E=mc^2$ hoặc:\n\n$$\\frac{1}{N} \\sum_{i=1}^{N} (y_i - \\hat{y}_i)^2$$\n" : initialProblem.content);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>(isNew ? [] : (initialProblem.tags || []));
    const [selectedMetricIds, setSelectedMetricIds] = useState<number[]>(isNew ? [] : (initialProblem.metrics || []));
    const [trainFile, setTrainFile] = useState<File | null>(null);
    const [testFile, setTestFile] = useState<File | null>(null);
    const [showPreview, setShowPreview] = useState(true);

    // Tag Input State
    const [tagSearch, setTagSearch] = useState('');
    const [showTagDropdown, setShowTagDropdown] = useState(false);


    // Difficulty options with styling from target UI
     const difficulties = [
        { value: 'easy', label: 'Dễ', color: 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100 focus:ring-green-300' },
        { value: 'medium', label: 'Trung bình', color: 'text-yellow-600 bg-yellow-50 border-yellow-200 hover:bg-yellow-100 focus:ring-yellow-300' },
        { value: 'hard', label: 'Khó', color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100 focus:ring-red-300' }
    ];

    // --- Effects ---
    useEffect(() => {
        // Reset form when initialProblem changes (e.g., navigating from edit to new)
        if (initialProblem === "new") {
            setName("");
            setDifficulty("easy");
            setProblemType("classification");
            setContent("## Mô tả\n\nViết mô tả chi tiết bài toán...\n\n## Dữ liệu\n\nMô tả dữ liệu train/test...\n\n## Định dạng nộp bài\n\nChỉ rõ định dạng file submission...\n\n## Tiêu chí đánh giá\n\nGiải thích metric được sử dụng...\n\nSử dụng **Markdown** và công thức LaTeX như $E=mc^2$ hoặc:\n\n$$\\frac{1}{N} \\sum_{i=1}^{N} (y_i - \\hat{y}_i)^2$$\n");
            setSelectedTagIds([]);
            setSelectedMetricIds([]);
            setTrainFile(null);
            setTestFile(null);
        } else {
            setName(initialProblem.name);
            setDifficulty(initialProblem.difficulty);
            setProblemType(initialProblem.problemType);
            setContent(initialProblem.content);
            setSelectedTagIds(initialProblem.tags || []);
            setSelectedMetricIds(initialProblem.metrics || []);
            setTrainFile(null);
            setTestFile(null);
        }
    }, [initialProblem]);

    // --- Tag Handling ---
    const handleAddTagById = (tagId: number) => {
        if (!selectedTagIds.includes(tagId)) {
            setSelectedTagIds(prev => [...prev, tagId]);
        }
        setTagSearch(''); // Clear search input
        setShowTagDropdown(false); // Hide dropdown after selection
    };

    const handleRemoveTag = (tagIdToRemove: number) => {
        setSelectedTagIds(prev => prev.filter(id => id !== tagIdToRemove));
    };

    const filteredTags = useMemo(() => {
        if (!tagSearch) return allTags.filter(tag => !selectedTagIds.includes(tag.id));
        return allTags.filter(tag =>
            !selectedTagIds.includes(tag.id) &&
            tag.name.toLowerCase().includes(tagSearch.toLowerCase())
        );
    }, [tagSearch, allTags, selectedTagIds]);

    const selectedTagObjects = useMemo(() => {
        return selectedTagIds.map(id => allTags.find(tag => tag.id === id)).filter(Boolean) as Tag[];
    }, [selectedTagIds, allTags]);


    // --- Metric Handling ---
    const handleMetricChange = (metricId: number, checked: boolean) => {
         setSelectedMetricIds(prev =>
            checked ? [...prev, metricId] : prev.filter(id => id !== metricId)
        );
    };

    // --- Submit Handler ---
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !content.trim() || selectedMetricIds.length === 0) {
            alert("Vui lòng điền tên, nội dung và chọn ít nhất một metric.");
            return;
        }
        if (isNew && (!trainFile || !testFile)) {
             alert("Vui lòng tải lên cả file train và test cho bài toán mới.");
             return;
        }

        const problemData: Partial<Problem> = { name, difficulty, problemType, content };
        onSave(problemData, selectedTagIds, selectedMetricIds, { trainFile, testFile });
    };

    // --- File Info ---
    const currentTrainFile = !isNew ? initialProblem.datasets?.find(d => d.split === 'train') : undefined;
    const currentTestFile = !isNew ? initialProblem.datasets?.find(d => d.split === 'public_test') : undefined;


    // --- Render ---
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* --- Basic Information Card --- */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                    <Info className="w-5 h-5 mr-2 text-indigo-600" />
                    Thông tin cơ bản
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div>
                        <label htmlFor="problemName" className="block text-sm font-medium text-gray-700 mb-2">Tên bài toán</label>
                        <input
                            id="problemName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm transition duration-150 ease-in-out"
                            placeholder="vd: Dự đoán giá nhà"
                         />
                    </div>

                    {/* Difficulty */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Độ khó</label>
                        <div className="flex flex-wrap gap-2">
                            {difficulties.map(diff => (
                            <button
                                type="button"
                                key={diff.value}
                                onClick={() => setDifficulty(diff.value as Difficulty)}
                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                difficulty === diff.value
                                    ? diff.color + ' ring-2 ring-offset-1' // Active state with ring
                                    : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 focus:ring-indigo-300' // Inactive state
                                }`}
                            >
                                {diff.label}
                            </button>
                            ))}
                        </div>
                    </div>
                     {/* Problem Type */}
                     <div>
                         <label htmlFor="problemType" className="block text-sm font-medium text-slate-700 mb-2">Loại bài toán</label>
                        <select
                            id="problemType"
                            value={problemType}
                            onChange={(e) => setProblemType(e.target.value as ProblemType)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm transition duration-150 ease-in-out"
                        >
                            <option value="classification">Phân loại (Classification)</option>
                            <option value="regression">Hồi quy (Regression)</option>
                            {/* Add other types if needed */}
                        </select>
                    </div>

                      {/* Metrics */}
                     <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Metric đánh giá</label>
                        <div className="space-y-2 max-h-40 overflow-y-auto border p-3 rounded-md bg-gray-50/50 shadow-sm scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                             {allMetrics.length === 0 && <p className="text-xs text-slate-500 italic">Chưa có metric nào được định nghĩa.</p>}
                            {allMetrics.sort((a,b) => a.key.localeCompare(b.key)).map((metric) => (
                                <label key={metric.id} className="flex items-center space-x-2 cursor-pointer text-sm group p-1 rounded hover:bg-indigo-50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={selectedMetricIds.includes(metric.id)}
                                        onChange={(e) => handleMetricChange(metric.id, e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-1 transition duration-150 ease-in-out"
                                    />
                                     <span className="text-slate-700 group-hover:text-indigo-700 font-medium">{metric.key}</span>
                                    <span className="text-xs text-slate-500 group-hover:text-indigo-500">({metric.direction === 'maximize' ? 'Cao tốt' : 'Thấp tốt'})</span>
                                </label>
                            ))}
                         </div>
                        {selectedMetricIds.length === 0 && <p className="text-xs text-red-600 mt-1">Chọn ít nhất một metric.</p>}
                     </div>
                </div>

                 {/* Tags - Styled like target UI */}
                <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                    <div className="flex flex-wrap gap-2 items-center mb-3 min-h-[36px] p-2 border border-gray-300 rounded-lg bg-gray-50/50">
                        {selectedTagObjects.map(tag => (
                            <span
                            key={tag.id}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 animate-fade-in"
                            >
                            <TagIcon className="w-3 h-3 mr-1.5" />
                            {tag.name}
                            <button
                                type="button"
                                onClick={() => handleRemoveTag(tag.id)}
                                className="ml-1.5 p-0.5 rounded-full text-blue-600 hover:bg-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                aria-label={`Remove ${tag.name} tag`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                            </span>
                        ))}
                        {/* Tag Input Dropdown */}
                        <div className="relative">
                            <input
                                type="text"
                                value={tagSearch}
                                onChange={(e) => setTagSearch(e.target.value)}
                                onFocus={() => setShowTagDropdown(true)}
                                // onBlur={() => setTimeout(() => setShowTagDropdown(false), 150)} // Delay hiding to allow click
                                className="px-3 py-1 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-blue-500 w-28 shadow-sm transition duration-150 ease-in-out"
                                placeholder="+ Thêm tag..."
                                list="available-tags-datalist"
                            />
                             <datalist id="available-tags-datalist">
                                {filteredTags.map(tag => ( <option key={tag.id} value={tag.name} /> ))}
                            </datalist>
                             {/* Custom Dropdown for better UX */}
                            {showTagDropdown && filteredTags.length > 0 && (
                                <div className="absolute z-10 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto scrollbar-thin">
                                    <ul>
                                        {filteredTags.map(tag => (
                                            <li key={tag.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddTagById(tag.id)}
                                                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                                                >
                                                    {tag.name}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                         </div>
                         {/* Button to close dropdown */}
                         {showTagDropdown && <button type="button" onClick={() => setShowTagDropdown(false)} className="fixed inset-0 cursor-default -z-1"></button>}
                    </div>
                </div>
            </div>

            {/* --- Content Editor Card --- */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                     <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                        Nội dung chi tiết
                    </h2>
                    <button
                        type="button"
                        onClick={() => setShowPreview(!showPreview)}
                        className="flex items-center px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
                        title={showPreview ? 'Ẩn Preview' : 'Hiện Preview'}
                    >
                        {showPreview ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
                        {showPreview ? 'Ẩn' : 'Xem trước'}
                    </button>
                </div>
                <p className="text-xs text-gray-500 mb-2">Mô tả chi tiết bài toán, dữ liệu, định dạng nộp bài, tiêu chí đánh giá... Hỗ trợ Markdown và công thức LaTeX ($inline$ hoặc $$block$$).</p>

                <div className={`grid ${showPreview ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                    {/* Editor */}
                    <div>
                         <label htmlFor="problemContent" className="sr-only">Nội dung bài toán (Markdown + LaTeX)</label>
                         <textarea
                            id="problemContent"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={showPreview ? 20 : 15} // Adjust rows based on preview visibility
                            required
                            placeholder="Viết nội dung ở đây..."
                            className="w-full h-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y shadow-sm transition duration-150 ease-in-out"
                            spellCheck="false"
                        ></textarea>
                    </div>

                    {/* Preview */}
                    {showPreview && (
                         <div className="md:border-l md:pl-4 border-slate-200">
                             <label className="block text-sm font-medium text-gray-700 mb-2">Xem trước</label>
                             <div className="h-[calc(20*1.5rem)] px-4 py-3 border border-gray-300 rounded-lg overflow-y-auto bg-slate-50/50 shadow-inner scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                                <article className="prose prose-sm max-w-none prose-slate prose-headings:font-semibold prose-a:text-indigo-600 hover:prose-a:text-indigo-800 prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:text-slate-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-medium prose-pre:bg-slate-800 prose-pre:text-slate-200 prose-pre:rounded-lg">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            // Optional: Add custom components if needed, e.g., for tables
                                        }}
                                    >
                                        {content || '*Chưa có nội dung*'}
                                    </ReactMarkdown>
                                </article>
                             </div>
                        </div>
                    )}
                </div>
            </div>


            {/* --- Datasets Card --- */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                 <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                     <Upload className="w-5 h-5 mr-2 text-indigo-600" />
                     Dữ liệu (.csv)
                 </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Train File */}
                    <div>
                         <label htmlFor="trainFile" className="block text-sm font-medium text-slate-700 mb-1">Tập Train</label>
                         <p className="text-xs text-slate-500 mb-2">Tải lên file <code className="text-xs bg-slate-100 px-1 rounded font-medium">train.csv</code>.</p>
                         <input id="trainFile" type="file" accept=".csv" onChange={(e) => setTrainFile(e.target.files?.[0] || null)} className="file-input-style" aria-describedby="train-file-description"/>
                         {currentTrainFile && !trainFile && ( <p id="train-file-description" className="file-status-ok"> Hiện tại: <strong className="font-medium">{currentTrainFile.filename}</strong>. </p> )}
                         {trainFile && ( <p id="train-file-description" className="file-status-new"> File mới: <strong className="font-medium">{trainFile.name}</strong>. </p> )}
                         {isNew && !trainFile && <p className="file-status-required">Bắt buộc cho bài toán mới.</p>}
                    </div>
                     {/* Test File */}
                    <div>
                         <label htmlFor="testFile" className="block text-sm font-medium text-slate-700 mb-1">Tập Test (Public)</label>
                         <p className="text-xs text-slate-500 mb-2">Tải lên file <code className="text-xs bg-slate-100 px-1 rounded font-medium">test.csv</code>.</p>
                         <input id="testFile" type="file" accept=".csv" onChange={(e) => setTestFile(e.target.files?.[0] || null)} className="file-input-style" aria-describedby="test-file-description"/>
                         {currentTestFile && !testFile && ( <p id="test-file-description" className="file-status-ok"> Hiện tại: <strong className="font-medium">{currentTestFile.filename}</strong>. </p> )}
                         {testFile && ( <p id="test-file-description" className="file-status-new"> File mới: <strong className="font-medium">{testFile.name}</strong>. </p> )}
                         {isNew && !testFile && <p className="file-status-required">Bắt buộc cho bài toán mới.</p>}
                    </div>
                </div>
             </div>


            {/* --- Action Buttons --- */}
            <div className="mt-8 flex justify-end gap-4">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={loading}
                    className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    Hủy
                </button>
                <button
                    type="submit"
                    disabled={loading || selectedMetricIds.length === 0 || (isNew && (!trainFile || !testFile))}
                    className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:from-blue-400 disabled:to-purple-400 disabled:cursor-not-allowed disabled:shadow-none min-w-[140px] flex justify-center items-center"
                >
                    {loading ? <LoadingSpinner size="sm" /> : (isNew ? "Tạo bài toán" : "Lưu thay đổi")}
                </button>
            </div>
             {/* --- Styles --- (Keep embedded styles for now) */}
             <style>{`
                .file-input-style { display: block; width: 100%; font-size: 0.875rem; color: #64748b; padding: 0.25rem; file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 rounded-md }
                .file-status-ok { font-size: 0.75rem; color: #059669; margin-top: 0.5rem; }
                .file-status-new { font-size: 0.75rem; color: #2563eb; margin-top: 0.5rem; }
                .file-status-required { font-size: 0.75rem; color: #dc2626; margin-top: 0.5rem; }
                @keyframes fade-in { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
                .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
                /* Simple scrollbar */
                .scrollbar-thin { scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f5f9; }
                .scrollbar-thin::-webkit-scrollbar { width: 6px; }
                .scrollbar-thin::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 3px; border: 1px solid #f1f5f9; }
                /* Prose adjustments for KaTeX */
                 .prose .katex-display { margin-left: 0; margin-right: 0; }
                .prose code { font-weight: 500; } /* Make inline code slightly bolder */
            `}</style>
        </form>
    );
};

