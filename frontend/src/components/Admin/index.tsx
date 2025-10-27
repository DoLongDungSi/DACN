import React from 'react';
import { Ban, CheckCircle, Trash2, Shield } from 'lucide-react';
import { User, Role } from '../../types';
import { OWNER_ID } from '../../api'; // Assuming OWNER_ID is defined in api/index.ts

interface AdminUsersPanelProps {
    users: User[];
    onUpdateRole: (id: number, role: Role) => void;
    onToggleBan: (id: number) => void;
    onDeleteUser: (id: number) => void;
}

export const AdminUsersPanel: React.FC<AdminUsersPanelProps> = ({
    users,
    onUpdateRole,
    onToggleBan,
    onDeleteUser,
}) => {
    // Filter out the owner to prevent accidental modification/deletion in the UI
    const manageableUsers = users.filter(user => user.id !== OWNER_ID);

    return (
        <div>
            {/* <h2 className="text-2xl font-bold mb-6 text-slate-800">Quản lý người dùng</h2> */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="p-4 text-left text-xs font-semibold uppercase text-slate-500 tracking-wider">Tên người dùng</th>
                                <th className="p-4 text-left text-xs font-semibold uppercase text-slate-500 tracking-wider">Email</th>
                                <th className="p-4 text-left text-xs font-semibold uppercase text-slate-500 tracking-wider">Vai trò</th>
                                <th className="p-4 text-left text-xs font-semibold uppercase text-slate-500 tracking-wider">Trạng thái</th>
                                <th className="p-4 text-left text-xs font-semibold uppercase text-slate-500 tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {manageableUsers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-4 text-center text-slate-500">Không có người dùng nào (ngoài Owner).</td>
                                </tr>
                            )}
                            {manageableUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50/50">
                                    <td className="p-4 font-medium text-slate-800">{user.username}</td>
                                    <td className="p-4 text-slate-600">{user.email}</td>
                                    <td className="p-4">
                                        <select
                                            value={user.role}
                                            onChange={(e) => onUpdateRole(user.id, e.target.value as Role)}
                                            className="p-2 border border-slate-300 rounded-lg bg-white text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                            aria-label={`Vai trò của ${user.username}`}
                                        >
                                            <option value="user">User</option>
                                            <option value="creator">Creator</option>
                                            {/* Owner role is typically not assignable via UI */}
                                            {/* <option value="owner">Owner</option> */}
                                        </select>
                                    </td>
                                    <td className="p-4">
                                        <span
                                            className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                                                user.isBanned
                                                ? "bg-red-100 text-red-800"
                                                : "bg-green-100 text-green-800"
                                            }`}
                                        >
                                            {user.isBanned ? "Đã khóa" : "Hoạt động"}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center space-x-3">
                                            <button
                                                onClick={() => onToggleBan(user.id)}
                                                className={`p-1 rounded ${user.isBanned ? 'text-green-600 hover:bg-green-100' : 'text-yellow-600 hover:bg-yellow-100'}`}
                                                title={user.isBanned ? `Mở khóa ${user.username}` : `Khóa ${user.username}`}
                                            >
                                                {user.isBanned ? <CheckCircle className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                                            </button>
                                            <button
                                                onClick={() => onDeleteUser(user.id)}
                                                className="p-1 rounded text-red-600 hover:bg-red-100"
                                                title={`Xóa ${user.username}`}
                                                >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// You can export other Admin related components from here if needed
// export { AdminManagementPage } from './AdminManagementPage';
