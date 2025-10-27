import React from 'react';
import { ShieldCheck, Users, Tags, Activity } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { AdminUsersPanel } from '../components/Admin'; // Assuming AdminUsersPanel is part of index.tsx
import { AdminManagementPage } from '../components/Admin/AdminManagementPage'; // Assuming separate file

export const AdminPage: React.FC = () => {
    const {
        currentUser,
        users,
        allTags,
        allMetrics,
        adminSubPage,
        setAdminSubPage,
        // Admin action handlers from context
        handleAdminUpdateUserRole,
        handleAdminToggleBanUser,
        handleAdminDeleteUser,
        handleAdminAddTag,
        handleAdminDeleteTag,
        handleAdminAddMetric,
        handleAdminDeleteMetric
    } = useAppContext();

    // Basic authorization check
    if (currentUser?.role !== 'owner') {
        // Redirect or show an unauthorized message
        // For simplicity, returning null here. Consider a redirect in App.tsx routing logic.
        return <div className="p-8 text-center text-red-600">Bạn không có quyền truy cập trang này.</div>;
    }

    const tabs = [
        { id: "users", label: "Người dùng", icon: Users },
        { id: "tags-metrics", label: "Tags & Metrics", icon: Tags },
        // Add more tabs like 'System Stats' if needed
        // { id: "stats", label: "System Stats", icon: Activity },
    ];


    return (
        <div>
            <div className="flex items-center mb-8">
                <ShieldCheck className="w-8 h-8 text-indigo-600 mr-3" />
                <h2 className="text-3xl font-bold text-slate-900">Bảng điều khiển Admin</h2>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-slate-200 mb-6">
                 <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {tabs.map((tab) => (
                         <button
                            key={tab.id}
                            onClick={() => setAdminSubPage(tab.id)}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center
                                ${adminSubPage === tab.id
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                            aria-current={adminSubPage === tab.id ? 'page' : undefined}
                         >
                            <tab.icon className="-ml-0.5 mr-2 h-5 w-5" aria-hidden="true" />
                            {tab.label}
                        </button>
                    ))}
                 </nav>
            </div>

            {/* Tab Content */}
            {adminSubPage === "users" && (
                <AdminUsersPanel
                    users={users}
                    onUpdateRole={handleAdminUpdateUserRole}
                    onToggleBan={handleAdminToggleBanUser}
                    onDeleteUser={handleAdminDeleteUser}
                 />
            )}
            {adminSubPage === "tags-metrics" && (
                <AdminManagementPage
                    allTags={allTags}
                    onAddTag={handleAdminAddTag}
                    onDeleteTag={handleAdminDeleteTag}
                    allMetrics={allMetrics}
                    onAddMetric={handleAdminAddMetric}
                    onDeleteMetric={handleAdminDeleteMetric}
                 />
            )}
            {/* Add content for other tabs like 'stats' here */}
             {/* {adminSubPage === "stats" && (
                 <div><h3 className="text-xl font-semibold">System Statistics (Placeholder)</h3></div>
             )} */}

        </div>
    );
};
    