import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Tag, Metric, Direction } from '../../types';

interface AdminManagementPageProps {
    allTags: Tag[];
    onAddTag: (name: string) => Promise<void> | void; // Allow sync or async
    onDeleteTag: (id: number) => Promise<void> | void;
    allMetrics: Metric[];
    onAddMetric: (key: string, direction: Direction) => Promise<void> | void;
    onDeleteMetric: (id: number) => Promise<void> | void;
}

export const AdminManagementPage: React.FC<AdminManagementPageProps> = ({
    allTags,
    onAddTag,
    onDeleteTag,
    allMetrics,
    onAddMetric,
    onDeleteMetric,
}) => {
    const [newTagName, setNewTagName] = useState("");
    const [newMetricKey, setNewMetricKey] = useState("");
    const [newMetricDir, setNewMetricDir] = useState<Direction>("maximize");
    const [tagError, setTagError] = useState("");
    const [metricError, setMetricError] = useState("");
    const [loadingTag, setLoadingTag] = useState(false);
    const [loadingMetric, setLoadingMetric] = useState(false);

    const handleAddTag = async () => {
        if (!newTagName.trim()) {
            setTagError("Tên tag không được để trống.");
            return;
        }
        setTagError("");
        setLoadingTag(true);
        try {
            await onAddTag(newTagName.trim());
            setNewTagName(""); // Clear input on success
        } catch (e: any) {
            setTagError(e.message || "Thêm tag thất bại.");
        } finally {
            setLoadingTag(false);
        }
    };

    const handleDeleteTag = async (id: number) => {
         setTagError(""); // Clear error before deleting
         // Consider adding a loading state per item if needed
        try {
            await onDeleteTag(id);
        } catch (e: any) {
             setTagError(e.message || `Xóa tag ${id} thất bại.`);
        }
    };

    const handleAddMetric = async () => {
        if (!newMetricKey.trim()) {
            setMetricError("Tên metric không được để trống.");
            return;
        }
        setMetricError("");
        setLoadingMetric(true);
        try {
            await onAddMetric(newMetricKey.trim(), newMetricDir);
            setNewMetricKey(""); // Clear input on success
        } catch (e: any) {
            setMetricError(e.message || "Thêm metric thất bại.");
        } finally {
            setLoadingMetric(false);
        }
    };

     const handleDeleteMetric = async (id: number) => {
         setMetricError(""); // Clear error before deleting
         // Consider adding a loading state per item if needed
        try {
            await onDeleteMetric(id);
        } catch (e: any) {
             setMetricError(e.message || `Xóa metric ${id} thất bại.`);
        }
    };


    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Tags Management */}
            <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
                <h3 className="text-xl font-bold mb-4 text-slate-800">Quản lý Tags</h3>
                 {tagError && <p className="text-red-600 text-sm mb-3">{tagError}</p>}
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-2">
                    {allTags.length === 0 && <p className="text-slate-500 text-sm">Chưa có tag nào.</p>}
                    {allTags.map((t) => (
                        <div
                            key={t.id}
                            className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200"
                        >
                            <span className="text-slate-700 text-sm font-medium">{t.name}</span>
                            <button
                                onClick={() => handleDeleteTag(t.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                                aria-label={`Xóa tag ${t.name}`}
                                >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Tên tag mới..."
                        className="flex-grow p-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                    <button
                        onClick={handleAddTag}
                        disabled={loadingTag}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
                    >
                       {loadingTag ? 'Đang thêm...' : 'Thêm'}
                    </button>
                </div>
            </div>

            {/* Metrics Management */}
            <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
                <h3 className="text-xl font-bold mb-4 text-slate-800">Quản lý Metrics</h3>
                 {metricError && <p className="text-red-600 text-sm mb-3">{metricError}</p>}
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-2">
                     {allMetrics.length === 0 && <p className="text-slate-500 text-sm">Chưa có metric nào.</p>}
                    {allMetrics.map((m) => (
                        <div
                            key={m.id}
                            className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200"
                        >
                            <span className="text-slate-700 text-sm font-medium">
                                {m.key} <span className="text-xs text-slate-500">({m.direction === 'maximize' ? 'Tối đa hóa' : 'Tối thiểu hóa'})</span>
                            </span>
                            <button
                                onClick={() => handleDeleteMetric(m.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                                aria-label={`Xóa metric ${m.key}`}
                                >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        value={newMetricKey}
                        onChange={(e) => setNewMetricKey(e.target.value)}
                        placeholder="Tên metric mới..."
                        className="flex-grow p-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                    <select
                        value={newMetricDir}
                        onChange={(e) => setNewMetricDir(e.target.value as Direction)}
                        className="p-2 border border-slate-300 rounded-lg bg-white text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                        <option value="maximize">Maximize</option>
                        <option value="minimize">Minimize</option>
                    </select>
                    <button
                        onClick={handleAddMetric}
                        disabled={loadingMetric}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
                    >
                         {loadingMetric ? 'Đang thêm...' : 'Thêm'}
                    </button>
                </div>
            </div>
        </div>
    );
};
