import React, { useState, useRef, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import type { Problem, Tag, Metric, Difficulty, ProblemType } from '../../types';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { Info, Save, Database, Layout, Image as ImageIcon, FileCode2, Bold, Italic, Link as LinkIcon, Youtube, CheckCircle2 } from 'lucide-react';
import { api } from '../../api';

// --- Constants ---
const DEFAULT_SCRIPT = `import sys\nimport pandas as pd\nfrom sklearn.metrics import accuracy_score\n\ndef evaluate(submission_path, ground_truth_path, output_path):\n    try:\n        sub_df = pd.read_csv(submission_path)\n        gt_df = pd.read_csv(ground_truth_path)\n        # Logic chấm điểm ở đây\n        # Ví dụ: so sánh cột cuối cùng\n        y_pred = sub_df.iloc[:, -1]\n        y_true = gt_df.iloc[:, -1]\n        score = accuracy_score(y_true, y_pred)\n        with open(output_path, 'w') as f: f.write(str(score))\n    except Exception as e:\n        with open(output_path, 'w') as f: f.write('0.0')\n\nif __name__ == '__main__':\n    # Tham số 1: bài nộp, Tham số 2: ground truth\n    # Lưu ý: Backend truyền 4 tham số, tham số thứ 4 là output path\n    evaluate(sys.argv[1], sys.argv[2], sys.argv[4])`;

interface Props {
    initialProblem: Problem | "new";
    onSave: (data: any, tagIds: number[], metricIds: number[], files: any) => void;
    onCancel: () => void;
    allTags: Tag[];
    allMetrics: Metric[];
    loading: boolean;
}

// --- TÁCH COMPONENT CON RA NGOÀI ĐỂ TRÁNH RE-RENDER ---

interface ToolbarProps {
    onInsert: (before: string, after?: string) => void;
    onImageUpload: () => void;
    onYoutube: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onInsert, onImageUpload, onYoutube }) => (
    <div className="flex items-center gap-1 p-2 bg-slate-100 border-b border-slate-200 rounded-t-xl overflow-x-auto">
        <button type="button" onClick={() => onInsert('**', '**')} className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="In đậm"><Bold className="w-4 h-4"/></button>
        <button type="button" onClick={() => onInsert('*', '*')} className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="In nghiêng"><Italic className="w-4 h-4"/></button>
        <div className="w-px h-4 bg-slate-300 mx-1"></div>
        <button type="button" onClick={onImageUpload} className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="Chèn ảnh"><ImageIcon className="w-4 h-4"/></button>
        <button type="button" onClick={onYoutube} className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="Chèn Youtube"><Youtube className="w-4 h-4"/></button>
        <button type="button" onClick={() => onInsert('[Text]', '(url)')} className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="Chèn Link"><LinkIcon className="w-4 h-4"/></button>
    </div>
);

interface MarkdownEditorProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    onImageUploadReq: (setter: (val: string) => void) => void;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ value, onChange, placeholder, onImageUploadReq }) => {
    const handleInsert = (before: string, after: string = '') => {
        onChange(value + `${before}${after}`);
    };

    const handleYoutube = () => {
        const url = prompt("Nhập link Youtube (VD: https://www.youtube.com/watch?v=...):");
        if (url) {
            const videoId = url.split('v=')[1]?.split('&')[0];
            if (videoId) {
                onChange(value + `\n<iframe width="100%" height="400" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>\n`);
            }
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
            <div className="flex flex-col border border-slate-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-indigo-500 overflow-hidden">
                <Toolbar 
                    onInsert={handleInsert} 
                    onImageUpload={() => onImageUploadReq((url) => onChange(value + `\n![Image](${url})\n`))}
                    onYoutube={handleYoutube}
                />
                <textarea 
                    value={value} 
                    onChange={e => onChange(e.target.value)} 
                    className="flex-1 p-4 outline-none font-mono text-sm resize-none bg-slate-50/50" 
                    placeholder={placeholder} 
                />
            </div>
            <div className="h-full overflow-y-auto border rounded-xl p-6 bg-white prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeRaw]}>
                    {value || '*Bản xem trước*'}
                </ReactMarkdown>
            </div>
        </div>
    );
};

// --- COMPONENT CHÍNH ---

export const ProblemEditorForm: React.FC<Props> = ({ initialProblem, onSave, onCancel, allTags, allMetrics, loading }) => {
    const isNew = initialProblem === 'new';
    
    // State initialization
    // IMPORTANT: We use useState with a function or initial value, but we also rely on useEffect to update if initialProblem changes late
    const [name, setName] = useState(isNew ? '' : initialProblem.name);
    const [difficulty, setDifficulty] = useState<Difficulty>(isNew ? 'easy' : initialProblem.difficulty);
    const [problemType, setProblemType] = useState<ProblemType>(isNew ? 'classification' : initialProblem.problemType);
    const [summary, setSummary] = useState(isNew ? '' : initialProblem.summary || '');
    const [content, setContent] = useState(isNew ? '## Giới thiệu\nMô tả cuộc thi...' : initialProblem.content);
    const [dataDescription, setDataDescription] = useState(isNew ? '## Dữ liệu\nChi tiết về tập dữ liệu...' : initialProblem.dataDescription || '');
    
    // Script: Use default if new or if existing is empty
    const [scriptContent, setScriptContent] = useState(isNew ? DEFAULT_SCRIPT : (initialProblem.evaluationScript || DEFAULT_SCRIPT));
    
    // Files
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImageUrl, setCoverImageUrl] = useState(isNew ? '' : initialProblem.coverImageUrl || '');
    const [trainFile, setTrainFile] = useState<File | null>(null);
    const [testFile, setTestFile] = useState<File | null>(null);
    const [gtFile, setGtFile] = useState<File | null>(null);

    // Meta
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>(isNew ? [] : initialProblem.tags);
    const [selectedMetricIds, setSelectedMetricIds] = useState<number[]>(isNew ? [] : initialProblem.metrics);
    
    // UI
    const [activeTab, setActiveTab] = useState<'overview' | 'data' | 'evaluation' | 'meta'>('overview');
    const [tagSearch, setTagSearch] = useState('');
    
    const scriptInputRef = useRef<HTMLInputElement>(null);
    const imageUploadRef = useRef<HTMLInputElement>(null);
    const [pendingImageInsert, setPendingImageInsert] = useState<((url: string) => void) | null>(null);

    // --- Sync State when initialProblem changes (loaded from API) ---
    useEffect(() => {
        if (initialProblem !== 'new') {
            setName(initialProblem.name || '');
            setDifficulty(initialProblem.difficulty || 'easy');
            setProblemType(initialProblem.problemType || 'classification');
            setSummary(initialProblem.summary || '');
            setContent(initialProblem.content || '');
            
            // Explicitly sync data description and script
            if (initialProblem.dataDescription) setDataDescription(initialProblem.dataDescription);
            if (initialProblem.evaluationScript) setScriptContent(initialProblem.evaluationScript);
            
            setCoverImageUrl(initialProblem.coverImageUrl || '');
            setSelectedTagIds(initialProblem.tags || []);
            setSelectedMetricIds(initialProblem.metrics || []);
        }
    }, [initialProblem]);

    // Check if dataset exists on server
    const hasDatasetOnServer = (split: string) => {
        if (isNew || !initialProblem || initialProblem === 'new' || !initialProblem.datasets) return false;
        // Check dataset array from backend
        return initialProblem.datasets.some(d => d.split === split);
    };

    // Special check for ground truth which might be stored differently in older versions but unified now
    const hasGroundTruthOnServer = () => {
         if (isNew || !initialProblem || initialProblem === 'new') return false;
         // Check both the datasets array OR the hasGroundTruth flag from API
         return initialProblem.hasGroundTruth || initialProblem.datasets?.some(d => d.split === 'ground_truth');
    };

    const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverImageFile(file);
            setCoverImageUrl(URL.createObjectURL(file));
        }
    };

    const handleEditorImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && pendingImageInsert) {
            try {
                const formData = new FormData();
                formData.append('image', file);
                const res = await api.post('/media/upload', formData);
                if (res?.url) {
                    pendingImageInsert(res.url);
                }
            } catch (err) {
                alert("Upload ảnh thất bại.");
            }
        }
        e.target.value = '';
        setPendingImageInsert(null);
    };

    const triggerEditorImageUpload = (insertCallback: (url: string) => void) => {
        setPendingImageInsert(() => insertCallback);
        imageUploadRef.current?.click();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(
            { 
                name, difficulty, problemType, content, summary, 
                dataDescription, 
                evaluationScriptContent: scriptContent, 
                coverImageUrl: isNew ? null : coverImageUrl 
            },
            selectedTagIds,
            selectedMetricIds,
            { trainFile, testFile, groundTruthFile: gtFile, coverImage: coverImageFile }
        );
    };

    const filteredTags = useMemo(() => allTags.filter(t => !selectedTagIds.includes(t.id) && t.name.toLowerCase().includes(tagSearch.toLowerCase())), [allTags, selectedTagIds, tagSearch]);

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <input type="file" ref={imageUploadRef} hidden accept="image/*" onChange={handleEditorImageFileChange} />

            <div className="flex border-b overflow-x-auto">
                {[
                    { id: 'overview', label: 'Tổng quan', icon: Layout },
                    { id: 'data', label: 'Dữ liệu', icon: Database },
                    { id: 'evaluation', label: 'Code chấm điểm', icon: FileCode2 },
                    { id: 'meta', label: 'Cài đặt', icon: Info }
                ].map(t => (
                    <button 
                        key={t.id} 
                        type="button"
                        onClick={() => setActiveTab(t.id as any)}
                        className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === t.id ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}
                    >
                        <t.icon className="w-4 h-4"/> {t.label}
                    </button>
                ))}
            </div>

            <div className="p-8">
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Tên cuộc thi</label>
                                    <input value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="VD: Dự đoán giá nhà..." required />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Mô tả ngắn</label>
                                    <input value={summary} onChange={e => setSummary(e.target.value)} className="w-full p-3 border rounded-lg outline-none" placeholder="Tóm tắt ngắn gọn..." />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Độ khó</label>
                                        <select value={difficulty} onChange={e => setDifficulty(e.target.value as any)} className="w-full p-3 border rounded-lg outline-none bg-white">
                                            <option value="easy">Dễ</option>
                                            <option value="medium">Trung bình</option>
                                            <option value="hard">Khó</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Loại bài toán</label>
                                        <select value={problemType} onChange={e => setProblemType(e.target.value as any)} className="w-full p-3 border rounded-lg outline-none bg-white">
                                            <option value="classification">Phân loại</option>
                                            <option value="regression">Hồi quy</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Ảnh bìa</label>
                                <div className="border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center relative bg-slate-50 overflow-hidden group">
                                    {coverImageUrl ? (
                                        <>
                                            <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-white font-medium">Nhấn để thay đổi</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-6">
                                            <ImageIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                                            <p className="text-sm text-slate-500">Upload ảnh bìa (JPG, PNG)</p>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleCoverImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Chi tiết cuộc thi (Markdown)</label>
                            <MarkdownEditor 
                                value={content} 
                                onChange={setContent} 
                                placeholder="Mô tả chi tiết..." 
                                onImageUploadReq={triggerEditorImageUpload}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-6">
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="space-y-4">
                                <h4 className="font-bold text-slate-800">File dữ liệu (CSV)</h4>
                                
                                <div className="border rounded-lg p-4 bg-slate-50">
                                    <label className="block text-sm font-semibold mb-2 flex justify-between">
                                        Train Set (Public)
                                        {hasDatasetOnServer('train') && <span className="text-emerald-600 text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Đã có trên server</span>}
                                    </label>
                                    <div className="relative">
                                        <input type="file" accept=".csv" onChange={e => setTrainFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer w-full z-10" />
                                        <div className={`px-4 py-2 border rounded bg-white text-sm truncate ${trainFile ? 'text-indigo-600 border-indigo-200 bg-indigo-50' : 'text-slate-500'}`}>
                                            {trainFile ? trainFile.name : (hasDatasetOnServer('train') ? 'Giữ nguyên file cũ (Tải lên để thay thế)' : 'Chọn file...')}
                                        </div>
                                    </div>
                                </div>

                                <div className="border rounded-lg p-4 bg-slate-50">
                                    <label className="block text-sm font-semibold mb-2 flex justify-between">
                                        Test Set (Public)
                                        {hasDatasetOnServer('public_test') && <span className="text-emerald-600 text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Đã có trên server</span>}
                                    </label>
                                    <div className="relative">
                                        <input type="file" accept=".csv" onChange={e => setTestFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer w-full z-10" />
                                        <div className={`px-4 py-2 border rounded bg-white text-sm truncate ${testFile ? 'text-indigo-600 border-indigo-200 bg-indigo-50' : 'text-slate-500'}`}>
                                            {testFile ? testFile.name : (hasDatasetOnServer('public_test') ? 'Giữ nguyên file cũ (Tải lên để thay thế)' : 'Chọn file...')}
                                        </div>
                                    </div>
                                </div>

                                <div className="border rounded-lg p-4 bg-slate-50">
                                    <label className="block text-sm font-semibold mb-2 flex justify-between">
                                        Ground Truth (Hidden)
                                        {hasGroundTruthOnServer() && <span className="text-emerald-600 text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Đã có trên server</span>}
                                    </label>
                                    <div className="relative">
                                        <input type="file" accept=".csv" onChange={e => setGtFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer w-full z-10" />
                                        <div className={`px-4 py-2 border rounded bg-white text-sm truncate ${gtFile ? 'text-indigo-600 border-indigo-200 bg-indigo-50' : 'text-slate-500'}`}>
                                            {gtFile ? gtFile.name : (hasGroundTruthOnServer() ? 'Giữ nguyên file cũ (Tải lên để thay thế)' : 'Chọn file...')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Mô tả dữ liệu (Markdown)</label>
                                <MarkdownEditor 
                                    value={dataDescription} 
                                    onChange={setDataDescription} 
                                    placeholder="Giải thích các cột dữ liệu..."
                                    onImageUploadReq={triggerEditorImageUpload}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'evaluation' && (
                    <div className="h-[500px] flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <label className="font-bold text-slate-700 flex items-center gap-2">
                                Script chấm điểm (Python)
                                {!isNew && <span className="text-xs font-normal text-slate-500">(Hiện đang sử dụng script trên server)</span>}
                            </label>
                            <button type="button" onClick={() => scriptInputRef.current?.click()} className="text-xs bg-slate-100 px-3 py-1 rounded hover:bg-slate-200 font-medium">Upload .py</button>
                            <input ref={scriptInputRef} type="file" accept=".py" className="hidden" onChange={e => {
                                const f = e.target.files?.[0];
                                if(f) { const r = new FileReader(); r.onload=ev=>setScriptContent(ev.target?.result as string); r.readAsText(f); }
                            }}/>
                        </div>
                        <div className="flex-1 relative">
                             <textarea 
                                value={scriptContent} 
                                onChange={e => setScriptContent(e.target.value)} 
                                className="w-full h-full bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-sm resize-none leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none" 
                                spellCheck={false} 
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'meta' && (
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-bold mb-4">Chỉ số đánh giá (Metrics)</h4>
                            <div className="space-y-2 border rounded-xl p-4 h-64 overflow-y-auto">
                                {allMetrics.map(m => (
                                    <label key={m.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer">
                                        <input type="checkbox" checked={selectedMetricIds.includes(m.id)} onChange={e => {
                                            const s = new Set(selectedMetricIds); e.target.checked ? s.add(m.id) : s.delete(m.id); setSelectedMetricIds(Array.from(s));
                                        }} className="rounded text-indigo-600" />
                                        <div>
                                            <div className="font-medium text-sm">{m.key}</div>
                                            <div className="text-xs text-slate-500 uppercase">{m.direction}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold mb-4">Tags</h4>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {selectedTagIds.map(id => {
                                    const t = allTags.find(at => at.id === id);
                                    return t ? (
                                        <span key={id} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm flex items-center gap-1">
                                            {t.name} <button type="button" onClick={() => setSelectedTagIds(ids => ids.filter(i => i !== id))} className="hover:text-indigo-900">×</button>
                                        </span>
                                    ) : null;
                                })}
                            </div>
                            <input value={tagSearch} onChange={e => setTagSearch(e.target.value)} placeholder="Tìm tag..." className="w-full p-2 border rounded mb-2" />
                            <div className="flex flex-wrap gap-2">
                                {filteredTags.slice(0, 8).map(t => (
                                    <button type="button" key={t.id} onClick={() => {setSelectedTagIds([...selectedTagIds, t.id]); setTagSearch('')}} className="px-3 py-1 border rounded-full text-sm hover:bg-slate-50">
                                        + {t.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
                <button type="button" onClick={onCancel} className="px-6 py-2 rounded-lg border bg-white text-slate-700 hover:bg-slate-100 font-medium">Hủy</button>
                <button type="submit" disabled={loading} className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium flex items-center gap-2">
                    {loading ? <LoadingSpinner size="sm" color="white"/> : <><Save className="w-4 h-4"/> Lưu cuộc thi</>}
                </button>
            </div>
        </form>
    );
};