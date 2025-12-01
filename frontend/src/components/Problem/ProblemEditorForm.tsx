import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; // Import KaTeX CSS
import type { Problem, Tag, Metric, Difficulty, ProblemType } from '../../types';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { Info, Tag as TagIcon, BarChart3, Upload, FileText, X, Plus, Check, Eye, EyeOff, FileCode2, FileUp } from 'lucide-react';

interface ProblemEditorFormProps {
    initialProblem: Problem | "new";
    onSave: (
        data: Partial<Problem> & { evaluationScriptContent: string },
        tagIds: number[],
        metricIds: number[],
        // *** MODIFIED: Added groundTruthFile to the type definition ***
        files: { trainFile: File | null; testFile: File | null; groundTruthFile: File | null }
    ) => void;
    onCancel: () => void;
    allTags: Tag[];
    allMetrics: Metric[];
    loading: boolean;
}

// Default script content remains the same
const defaultFormatCheckScript = `# Script chấm điểm mẫu - Hướng dẫn chi tiết
# Vui lòng đọc kỹ các bình luận để đảm bảo script của bạn hoạt động chính xác.

import sys
import pandas as pd
import traceback
# Thêm các thư viện cần thiết cho việc tính điểm của bạn, ví dụ:
from sklearn.metrics import accuracy_score

# HỢP ĐỒNG QUAN TRỌNG:
# Script này phải nhận chính xác 4 đối số dòng lệnh theo thứ tự:
# 1. submission_path: Đường dẫn đến file .csv do người dùng nộp.
# 2. ground_truth_path: Đường dẫn đến file .csv chứa đáp án (solution).
# 3. public_test_path: Đường dẫn đến file .csv test công khai (dùng để kiểm tra định dạng).
# 4. output_path: Đường dẫn đến file .txt nơi script phải ghi điểm số cuối cùng.

# QUY TẮC GHI ĐIỂM VÀO FILE OUTPUT:
# - Luôn ghi một số thực (float).
# - Nếu sai định dạng hoặc lỗi tính điểm: ghi "0.0".
# - Nếu thành công: ghi điểm >= 0 (phụ thuộc metric).

# QUY TẮC EXIT CODE:
# - sys.exit(1): Nếu xảy ra lỗi (định dạng hoặc tính điểm). Script SẼ ghi 0.0 vào output_path TRƯỚC KHI exit.
# - sys.exit(0) hoặc không gọi exit: Nếu script chạy thành công và ghi điểm >= 0 vào output_path.

def evaluate(submission_path, ground_truth_path, public_test_path, output_path):
    """
    Quy trình khuyến nghị:
    1. Bọc logic kiểm tra định dạng trong một khối try...except ValueError.
       - Nếu có lỗi định dạng, bắt ValueError, ghi 0.0 vào output_path và gọi sys.exit(1).
    2. Nếu định dạng đúng, thực hiện tính điểm.
       - Bọc logic tính điểm trong một khối try...except chung (Exception).
       - Nếu có lỗi trong quá trình này (kể cả đọc ground truth), bắt Exception, ghi 0.0 vào output_path và gọi sys.exit(1).
    3. Nếu tính điểm thành công, ghi điểm số (>= 0) vào output_path. Script sẽ tự động kết thúc với exit code 0.
    """
    required_columns = ['id', 'prediction']
    final_score = 0.0 # Mặc định 0.0 nếu có lỗi xảy ra sớm

    try:
        # === PHẦN 1: KIỂM TRA ĐỊNH DẠNG ===
        print("Bắt đầu kiểm tra định dạng...")
        try:
            sub_df = pd.read_csv(submission_path)
            test_df = pd.read_csv(public_test_path) # Cần file test để so sánh cấu trúc
        except Exception as e:
            # Lỗi đọc file submission hoặc public test được coi là lỗi định dạng
            raise ValueError(f"Không thể đọc file submission hoặc public test: {e}")

        # 1.1 Kiểm tra các cột bắt buộc
        missing_cols = [col for col in required_columns if col not in sub_df.columns]
        if missing_cols:
            raise ValueError(f"File submission thiếu các cột bắt buộc: {missing_cols}")

        # 1.2 Kiểm tra số dòng (so với public test)
        if len(sub_df) != len(test_df):
            raise ValueError(f"File submission có {len(sub_df)} dòng, nhưng file test yêu cầu {len(test_df)} dòng.")

        # 1.3 Kiểm tra cột 'id' (so với public test)
        if 'id' in test_df.columns:
             # Sắp xếp cả hai cột ID trước khi so sánh để đảm bảo thứ tự không ảnh hưởng
            sub_ids_sorted = sub_df['id'].sort_values().reset_index(drop=True)
            test_ids_sorted = test_df['id'].sort_values().reset_index(drop=True)
            if not sub_ids_sorted.equals(test_ids_sorted):
                raise ValueError("Cột 'id' trong file submission không khớp hoàn toàn với file test.")
        else:
             print("Cảnh báo: File public test không có cột 'id' để đối chiếu.")


        # 1.4 Kiểm tra giá trị null/NaN trong toàn bộ file submission
        if sub_df.isnull().values.any():
            raise ValueError("File submission chứa giá trị thiếu (NaN/Null).")

        # 1.5 Kiểm tra kiểu dữ liệu cột 'prediction' (phải là số)
        if not pd.api.types.is_numeric_dtype(sub_df['prediction']):
             # Kiểm tra cụ thể hơn xem có phải string không
             if pd.api.types.is_string_dtype(sub_df['prediction']):
                 try:
                     # Thử chuyển đổi sang số, nếu thành công thì OK, nếu lỗi thì raise ValueError
                     pd.to_numeric(sub_df['prediction'])
                 except ValueError:
                     raise ValueError("Cột 'prediction' chứa giá trị không phải số.")
             else:
                raise ValueError("Cột 'prediction' phải chứa dữ liệu dạng số.")


        # (Optional) Thêm kiểm tra đặc thù cho loại bài toán, VẪN thuộc lỗi định dạng (0.0)
        # Ví dụ: Classification - prediction phải là 0 hoặc 1
        # problem_type = "classification" # Lấy từ đâu đó nếu cần, hoặc giả định
        # if problem_type == "classification":
        #     if not sub_df['prediction'].isin([0, 1]).all():
        #         raise ValueError("Với bài toán classification, cột 'prediction' chỉ được chứa 0 hoặc 1.")
        # Ví dụ: Regression - prediction không âm
        # problem_type = "regression"
        # if problem_type == "regression":
        #      if (sub_df['prediction'] < 0).any():
        #          raise ValueError("Với bài toán regression, cột 'prediction' không được chứa giá trị âm.")

        print("--- Định dạng OK ---")

        # === PHẦN 2: TÍNH ĐIỂM ===
        print("Bắt đầu tính điểm...")
        final_score = 0.0 # Đặt mặc định là 0.0 NẾU có lỗi xảy ra TRONG PHẦN NÀY

        # 2.1 Đọc file Ground Truth (Lỗi ở đây coi là lỗi tính toán -> 0.0)
        try:
            gt_df = pd.read_csv(ground_truth_path)
        except Exception as e:
            # Không thể đọc ground truth, không thể chấm điểm -> Lỗi tính toán
            raise RuntimeError(f"Không thể đọc file ground truth: {e}")

        # 2.2 Merge submission và ground truth (Lỗi ở đây coi là lỗi tính toán -> 0.0)
        # Đảm bảo cả hai DataFrame có cột 'id'
        if 'id' not in gt_df.columns:
            raise RuntimeError("File ground truth thiếu cột 'id'.")
        # Đảm bảo merge thành công và đủ số dòng
        try:
            # Chỉ merge các cột cần thiết
            merged_df = pd.merge(sub_df[['id', 'prediction']], gt_df, on='id', how='inner')
            if len(merged_df) != len(sub_df):
                 # Nếu số dòng không khớp sau khi merge, có thể do ID không khớp hoàn toàn
                 raise RuntimeError(f"Lỗi khi kết hợp submission và ground truth. Số dòng không khớp ({len(merged_df)} vs {len(sub_df)}). Kiểm tra lại cột 'id'.")
        except Exception as e:
            raise RuntimeError(f"Lỗi không xác định khi merge submission và ground truth: {e}")


        # 2.3 Thực hiện tính điểm (Lỗi ở đây coi là lỗi tính toán -> 0.0)
        # !!! THAY THẾ LOGIC TÍNH ĐIỂM CỦA BẠN VÀO ĐÂY !!!
        # Cần cột target từ ground truth (ví dụ: 'Outcome', 'SalePrice')
        target_column = 'Outcome' # <<<< THAY TÊN CỘT TARGET Ở ĐÂY
        if target_column not in merged_df.columns:
            raise RuntimeError(f"File ground truth thiếu cột target '{target_column}'.")

        try:
            # Ví dụ tính accuracy cho bài toán classification
            # Giả định prediction có thể là số thực, cần làm tròn hoặc xử lý phù hợp
            calculated_score = accuracy_score(merged_df[target_column], merged_df['prediction'].round().astype(int))

            # Ví dụ tính RMSE cho bài toán regression
            # from sklearn.metrics import mean_squared_error
            # import numpy as np
            # calculated_score = np.sqrt(mean_squared_error(merged_df[target_column], merged_df['prediction']))

        except Exception as e:
            # Bắt mọi lỗi xảy ra trong quá trình tính toán
            raise RuntimeError(f"Lỗi trong quá trình tính điểm: {e}")

        # 2.4 Kiểm tra điểm hợp lệ và gán
        if calculated_score < 0:
             # Điểm tính ra không hợp lệ (ví dụ: một số metric có thể âm?)
             # Quyết định xử lý: coi là lỗi (0.0) hay chấp nhận điểm âm?
             # Ở đây ta coi điểm âm là lỗi -> 0.0
            raise RuntimeError(f"Điểm tính toán không hợp lệ ({calculated_score}), phải >= 0.")

        final_score = calculated_score # Gán điểm số cuối cùng nếu tính toán thành công
        print(f"Điểm tính được: {final_score}")
        print("--- Tính điểm OK ---")

    except ValueError as format_error:
        # Bắt lỗi định dạng từ PHẦN 1 -> 0.0 điểm
        print(f"LỖI ĐỊNH DẠNG: {format_error}", file=sys.stderr)
        final_score = 0.0
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(str(final_score))
        except Exception as write_e:
            print(f"Lỗi nghiêm trọng: Không thể ghi điểm lỗi định dạng (0.0) vào file output: {write_e}", file=sys.stderr)
        sys.exit(1)

    except Exception as calc_error:
        # Bắt lỗi tính toán hoặc các lỗi khác từ PHẦN 2 (RuntimeError, etc.) -> 0.0 điểm
        print(f"LỖI TÍNH TOÁN/KHÁC: {calc_error}", file=sys.stderr)
        print(f"Traceback:\n{traceback.format_exc()}", file=sys.stderr)
        final_score = 0.0
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(str(final_score))
        except Exception as write_e:
            print(f"Lỗi nghiêm trọng: Không thể ghi điểm lỗi tính toán (0.0) vào file output: {write_e}", file=sys.stderr)
        sys.exit(1)

    # === PHẦN 3: GHI ĐIỂM THÀNH CÔNG ===
    # Chỉ chạy đến đây nếu không có exception nào ở trên xảy ra
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            # Ghi điểm số cuối cùng (đã được kiểm tra >= 0)
            f.write(str(final_score))
        print(f"Ghi điểm cuối cùng thành công: {final_score}")
    except Exception as e:
        # Nếu lỗi ở bước cuối cùng này, rất khó xử lý, in lỗi ra stderr và thoát
        print(f"Lỗi nghiêm trọng: Không thể ghi điểm cuối cùng ({final_score}) vào file output: {e}", file=sys.stderr)
        # Thoát với mã lỗi 1 để báo hiệu thất bại
        sys.exit(1)

# Entry point khi chạy script
if __name__ == "__main__":
    # Kiểm tra số lượng arguments
    if len(sys.argv) != 5:
        print("Lỗi: Script cần đúng 4 arguments: <submission_path> <ground_truth_path> <public_test_path> <output_path>", file=sys.stderr)
        # Ghi điểm lỗi mặc định (0.0) nếu có thể để backend biết đây là lỗi setup
        # Điều này hơi khó vì output_path có thể không đúng, nhưng thử ghi vào argument cuối nếu có
        if len(sys.argv) > 4:
            try:
                with open(sys.argv[4], 'w', encoding='utf-8') as f_err: f_err.write("0.0")
            except Exception: pass # Bỏ qua nếu không ghi được
        sys.exit(1) # Thoát với mã lỗi

    # Lấy arguments
    submission_file = sys.argv[1]
    ground_truth_file = sys.argv[2]
    public_test_file = sys.argv[3]
    output_file = sys.argv[4]

    # Gọi hàm evaluate
    evaluate(submission_file, ground_truth_file, public_test_file, output_file)

    # Script kết thúc bình thường (exit code 0) nếu không có lỗi nào được raise và sys.exit(1) không được gọi
    print("Chấm điểm hoàn tất.")

`;

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
    const [content, setContent] = useState(isNew ? "## Mô tả\n\nGiới thiệu ngắn gọn bài toán và mục tiêu.\n\n## Giới thiệu dữ liệu\n- `train.csv`: dữ liệu huấn luyện có cả nhãn.\n- `test.csv`: dữ liệu kiểm tra công khai (không có nhãn).\n- Nêu rõ các cột bắt buộc, kiểu dữ liệu, và yêu cầu làm sạch.\n\n## Nộp bài & Format\n- File `submission.csv` gồm 2 cột: `id` và `prediction`.\n- Số dòng phải khớp `test.csv`, thứ tự và id phải chính xác.\n- Nếu file sai định dạng/thiếu dữ liệu: điểm sẽ là **0.0**.\n\n## Cách tính điểm\n- Chỉ rõ metric chính, ví dụ: Accuracy / RMSE.\n- Nếu xảy ra lỗi khi tính điểm (overflow, NaN, chia cho 0...): điểm cũng **0.0**.\n- Có thể nêu ví dụ minh họa.\n\n## Gợi ý\nSử dụng **Markdown** và công thức LaTeX như $E=mc^2$ hoặc:\n\n$$\\frac{1}{N} \\sum_{i=1}^{N} (y_i - \\hat{y}_i)^2$$\n" : initialProblem.content);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>(isNew ? [] : (initialProblem.tags || []));
    const [selectedMetricIds, setSelectedMetricIds] = useState<number[]>(isNew ? [] : (initialProblem.metrics || []));
    const [trainFile, setTrainFile] = useState<File | null>(null);
    const [testFile, setTestFile] = useState<File | null>(null);
    const [groundTruthFile, setGroundTruthFile] = useState<File | null>(null);
    const [scriptContent, setScriptContent] = useState<string>(isNew ? defaultFormatCheckScript : (initialProblem.evaluationScript || defaultFormatCheckScript));
    const [showPreview, setShowPreview] = useState(true);
    const scriptFileReaderRef = useRef<HTMLInputElement>(null);
    const [tagSearch, setTagSearch] = useState('');
    const [showTagDropdown, setShowTagDropdown] = useState(false);

    // Difficulty options
    const difficulties = [
        { value: 'easy', label: 'Dễ', color: 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100 focus:ring-green-300' },
        { value: 'medium', label: 'Trung bình', color: 'text-yellow-600 bg-yellow-50 border-yellow-200 hover:bg-yellow-100 focus:ring-yellow-300' },
        { value: 'hard', label: 'Khó', color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100 focus:ring-red-300' }
    ];

    // --- Effects ---
    useEffect(() => {
        if (initialProblem === "new") {
            setName(""); setDifficulty("easy"); setProblemType("classification");
            setContent("## Mô tả\n\nGiới thiệu ngắn gọn bài toán và mục tiêu.\n\n## Giới thiệu dữ liệu\n- `train.csv`: dữ liệu huấn luyện có cả nhãn.\n- `test.csv`: dữ liệu kiểm tra công khai (không có nhãn).\n- Nêu rõ các cột bắt buộc, kiểu dữ liệu, và yêu cầu làm sạch.\n\n## Nộp bài & Format\n- File `submission.csv` gồm 2 cột: `id` và `prediction`.\n- Số dòng phải khớp `test.csv`, thứ tự và id phải chính xác.\n- Nếu file sai định dạng/thiếu dữ liệu: điểm sẽ là **0.0**.\n\n## Cách tính điểm\n- Chỉ rõ metric chính, ví dụ: Accuracy / RMSE.\n- Nếu xảy ra lỗi khi tính điểm (overflow, NaN, chia cho 0...): điểm cũng **0.0**.\n- Có thể nêu ví dụ minh họa.\n\n## Gợi ý\nSử dụng **Markdown** và công thức LaTeX như $E=mc^2$ hoặc:\n\n$$\\frac{1}{N} \\sum_{i=1}^{N} (y_i - \\hat{y}_i)^2$$\n");
            setSelectedTagIds([]); setSelectedMetricIds([]); setTrainFile(null); setTestFile(null); setGroundTruthFile(null);
            setScriptContent(defaultFormatCheckScript);
        } else {
            setName(initialProblem.name); setDifficulty(initialProblem.difficulty); setProblemType(initialProblem.problemType);
            setContent(initialProblem.content); setSelectedTagIds(initialProblem.tags || []); setSelectedMetricIds(initialProblem.metrics || []);
            setTrainFile(null); setTestFile(null); setGroundTruthFile(null);
             setScriptContent(initialProblem.evaluationScript || defaultFormatCheckScript);
        }
    }, [initialProblem]);

    // --- Tag Handling ---
    const handleAddTagById = (tagId: number) => { if (!selectedTagIds.includes(tagId)) { setSelectedTagIds(prev => [...prev, tagId]); } setTagSearch(''); setShowTagDropdown(false); };
    const handleRemoveTag = (tagIdToRemove: number) => { setSelectedTagIds(prev => prev.filter(id => id !== tagIdToRemove)); };
    const filteredTags = useMemo(() => { if (!tagSearch) return allTags.filter(tag => !selectedTagIds.includes(tag.id)); return allTags.filter(tag => !selectedTagIds.includes(tag.id) && tag.name.toLowerCase().includes(tagSearch.toLowerCase())); }, [tagSearch, allTags, selectedTagIds]);
    const selectedTagObjects = useMemo(() => { return selectedTagIds.map(id => allTags.find(tag => tag.id === id)).filter(Boolean) as Tag[]; }, [selectedTagIds, allTags]);

    // --- Metric Handling ---
    const handleMetricChange = (metricId: number, checked: boolean) => { setSelectedMetricIds(prev => checked ? [...prev, metricId] : prev.filter(id => id !== metricId)); };

    // --- Script File Reading ---
    const handleScriptFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => { const text = e.target?.result; if (typeof text === 'string') { setScriptContent(text); } else { alert("Không thể đọc nội dung file script."); } }; reader.onerror = () => { alert("Lỗi khi đọc file script."); }; reader.readAsText(file); } event.target.value = ''; };

    // --- Submit Handler ---
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !content.trim() || !scriptContent.trim()) {
            alert("Vui lòng điền tên, nội dung, và script chấm điểm."); return;
        }
        if (isNew && (!trainFile || !testFile || !groundTruthFile)) {
             alert("Vui lòng tải lên đủ file train, test (public), và ground truth cho bài toán mới."); return;
        }
        const problemData: Partial<Problem> & { evaluationScriptContent: string } = { name, difficulty, problemType, content, evaluationScriptContent: scriptContent };
        // *** FIXED: Pass groundTruthFile in the files object ***
        onSave(problemData, selectedTagIds, selectedMetricIds, { trainFile, testFile, groundTruthFile });
    };

    // --- File Info ---
    const currentTrainFileMeta = !isNew && Array.isArray(initialProblem.datasets) ? initialProblem.datasets.find(d => d.split === 'train') : undefined;
    const currentTestFileMeta = !isNew && Array.isArray(initialProblem.datasets) ? initialProblem.datasets.find(d => d.split === 'public_test') : undefined;
    const currentGroundTruthExists = !isNew && initialProblem.hasGroundTruth; // Assuming hasGroundTruth indicates content presence

    // --- Render ---
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center"> <Info className="w-5 h-5 mr-2 text-indigo-600" /> Thông tin cơ bản </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div> <label htmlFor="problemName" className="input-label">Tên bài toán</label> <input id="problemName" value={name} onChange={(e) => setName(e.target.value)} required className="input-style" placeholder="vd: Dự đoán giá nhà" /> </div>
                    <div> <label className="input-label">Độ khó</label> <div className="flex flex-wrap gap-2"> {difficulties.map(diff => ( <button type="button" key={diff.value} onClick={() => setDifficulty(diff.value as Difficulty)} className={`difficulty-button ${ difficulty === diff.value ? diff.color + ' ring-2 ring-offset-1' : 'inactive-difficulty'}`}> {diff.label} </button> ))} </div> </div>
                    <div> <label htmlFor="problemType" className="input-label">Loại bài toán</label> <select id="problemType" value={problemType} onChange={(e) => setProblemType(e.target.value as ProblemType)} className="input-style bg-white"> <option value="classification">Phân loại (Classification)</option> <option value="regression">Hồi quy (Regression)</option> </select> </div>
                     <div className="md:col-span-1"> <label className="input-label">Metric (Chỉ để hiển thị)</label> <div className="metric-list-container"> {allMetrics.length === 0 && <p className="text-xs text-slate-500 italic">Chưa có metric.</p>} {allMetrics.sort((a,b) => a.key.localeCompare(b.key)).map((metric) => ( <label key={metric.id} className="metric-label group"> <input type="checkbox" checked={selectedMetricIds.includes(metric.id)} onChange={(e) => handleMetricChange(metric.id, e.target.checked)} className="metric-checkbox"/> <span className="metric-key">{metric.key}</span> <span className="metric-direction">({metric.direction === 'maximize' ? 'Cao tốt' : 'Thấp tốt'})</span> </label> ))} </div></div>
                </div>
                <div className="mt-6">
                    <label className="input-label">Tags</label>
                    <div className="tag-input-container">
                        {selectedTagObjects.map(tag => ( <span key={tag.id} className="tag-selected"> <TagIcon className="w-3 h-3 mr-1.5" /> {tag.name} <button type="button" onClick={() => handleRemoveTag(tag.id)} className="tag-remove-button" aria-label={`Remove ${tag.name} tag`}> <X className="w-3 h-3" /> </button> </span> ))}
                        <div className="relative"> <input type="text" value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} onFocus={() => setShowTagDropdown(true)} className="tag-search-input" placeholder="+ Thêm tag..." list="available-tags-datalist" /> <datalist id="available-tags-datalist">{filteredTags.map(tag => ( <option key={tag.id} value={tag.name} /> ))}</datalist> {showTagDropdown && filteredTags.length > 0 && ( <div className="tag-dropdown"> <ul> {filteredTags.map(tag => ( <li key={tag.id}> <button type="button" onClick={() => handleAddTagById(tag.id)} className="tag-dropdown-item"> {tag.name} </button> </li> ))} </ul> </div> )} </div>
                         {showTagDropdown && <button type="button" onClick={() => setShowTagDropdown(false)} className="fixed inset-0 cursor-default -z-1"></button>}
                    </div>
                </div>
            </div>
            {/* Content Editor Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4"> <h2 className="text-xl font-semibold text-gray-800 flex items-center"> <FileText className="w-5 h-5 mr-2 text-indigo-600" /> Nội dung chi tiết </h2> <button type="button" onClick={() => setShowPreview(!showPreview)} className="preview-toggle-button" title={showPreview ? 'Ẩn Preview' : 'Hiện Preview'}> {showPreview ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />} {showPreview ? 'Ẩn' : 'Xem trước'} </button> </div>
                <p className="text-xs text-gray-500 mb-2">Mô tả chi tiết bài toán, dữ liệu, định dạng nộp bài, tiêu chí đánh giá... Hỗ trợ Markdown và công thức LaTeX ($inline$ hoặc $$block$$).</p>
                <div className={`grid ${showPreview ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                    <div> <label htmlFor="problemContent" className="sr-only">Nội dung bài toán</label> <textarea id="problemContent" value={content} onChange={(e) => setContent(e.target.value)} rows={showPreview ? 20 : 15} required placeholder="Viết nội dung ở đây..." className="content-textarea" spellCheck="false"></textarea> </div>
                    {showPreview && ( <div className="md:border-l md:pl-4 border-slate-200"> <label className="block text-sm font-medium text-gray-700 mb-2">Xem trước</label> <div className="content-preview-container"> <article className="prose prose-sm max-w-none prose-slate prose-headings:font-semibold prose-a:text-indigo-600 hover:prose-a:text-indigo-800 prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:text-slate-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-medium prose-pre:bg-slate-800 prose-pre:text-slate-200 prose-pre:rounded-lg"> <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}> {content || '*Chưa có nội dung*'} </ReactMarkdown> </article> </div> </div> )}
                </div>
            </div>
             {/* Datasets & Script Card */}
             <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                 <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center"> <Upload className="w-5 h-5 mr-2 text-indigo-600" /> Dữ liệu & Script chấm điểm </h2>
                 <p className="text-xs text-slate-500 mb-4">Các file CSV cho tập train, test public, và ground truth (solution). Script chấm điểm phải là code Python.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Train File */}
                    <div> <label htmlFor="trainFile" className="input-label-file">Tập Train (.csv)</label> <input id="trainFile" type="file" accept=".csv" onChange={(e) => setTrainFile(e.target.files?.[0] || null)} className="file-input-style" aria-describedby="train-file-description"/> {currentTrainFileMeta && !trainFile && ( <p id="train-file-description" className="file-status-ok"> Hiện tại: <strong className="font-medium">{currentTrainFileMeta.filename}</strong>. </p> )} {trainFile && ( <p id="train-file-description" className="file-status-new"> File mới: <strong className="font-medium">{trainFile.name}</strong>. </p> )} {isNew && !trainFile && <p className="file-status-required">Bắt buộc cho bài toán mới.</p>} </div>
                    {/* Test File (Public) */}
                    <div> <label htmlFor="testFile" className="input-label-file">Tập Test Public (.csv)</label> <input id="testFile" type="file" accept=".csv" onChange={(e) => setTestFile(e.target.files?.[0] || null)} className="file-input-style" aria-describedby="test-file-description"/> {currentTestFileMeta && !testFile && ( <p id="test-file-description" className="file-status-ok"> Hiện tại: <strong className="font-medium">{currentTestFileMeta.filename}</strong>. </p> )} {testFile && ( <p id="test-file-description" className="file-status-new"> File mới: <strong className="font-medium">{testFile.name}</strong>. </p> )} {isNew && !testFile && <p className="file-status-required">Bắt buộc cho bài toán mới.</p>} </div>
                    {/* Ground Truth File */}
                    <div> <label htmlFor="groundTruthFile" className="input-label-file">Ground Truth / Solution (.csv)</label> <input id="groundTruthFile" type="file" accept=".csv" onChange={(e) => setGroundTruthFile(e.target.files?.[0] || null)} className="file-input-style" aria-describedby="gt-file-description"/> {currentGroundTruthExists && !groundTruthFile && ( <p id="gt-file-description" className="file-status-ok"> Đã có file ground truth. </p> )} {groundTruthFile && ( <p id="gt-file-description" className="file-status-new"> File mới: <strong className="font-medium">{groundTruthFile.name}</strong>. </p> )} {isNew && !groundTruthFile && <p className="file-status-required">Bắt buộc cho bài toán mới.</p>} {!isNew && !currentGroundTruthExists && !groundTruthFile && <p className="file-status-required">Cần tải lên file ground truth.</p>} </div>
                     {/* Evaluation Script Textarea and File Reader */}
                     <div className="md:col-span-3">
                        <div className="flex justify-between items-center mb-1"> <label htmlFor="scriptContent" className="input-label-file flex items-center"> <FileCode2 className="w-4 h-4 mr-1.5 text-indigo-500"/> Script chấm điểm (Python) </label> <input type="file" ref={scriptFileReaderRef} accept=".py,text/x-python" onChange={handleScriptFileChange} className="hidden" id="scriptFileReader"/> <button type="button" onClick={() => scriptFileReaderRef.current?.click()} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center" title="Đọc nội dung từ file .py"> <FileUp className="w-3.5 h-3.5 mr-1"/> Tải lên từ file... </button> </div>
                        <textarea id="scriptContent" value={scriptContent} onChange={(e) => setScriptContent(e.target.value)} rows={20} required placeholder="Dán hoặc viết code Python chấm điểm ở đây..." className="content-textarea" spellCheck="false" aria-describedby="script-content-description" />
                         {(!scriptContent.trim()) && <p id="script-content-description" className="file-status-required">Script chấm điểm không được để trống.</p>}
                         {/* <p className="text-xs text-slate-500 mt-1">Script phải nhận 4 args: `submission_path`, `ground_truth_path`, `public_test_path`, `output_path`. Ghi `-1.0` (lỗi format), `0.0` (lỗi tính điểm), hoặc điểm `{'>='}`0 vào `output_path`. Thoát với `sys.exit(1)` nếu có lỗi.</p> */}
                    </div>
                </div>
             </div>
            {/* Action Buttons */}
            <div className="mt-8 flex justify-end gap-4">
                <button type="button" onClick={onCancel} disabled={loading} className="cancel-button"> Hủy </button>
                <button type="submit" disabled={loading || !scriptContent.trim() || (isNew && (!trainFile || !testFile || !groundTruthFile)) } className="submit-button"> {loading ? <LoadingSpinner size="sm" /> : (isNew ? "Tạo bài toán" : "Lưu thay đổi")} </button>
            </div>
             {/* Styles */}
             <style>{`
                /* Styles remain the same */
                .input-label { display: block; font-size: 0.875rem; font-weight: 500; color: #4b5563; margin-bottom: 0.5rem; }
                .input-style { width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem; outline: none; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); transition: border-color 150ms ease-in-out, box-shadow 150ms ease-in-out; }
                .input-style:focus { border-color: #4f46e5; box-shadow: 0 0 0 2px #c7d2fe; }
                .difficulty-button { padding: 0.5rem 1rem; border-radius: 0.5rem; border-width: 1px; font-size: 0.875rem; font-weight: 500; transition: all 150ms ease-in-out; }
                .difficulty-button:focus { outline: none; ring-offset-width: 1px; }
                .inactive-difficulty { border-color: #d1d5db; color: #374151; } .inactive-difficulty:hover { border-color: #9ca3af; background-color: #f9fafb; } .inactive-difficulty:focus { ring: 2px; ring-color: #a5b4fc; }
                .metric-list-container { max-height: 10rem; overflow-y: auto; border-width: 1px; padding: 0.75rem; border-radius: 0.375rem; background-color: rgba(249, 250, 251, 0.5); box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f5f9; }
                .metric-label { display: flex; align-items: center; column-gap: 0.5rem; cursor: pointer; font-size: 0.875rem; padding: 0.25rem; border-radius: 0.25rem; transition: background-color 150ms ease-in-out; } .metric-label:hover { background-color: #eef2ff; }
                .metric-checkbox { height: 1rem; width: 1rem; border-radius: 0.25rem; border-color: #d1d5db; color: #4f46e5; transition: all 150ms ease-in-out; } .metric-checkbox:focus { ring-color: #4f46e5; ring-offset-width: 1px; }
                .metric-key { color: #374151; font-weight: 500; } .metric-label:hover .metric-key { color: #4338ca; }
                .metric-direction { font-size: 0.75rem; color: #6b7280; } .metric-label:hover .metric-direction { color: #4f46e5; }
                .tag-input-container { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 0.75rem; min-height: 42px; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.5rem; background-color: rgba(249, 250, 251, 0.5); }
                .tag-selected { display: inline-flex; align-items: center; padding-left: 0.75rem; padding-right: 0.25rem; padding-top: 0.25rem; padding-bottom: 0.25rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; background-color: #dbeafe; color: #1e40af; animation: fade-in 0.2s ease-out forwards; }
                .tag-remove-button { margin-left: 0.375rem; padding: 0.125rem; border-radius: 9999px; color: #2563eb; } .tag-remove-button:hover { background-color: #bfdbfe; } .tag-remove-button:focus { outline: none; ring: 1px; ring-color: #60a5fa; }
                .tag-search-input { padding: 0.25rem 0.75rem; border: 1px solid #d1d5db; border-radius: 9999px; font-size: 0.875rem; outline: none; width: 7rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); transition: border-color 150ms ease-in-out; } .tag-search-input:focus { border-color: #60a5fa; }
                .tag-dropdown { position: absolute; z-index: 10; margin-top: 0.25rem; width: 12rem; background-color: white; border: 1px solid #d1d5db; border-radius: 0.375rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); max-height: 10rem; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f5f9; }
                .tag-dropdown-item { width: 100%; text-align: left; padding: 0.375rem 0.75rem; font-size: 0.875rem; color: #374151; } .tag-dropdown-item:hover { background-color: #eef2ff; color: #4338ca; }
                .preview-toggle-button { display: flex; align-items: center; padding: 0.375rem 0.75rem; border-radius: 0.5rem; background-color: #f1f5f9; font-size: 0.75rem; font-weight: 500; color: #475569; transition: background-color 150ms ease-in-out; } .preview-toggle-button:hover { background-color: #e2e8f0; }
                .content-textarea { width: 100%; height: 100%; min-height: 200px; padding: 1rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.875rem; resize: vertical; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); transition: border-color 150ms ease-in-out, box-shadow 150ms ease-in-out; }
                .content-textarea:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #4f46e5; box-shadow: 0 0 0 2px #c7d2fe; }
                .content-preview-container { max-height: 30rem; min-height: 20rem; padding: 1rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem; overflow-y: auto; background-color: rgba(249, 250, 251, 0.5); box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05); scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f5f9; }
                .input-label-file { display: block; font-size: 0.875rem; font-weight: 500; color: #4b5563; margin-bottom: 0.25rem; }
                .file-input-style { display: block; width: 100%; font-size: 0.875rem; color: #6b7280; padding: 0.25rem; file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 rounded-md }
                .file-status-ok { font-size: 0.75rem; color: #059669; margin-top: 0.5rem; }
                .file-status-new { font-size: 0.75rem; color: #2563eb; margin-top: 0.5rem; }
                .file-status-required { font-size: 0.75rem; color: #dc2626; margin-top: 0.5rem; }
                .cancel-button { padding: 0.625rem 1.5rem; border-radius: 0.5rem; border: 1px solid #d1d5db; color: #374151; font-weight: 600; font-size: 0.875rem; transition: background-color 150ms ease-in-out; } .cancel-button:hover { background-color: #f9fafb; } .cancel-button:disabled { opacity: 0.5; }
                .submit-button { padding: 0.625rem 1.5rem; border-radius: 0.5rem; background-image: linear-gradient(to right, #4f46e5, #7c3aed); color: white; font-weight: 600; font-size: 0.875rem; transition: all 150ms ease-in-out; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); min-width: 140px; display: flex; justify-content: center; align-items: center; } .submit-button:hover { background-image: linear-gradient(to right, #4338ca, #6d28d9); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1); } .submit-button:disabled { background-image: linear-gradient(to right, #a5b4fc, #c4b5fd); cursor: not-allowed; box-shadow: none; }
                .code-inline { font-size: 0.875em; background-color: #f3f4f6; padding: 0.1em 0.3em; border-radius: 0.25rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; border: 1px solid #e5e7eb;}
                @keyframes fade-in { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
                .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
                .scrollbar-thin { scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f5f9; } .scrollbar-thin::-webkit-scrollbar { width: 6px; } .scrollbar-thin::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; } .scrollbar-thin::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 3px; border: 1px solid #f1f5f9; }
                .prose .katex-display { margin-left: 0; margin-right: 0; overflow-x: auto;} .prose code { font-weight: 500; }
                .prose h1 { font-size: 1.5rem; margin-top: 0.25rem; margin-bottom: 0.5rem; }
                .prose h2 { font-size: 1.25rem; margin-top: 0.5rem; margin-bottom: 0.35rem; }
                .prose h3 { font-size: 1.1rem; margin-top: 0.35rem; margin-bottom: 0.25rem; }
                .prose h4 { font-size: 1rem; margin-top: 0.25rem; margin-bottom: 0.2rem; }
                .prose h1, .prose h2, .prose h3, .prose h4 { color: #0f172a; font-weight: 700; }
            `}</style>
        </form>
    );
};
