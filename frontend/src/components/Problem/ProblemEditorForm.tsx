import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { Problem, Tag, Metric, Difficulty, ProblemType } from '../../types';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { 
    Info, Tag as TagIcon, Upload, Eye, EyeOff, FileCode2, 
    Save, X, CheckCircle, Database, Layout, Image as ImageIcon
} from 'lucide-react';
import { api } from '../../api';

// --- TEMPLATES (ĐẦY ĐỦ, KHÔNG VIẾT TẮT) ---

const DEFAULT_PYTHON_SCRIPT = `# Python Evaluation Script Template
import sys
import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, f1_score, mean_squared_error

def evaluate(submission_path, ground_truth_path, public_test_path, output_path):
    """
    Hàm đánh giá chính.
    
    Args:
        submission_path (str): Đường dẫn tới file dự đoán của thí sinh (submission.csv).
        ground_truth_path (str): Đường dẫn tới file đáp án bí mật (ground_truth.csv).
        public_test_path (str): Đường dẫn tới file test public (test.csv) - thường ít dùng trong hàm này.
        output_path (str): Đường dẫn file để ghi kết quả điểm số (score.txt).
    """
    try:
        # 1. Đọc dữ liệu
        # Lưu ý: Giả định file CSV có header.
        sub_df = pd.read_csv(submission_path)
        gt_df = pd.read_csv(ground_truth_path)
        
        # 2. Kiểm tra định dạng cơ bản
        if 'id' not in sub_df.columns or 'prediction' not in sub_df.columns:
            raise ValueError("File nộp bài thiếu cột 'id' hoặc 'prediction'.")
            
        # Sắp xếp theo ID để đảm bảo khớp dữ liệu
        sub_df = sub_df.sort_values('id').reset_index(drop=True)
        gt_df = gt_df.sort_values('id').reset_index(drop=True)
        
        if len(sub_df) != len(gt_df):
            raise ValueError(f"Số lượng dòng không khớp. Kỳ vọng: {len(gt_df)}, Thực tế: {len(sub_df)}")

        # 3. Tính toán điểm số (Metric)
        # Ví dụ: Tính Accuracy cho bài toán phân loại
        score = accuracy_score(gt_df['target'], sub_df['prediction'])
        
        # Hoặc RMSE cho hồi quy (Bỏ comment để dùng):
        # score = np.sqrt(mean_squared_error(gt_df['target'], sub_df['prediction']))
        
        # 4. Ghi điểm số ra file (BẮT BUỘC)
        with open(output_path, 'w') as f:
            f.write(str(score))
            
    except Exception as e:
        # Ghi log lỗi (nếu cần) và trả về điểm 0 trong trường hợp lỗi hệ thống hoặc format
        # Có thể in ra stderr để debug trên server log
        print(f"Error evaluating: {str(e)}", file=sys.stderr)
        with open(output_path, 'w') as f:
            f.write('0.0')

if __name__ == '__main__':
    # Không chỉnh sửa 4 dòng dưới đây
    if len(sys.argv) < 5:
        print("Usage: python script.py <submission> <ground_truth> <test> <output>", file=sys.stderr)
        sys.exit(1)
    evaluate(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
`;

const DEFAULT_MARKDOWN_CONTENT = `# Giới thiệu bài toán

Chào mừng bạn đến với cuộc thi! Dưới đây là mô tả chi tiết về bài toán bạn cần giải quyết.

## 1. Bối cảnh
Hãy mô tả ngắn gọn về vấn đề thực tế. Ví dụ:
> "Sự kiện đắm tàu Titanic là một trong những thảm họa hàng hải nổi tiếng nhất lịch sử. Trong bài toán này, bạn cần xây dựng mô hình máy học để dự đoán hành khách nào có khả năng sống sót dựa trên các thông tin như tuổi, giới tính, hạng vé..."

## 2. Mục tiêu
Mục tiêu của bạn là dự đoán giá trị của cột \`target\` cho mỗi \`id\` trong tập kiểm tra (test set).
- **Input**: Các đặc trưng (features) của dữ liệu.
- **Output**: Nhãn dự đoán (0 hoặc 1 cho phân loại, số thực cho hồi quy).

## 3. Thang điểm & Đánh giá
Bài nộp sẽ được đánh giá dựa trên chỉ số **Accuracy** (Độ chính xác) hoặc **RMSE**.
$$ Accuracy = \\frac{TP + TN}{TP + TN + FP + FN} $$

## 4. Quy định
- Không được sử dụng dữ liệu bên ngoài.
- Mỗi đội được nộp tối đa 10 bài mỗi ngày.
- Chia sẻ code công khai trong phần Discussion được khuyến khích.
`;

const DEFAULT_DATA_DESCRIPTION = `# Mô tả dữ liệu

Bộ dữ liệu bao gồm các file sau:

## 1. File cấu trúc
- **train.csv**: Tập huấn luyện. Chứa các đặc trưng (features) và nhãn mục tiêu (\`target\`).
- **test.csv**: Tập kiểm tra. Chứa các đặc trưng nhưng **không có** nhãn mục tiêu. Bạn cần dự đoán cho tập này.
- **sample_submission.csv**: File mẫu định dạng nộp bài.

## 2. Chi tiết các trường dữ liệu (Columns)

| Tên cột | Kiểu dữ liệu | Mô tả chi tiết |
| :--- | :--- | :--- |
| \`id\` | Integer | Định danh duy nhất cho mỗi mẫu. |
| \`Pclass\` | Integer | Hạng vé (1 = Hạng nhất, 2 = Hạng nhì, 3 = Hạng ba). |
| \`Sex\` | String | Giới tính (male/female). |
| \`Age\` | Float | Tuổi của hành khách. |
| \`SibSp\` | Integer | Số lượng anh chị em/vợ chồng đi cùng. |
| \`Parch\` | Integer | Số lượng bố mẹ/con cái đi cùng. |
| \`Fare\` | Float | Giá vé. |
| \`Embarked\`| String | Cổng lên tàu (C = Cherbourg, Q = Queenstown, S = Southampton). |

## 3. Ghi chú quan trọng
- Cột \`Age\` có một số giá trị bị thiếu (NaN), bạn cần xử lý (ví dụ: điền bằng trung bình hoặc trung vị).
- Cột \`Cabin\` có rất nhiều giá trị thiếu, hãy cân nhắc khi sử dụng.
`;

interface ProblemEditorFormProps {
    initialProblem: Problem | "new";
    onSave: (
        data: any, 
        tagIds: number[],
        metricIds: number[],
        files: { trainFile: File | null; testFile: File | null; groundTruthFile: File | null }
    ) => void;
    onCancel: () => void;
    allTags: Tag[];
    allMetrics: Metric[];
    loading: boolean;
}

export const ProblemEditorForm: React.FC<ProblemEditorFormProps> = ({
    initialProblem, onSave, onCancel, allTags, allMetrics, loading,
}) => {
    const isNew = initialProblem === 'new';
    const [name, setName] = useState(isNew ? '' : initialProblem.name);
    const [difficulty, setDifficulty] = useState<Difficulty>(isNew ? 'easy' : initialProblem.difficulty);
    const [problemType, setProblemType] = useState<ProblemType>(isNew ? 'classification' : initialProblem.problemType);
    
    // Sử dụng Template mặc định nếu là bài mới
    const [content, setContent] = useState(isNew ? DEFAULT_MARKDOWN_CONTENT : initialProblem.content);
    const [dataDescription, setDataDescription] = useState(isNew ? DEFAULT_DATA_DESCRIPTION : (initialProblem.dataDescription || DEFAULT_DATA_DESCRIPTION));
    const [scriptContent, setScriptContent] = useState<string>(isNew ? DEFAULT_PYTHON_SCRIPT : (initialProblem.evaluationScript || DEFAULT_PYTHON_SCRIPT));

    const [summary, setSummary] = useState(isNew ? '' : initialProblem.summary || '');
    const [coverImageUrl, setCoverImageUrl] = useState(isNew ? '' : initialProblem.coverImageUrl || '');
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>(isNew ? [] : initialProblem.tags || []);
    const [selectedMetricIds, setSelectedMetricIds] = useState<number[]>(isNew ? [] : initialProblem.metrics || []);
    
    const [trainFile, setTrainFile] = useState<File | null>(null);
    const [testFile, setTestFile] = useState<File | null>(null);
    const [groundTruthFile, setGroundTruthFile] = useState<File | null>(null);
    
    const [activeTab, setActiveTab] = useState<'overview' | 'data' | 'evaluation' | 'meta'>('overview');
    const [tagSearch, setTagSearch] = useState('');
    const [uploadingImg, setUploadingImg] = useState(false);
    
    const scriptFileReaderRef = useRef<HTMLInputElement>(null);
    const imageUploadRef = useRef<HTMLInputElement>(null);

    const availableTags = useMemo(() => {
        return allTags.filter(t => !selectedTagIds.includes(t.id) && t.name.toLowerCase().includes(tagSearch.toLowerCase()));
    }, [allTags, selectedTagIds, tagSearch]);

    const handleScriptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => { if (typeof ev.target?.result === 'string') setScriptContent(ev.target.result); };
            reader.readAsText(file);
        }
        e.target.value = '';
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingImg(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await api.post('/media/upload', formData);
            if (res?.url) {
                const imgMarkdown = `\n![${file.name}](${res.url})\n`;
                if (activeTab === 'data') {
                    setDataDescription(prev => prev + imgMarkdown);
                } else {
                    setContent(prev => prev + imgMarkdown);
                }
            }
        } catch (err) {
            console.error("Upload failed", err);
            alert("Upload ảnh thất bại. Vui lòng thử lại.");
        } finally {
            setUploadingImg(false);
            e.target.value = '';
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ 
            name, difficulty, problemType, content, summary, coverImageUrl, 
            dataDescription, 
            evaluationScriptContent: scriptContent 
        }, selectedTagIds, selectedMetricIds, { trainFile, testFile, groundTruthFile });
    };

    const MarkdownEditorWithPreview = ({ value, onChange, placeholder }: { value: string, onChange: (s: string) => void, placeholder: string }) => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
            <div className="flex flex-col h-full relative group">
                 <div className="absolute top-2 right-2 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        type="button"
                        onClick={() => imageUploadRef.current?.click()}
                        disabled={uploadingImg}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-600 text-xs font-medium"
                        title="Chèn ảnh"
                    >
                        {uploadingImg ? <LoadingSpinner size="sm"/> : <ImageIcon className="w-4 h-4"/>}
                        Chèn ảnh
                    </button>
                 </div>
                <textarea 
                    value={value} 
                    onChange={(e) => onChange(e.target.value)} 
                    className="flex-1 w-full p-4 pt-10 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm resize-none leading-relaxed" 
                    placeholder={placeholder} 
                />
            </div>
            <div className="h-full overflow-y-auto border border-slate-200 rounded-xl p-6 bg-white prose prose-slate prose-sm max-w-none shadow-sm">
                {value ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {value}
                    </ReactMarkdown>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 italic">
                        <EyeOff className="w-8 h-8 mb-2 opacity-50"/>
                        <span>Bản xem trước sẽ hiện ở đây...</span>
                    </div>
                )}
            </div>
        </div>
    );

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all duration-200 border-b-2 ${
                activeTab === id 
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
        >
            <Icon className={`w-4 h-4 ${activeTab === id ? 'text-indigo-600' : 'text-slate-400'}`} />
            {label}
        </button>
    );

    const FileUploadBox = ({ label, description, fileState, setFile, required, isUpdateAndExisting }: any) => (
        <div className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 group ${fileState ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-800 mb-1 group-hover:text-indigo-700 transition-colors">
                        {label} {required && <span className="text-red-500">*</span>}
                    </label>
                    <p className="text-xs text-slate-500 mb-3 leading-relaxed">{description}</p>
                    
                    <div className="flex items-center gap-3">
                        <label className="cursor-pointer">
                            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-300 transition-all">
                                <Upload className="w-4 h-4" /> Chọn File
                            </span>
                            <input type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                        </label>
                        {fileState ? (
                            <span className="text-sm text-emerald-600 font-medium flex items-center gap-1 animate-fade-in">
                                <CheckCircle className="w-4 h-4" /> {fileState.name}
                            </span>
                        ) : isUpdateAndExisting ? (
                            <span className="text-sm text-slate-500 italic flex items-center gap-1">
                                <Database className="w-4 h-4" /> Đã có trên server
                            </span>
                        ) : (
                            <span className="text-sm text-slate-400 italic">Chưa chọn file</span>
                        )}
                    </div>
                </div>
            </div>
            {fileState && (
                <button type="button" onClick={() => setFile(null)} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             <input type="file" ref={imageUploadRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

            <div className="flex border-b border-slate-200 bg-white sticky top-0 z-20 px-4">
                <TabButton id="overview" label="Tổng quan" icon={Layout} />
                <TabButton id="data" label="Dữ liệu" icon={Database} />
                <TabButton id="evaluation" label="Đánh giá (Script)" icon={FileCode2} />
                <TabButton id="meta" label="Cài đặt khác" icon={TagIcon} />
            </div>

            <div className="p-6 md:p-8 min-h-[500px]">
                {/* TAB: OVERVIEW */}
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-800 mb-1">Tên bài toán <span className="text-red-500">*</span></label>
                                    <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-semibold" placeholder="VD: Titanic Survival Prediction" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-800 mb-1">Mô tả ngắn</label>
                                    <input value={summary} onChange={(e) => setSummary(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="Mô tả ngắn gọn hiển thị trên thẻ..." />
                                </div>
                            </div>
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Độ khó</label>
                                    <div className="flex gap-2">
                                        {(['easy', 'medium', 'hard'] as const).map(d => (
                                            <button key={d} type="button" onClick={() => setDifficulty(d)} className={`flex-1 py-1.5 text-sm font-medium rounded-md border capitalize transition-all ${difficulty === d ? 'bg-white border-indigo-500 text-indigo-700 shadow-sm ring-1 ring-indigo-500' : 'bg-transparent border-slate-300 text-slate-600 hover:bg-white'}`}>{d}</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Loại bài toán</label>
                                    <select value={problemType} onChange={(e) => setProblemType(e.target.value as any)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none">
                                        <option value="classification">Phân loại</option>
                                        <option value="regression">Hồi quy</option>
                                        <option value="other">Khác</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Ảnh bìa (URL)</label>
                                    <input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none" placeholder="https://..." />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-200 pt-6">
                            <label className="block text-sm font-bold text-slate-800 mb-2">Chi tiết bài toán (Markdown)</label>
                            <MarkdownEditorWithPreview value={content} onChange={setContent} placeholder="Mô tả chi tiết bài toán..." />
                        </div>
                    </div>
                )}

                {/* TAB: DATA */}
                {activeTab === 'data' && (
                    <div className="space-y-8 animate-fade-in">
                         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1 space-y-4">
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                                    <h5 className="flex items-center gap-2 text-sm font-bold text-blue-800 mb-1"><Info className="w-4 h-4"/> Lưu ý file</h5>
                                    <p className="text-xs text-blue-700">Chỉ chấp nhận file <strong>.csv</strong>. File Ground Truth dùng để chấm điểm và được bảo mật tuyệt đối.</p>
                                </div>
                                <h4 className="font-bold text-slate-800">Upload File</h4>
                                <FileUploadBox label="Train Data (Public)" description="Dữ liệu huấn luyện có nhãn." fileState={trainFile} setFile={setTrainFile} required={isNew} isUpdateAndExisting={!isNew} />
                                <FileUploadBox label="Test Data (Public)" description="Dữ liệu kiểm tra không nhãn." fileState={testFile} setFile={setTestFile} required={isNew} isUpdateAndExisting={!isNew} />
                                <FileUploadBox label="Ground Truth (Hidden)" description="Đáp án đúng (bí mật)." fileState={groundTruthFile} setFile={setGroundTruthFile} required={isNew} isUpdateAndExisting={!isNew && initialProblem.hasGroundTruth} />
                            </div>
                            
                            <div className="lg:col-span-2 flex flex-col h-full">
                                <h4 className="font-bold text-slate-800 mb-2">Mô tả Dữ liệu (Markdown & LaTeX)</h4>
                                <div className="flex-1 min-h-[400px]">
                                     <MarkdownEditorWithPreview 
                                        value={dataDescription} 
                                        onChange={setDataDescription} 
                                        placeholder="Mô tả chi tiết về dữ liệu..." 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: EVALUATION */}
                {activeTab === 'evaluation' && (
                    <div className="animate-fade-in h-[600px] flex flex-col">
                         <div className="flex justify-between items-end mb-4">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                    <FileCode2 className="w-4 h-4 text-indigo-600" /> Evaluation Script (Python)
                                </label>
                                <p className="text-xs text-slate-500 mt-1">Hàm <code>evaluate</code> dùng để chấm điểm submission.</p>
                            </div>
                            <button type="button" onClick={() => scriptFileReaderRef.current?.click()} className="text-sm px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition font-medium flex items-center gap-2 shadow-sm">
                                <Upload className="w-4 h-4"/> Upload .py
                            </button>
                            <input type="file" ref={scriptFileReaderRef} className="hidden" accept=".py,.txt" onChange={handleScriptFileChange}/>
                        </div>
                        <div className="relative flex-1 rounded-xl overflow-hidden border border-slate-700 shadow-inner bg-[#1e1e1e]">
                            <textarea value={scriptContent} onChange={(e) => setScriptContent(e.target.value)} className="absolute inset-0 w-full h-full p-4 bg-transparent text-slate-200 font-mono text-sm leading-relaxed resize-none focus:outline-none" spellCheck={false} />
                        </div>
                    </div>
                )}

                {/* TAB: META */}
                {activeTab === 'meta' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-fade-in">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-4">Metrics (Chỉ số)</h3>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {allMetrics.map(m => (
                                    <label key={m.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${selectedMetricIds.includes(m.id) ? 'bg-white border-indigo-200 shadow-sm' : 'hover:bg-white border-transparent'}`}>
                                        <input type="checkbox" checked={selectedMetricIds.includes(m.id)} onChange={(e) => { const s = new Set(selectedMetricIds); e.target.checked ? s.add(m.id) : s.delete(m.id); setSelectedMetricIds(Array.from(s)); }} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                                        <div className="flex-1">
                                            <span className="text-sm font-medium text-slate-700 block">{m.key}</span>
                                            <span className="text-xs text-slate-400 uppercase">{m.direction}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-4">Tags</h3>
                             <div className="mb-4">
                                <input value={tagSearch} onChange={e => setTagSearch(e.target.value)} placeholder="Tìm kiếm tag..." className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none" />
                            </div>
                            <div className="flex flex-wrap gap-2 mb-6">
                                {selectedTagIds.map(id => {
                                    const tag = allTags.find(t => t.id === id);
                                    if (!tag) return null;
                                    return (
                                        <span key={id} className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium border border-indigo-200">
                                            {tag.name}
                                            <button type="button" onClick={() => setSelectedTagIds(ids => ids.filter(i => i !== id))} className="ml-2 hover:text-indigo-900">×</button>
                                        </span>
                                    )
                                })}
                            </div>
                             <div className="border-t border-slate-200 pt-4">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Gợi ý</p>
                                <div className="flex flex-wrap gap-2">
                                    {availableTags.slice(0, 10).map(tag => (
                                        <button key={tag.id} type="button" onClick={() => { setSelectedTagIds([...selectedTagIds, tag.id]); setTagSearch(''); }} className="px-3 py-1 rounded-full bg-white border border-slate-300 text-slate-600 text-sm hover:border-indigo-400 hover:text-indigo-600 transition-colors">
                                            + {tag.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-4 sticky bottom-0 z-20">
                <button type="button" onClick={onCancel} disabled={loading} className="px-6 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-white transition-all">Hủy</button>
                <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2">
                    {loading ? <LoadingSpinner size="sm" color="white"/> : <><Save className="w-4 h-4" /> Lưu bài toán</>}
                </button>
            </div>
        </form>
    );
};