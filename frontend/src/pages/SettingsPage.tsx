import React, { useState, useRef, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { UserCog, KeyRound, Lock, Bell, Camera, Globe, Github, Linkedin, Twitter, Crown, CreditCard, Receipt, Download, Key } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import type { UserProfile, NotificationPreferences, Education, WorkExperience } from '../types';
import { UserAvatar } from '../components/Common/UserAvatar';
import { ChangePasswordModal } from '../components/Settings/ChangePasswordModal';
import { AvatarCropModal } from '../components/Settings/AvatarCropModal';
import { ToggleSwitch } from '../components/Settings/ToggleSwitch';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { OWNER_ID } from '../api';

export const SettingsPage: React.FC = () => {
    const {
        currentUser, setCurrentUser, users, setUsers, api, handleLogout,
        openConfirmModal, closeConfirmModal, setLoading, loading,
        imgSrc, setImgSrc,
        isAvatarModalOpen, setIsAvatarModalOpen, originalFileName, setOriginalFileName,
        showToast, subscription, invoices, startPremiumCheckout, downloadInvoicePdf, refreshBilling,
    } = useAppContext();

    const [settingsTab, setSettingsTab] = useState("basic-info");
    const [profile, setProfile] = useState<UserProfile>(currentUser?.profile ?? {} as UserProfile);
    const [username, setUsername] = useState(currentUser?.username ?? "");
    const [email, setEmail] = useState(currentUser?.email ?? "");
    const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
    const [redeemKey, setRedeemKey] = useState(""); // State cho nhập key
    const avatarFileRef = useRef<HTMLInputElement>(null);

    const [editingEducation, setEditingEducation] = useState<Education[]>(profile.education || []);
    const [editingWork, setEditingWork] = useState<WorkExperience[]>(profile.workExperience || []);

    // --- SECURITY CHECK ---
    if (!currentUser) {
        return <Navigate to="/auth" replace />;
    }

    // --- Avatar Upload Logic ---
    const onSelectFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) { showToast("Vui lòng chọn file ảnh.", "error"); return; }
            if (file.size > 5 * 1024 * 1024) { showToast("Ảnh không quá 5MB.", "error"); return; }
            setOriginalFileName(file.name);
            const reader = new FileReader();
            reader.onload = () => setImgSrc(reader.result?.toString() || '');
            reader.readAsDataURL(file);
            setIsAvatarModalOpen(true); e.target.value = "";
        }
    }, [setOriginalFileName, setImgSrc, setIsAvatarModalOpen, showToast]);

    // --- Save Handler ---
    const handleSave = useCallback(async () => {
        if (!currentUser || !username.trim() || !email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
            showToast(!username.trim() || !email.trim() ? "Tên và Email không được trống." : "Email không hợp lệ.", "error"); return;
        }
        setLoading(true);
        try {
             const updatedProfile = { ...profile, education: editingEducation, workExperience: editingWork };
             const data = await api.put('/users/me', { username: username.trim(), email: email.trim(), profile: updatedProfile });
            setCurrentUser(prev => prev ? { ...prev, ...data.user } : data.user);
            setUsers(users.map(u => u.id === data.user.id ? data.user : u));
            setProfile(updatedProfile);
            showToast("Cập nhật thành công!", "success");
        } catch (err: any) { showToast(err.message || "Lỗi cập nhật.", "error"); }
        finally { setLoading(false); }
    }, [currentUser, username, email, profile, editingEducation, editingWork, api, setCurrentUser, setUsers, setLoading, showToast]);

    // --- Billing Handlers ---
    const handleRedeemKey = async () => {
        if (!redeemKey.trim()) return showToast("Vui lòng nhập mã.", "error");
        setLoading(true);
        try {
            await api.post('/billing/redeem', { key: redeemKey.trim() });
            showToast("Kích hoạt Premium thành công!", "success");
            setRedeemKey("");
            refreshBilling();
        } catch (err: any) {
            showToast(err.message || "Mã không hợp lệ.", "error");
        } finally {
            setLoading(false);
        }
    };

    // --- Other Handlers (Password, Delete) omitted for brevity but kept same logic ---
    const handleChangePassword = useCallback(async (currentPass: string, newPass: string): Promise<boolean> => {
        if (!currentPass || !newPass || newPass.length < 6) {
            showToast("Mật khẩu không hợp lệ.", "error"); return false;
        }
        setLoading(true);
        try {
            await api.post('/auth/change-password', { currentPassword: currentPass, newPassword: newPass });
            setChangePasswordModalOpen(false); showToast("Đổi mật khẩu thành công!", "success"); setLoading(false); return true;
        } catch (err: any) { showToast(err.message || "Đổi mật khẩu thất bại.", "error"); setLoading(false); return false; }
    }, [api, setLoading, showToast]);

    const handleDeleteAccount = useCallback(() => {
         if (!currentUser || currentUser.id === OWNER_ID) return;
         openConfirmModal( "Xác nhận xóa tài khoản", "CẢNH BÁO!...", async () => {
             setLoading(true);
             try { await api.delete('/users/me'); handleLogout(); }
             catch (err: any) { showToast(err.message || "Lỗi xóa tài khoản.", "error"); setLoading(false); closeConfirmModal(); }
         });
    }, [currentUser, api, handleLogout, openConfirmModal, closeConfirmModal, setLoading, showToast]);

    const handleNotifChange = useCallback((key: keyof NotificationPreferences, type: "email" | "site", value: boolean) => {
        setProfile(p => ({ ...p, notifications: { ...(p.notifications || {}), [key]: { ...(p.notifications?.[key] || { email: false, site: false }), [type]: value } } }));
    }, []);

    // Education/Work Utils
    const addEducation = () => setEditingEducation(prev => [...prev, { id: Date.now(), school: '', degree: '', duration: '' }]);
    const removeEducation = (id: number) => setEditingEducation(prev => prev.filter(edu => edu.id !== id));
    const updateEducation = (id: number, field: keyof Education, value: string) => setEditingEducation(prev => prev.map(edu => edu.id === id ? { ...edu, [field]: value } : edu));
    
    const addWork = () => setEditingWork(prev => [...prev, { id: Date.now(), title: '', company: '', duration: '' }]);
    const removeWork = (id: number) => setEditingWork(prev => prev.filter(w => w.id !== id));
    const updateWork = (id: number, field: keyof WorkExperience, value: string) => setEditingWork(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));


    const tabs = [
        { id: "basic-info", label: "Thông tin cơ bản", icon: UserCog },
        { id: "account", label: "Tài khoản", icon: KeyRound },
        { id: "privacy", label: "Riêng tư", icon: Lock },
        { id: "notifications", label: "Thông báo", icon: Bell },
        { id: "billing", label: "Premium & Billing", icon: CreditCard },
    ];

    const notificationRows = [
        { key: "announcements", label: "Thông báo chung" }, { key: "featureAnnouncements", label: "Tính năng mới" },
        { key: "award", label: "Giải thưởng/Thành tích" }, { key: "contestUpdates", label: "Cập nhật cuộc thi" },
        { key: "newComments", label: "Bình luận mới" }, { key: "promotions", label: "Khuyến mãi/Ưu đãi" },
    ] as const;

    // --- Common Styles (Replaces the <style> tag) ---
    const inputClass = "w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all";
    const labelClass = "block text-sm font-semibold text-slate-700 mb-1.5";
    const sectionTitle = "text-xl font-bold text-slate-800 mb-5";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-12">
             <AvatarCropModal isOpen={isAvatarModalOpen} onClose={() => { setIsAvatarModalOpen(false); setImgSrc(''); }} imgSrc={imgSrc} originalFileName={originalFileName} />
            <ChangePasswordModal isOpen={changePasswordModalOpen} onClose={() => setChangePasswordModalOpen(false)} onChangePassword={handleChangePassword} isChanging={loading}/>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
                    <div className="relative group cursor-pointer mb-4" onClick={() => avatarFileRef.current?.click()}>
                        <UserAvatar user={currentUser} size="w-28 h-28" textClass="text-5xl" />
                        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-8 h-8 text-white" /></div>
                    </div>
                    <input type="file" ref={avatarFileRef} hidden onChange={onSelectFile} accept="image/png, image/jpeg, image/gif"/>
                    <h3 className="font-bold text-xl text-slate-800 truncate w-full">{profile.realName || currentUser.username}</h3>
                    <p className="text-slate-500 text-sm">@{currentUser.username}</p>
                    {subscription?.status === 'active' && <span className="mt-2 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-200 flex items-center gap-1"><Crown className="w-3 h-3" /> Premium</span>}
                </div>
                
                <nav className="space-y-1">
                    {tabs.map((tab) => (
                        <button key={tab.id} onClick={() => setSettingsTab(tab.id)}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-left transition-colors ${ settingsTab === tab.id ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900" }`}>
                            <tab.icon className={`w-5 h-5 mr-3 flex-shrink-0 ${settingsTab === tab.id ? 'text-white' : 'text-slate-400'}`} /> {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <div className="lg:col-span-3">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 min-h-[500px]">
                    {settingsTab === "basic-info" && (
                        <div className="space-y-8 animate-fade-in">
                            <div>
                                <h3 className={sectionTitle}>Thông tin cá nhân</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div> <label htmlFor="realName" className={labelClass}>Tên hiển thị</label> <input id="realName" value={profile.realName || ''} onChange={e => setProfile({...profile, realName: e.target.value})} className={inputClass} /> </div>
                                    <div> <label htmlFor="gender" className={labelClass}>Giới tính</label> <select id="gender" value={profile.gender || ''} onChange={e => setProfile({...profile, gender: e.target.value as any})} className={inputClass}> <option value="Male">Nam</option> <option value="Female">Nữ</option> <option value="Other">Khác</option> </select> </div>
                                    <div> <label htmlFor="country" className={labelClass}>Quốc gia</label> <input id="country" value={profile.country || ''} onChange={e => setProfile({...profile, country: e.target.value})} className={inputClass} /> </div>
                                    <div> <label htmlFor="birthday" className={labelClass}>Ngày sinh</label> <input id="birthday" type="date" value={profile.birthday || ''} onChange={e => setProfile({...profile, birthday: e.target.value})} className={inputClass} /> </div>
                                    <div className="md:col-span-2"> <label htmlFor="summary" className={labelClass}>Giới thiệu ngắn</label> <textarea id="summary" value={profile.summary || ''} onChange={e => setProfile({...profile, summary: e.target.value})} rows={3} className={inputClass} placeholder="Mô tả bản thân..." /> </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            <div>
                                <h3 className={sectionTitle}>Học vấn & Kinh nghiệm</h3>
                                <div className="space-y-4 mb-6">
                                    <label className="text-sm font-semibold text-slate-700">Học vấn</label>
                                    {editingEducation.map((edu, index) => (
                                        <div key={edu.id || index} className="flex gap-2 items-start">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
                                                <input placeholder="Trường học" value={edu.school} onChange={e => updateEducation(edu.id, 'school', e.target.value)} className={inputClass}/>
                                                <input placeholder="Chuyên ngành" value={edu.degree} onChange={e => updateEducation(edu.id, 'degree', e.target.value)} className={inputClass}/>
                                                <input placeholder="Niên khóa" value={edu.duration} onChange={e => updateEducation(edu.id, 'duration', e.target.value)} className={inputClass}/>
                                            </div>
                                            <button onClick={() => removeEducation(edu.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition">×</button>
                                        </div>
                                    ))}
                                    <button onClick={addEducation} className="text-sm text-indigo-600 font-semibold hover:underline">+ Thêm trường học</button>
                                </div>
                                
                                <div className="space-y-4">
                                    <label className="text-sm font-semibold text-slate-700">Kinh nghiệm làm việc</label>
                                    {editingWork.map((work, index) => (
                                        <div key={work.id || index} className="flex gap-2 items-start">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
                                                <input placeholder="Chức vụ" value={work.title} onChange={e => updateWork(work.id, 'title', e.target.value)} className={inputClass}/>
                                                <input placeholder="Công ty" value={work.company} onChange={e => updateWork(work.id, 'company', e.target.value)} className={inputClass}/>
                                                <input placeholder="Thời gian" value={work.duration} onChange={e => updateWork(work.id, 'duration', e.target.value)} className={inputClass}/>
                                            </div>
                                            <button onClick={() => removeWork(work.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition">×</button>
                                        </div>
                                    ))}
                                    <button onClick={addWork} className="text-sm text-indigo-600 font-semibold hover:underline">+ Thêm công việc</button>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            <div>
                                <h3 className={sectionTitle}>Mạng xã hội</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3"> <Globe className="w-5 h-5 text-slate-400" /> <input placeholder="Website URL" value={profile.website || ''} onChange={e => setProfile({...profile, website: e.target.value})} className={inputClass} /> </div>
                                    <div className="flex items-center gap-3"> <Github className="w-5 h-5 text-slate-400" /> <input placeholder="Github URL" value={profile.github || ''} onChange={e => setProfile({...profile, github: e.target.value})} className={inputClass} /> </div>
                                    <div className="flex items-center gap-3"> <Linkedin className="w-5 h-5 text-slate-400" /> <input placeholder="LinkedIn URL" value={profile.linkedin || ''} onChange={e => setProfile({...profile, linkedin: e.target.value})} className={inputClass} /> </div>
                                    <div className="flex items-center gap-3"> <Twitter className="w-5 h-5 text-slate-400" /> <input placeholder="Twitter/X URL" value={profile.twitter || ''} onChange={e => setProfile({...profile, twitter: e.target.value})} className={inputClass} /> </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsTab === "account" && (
                        <div className="space-y-8 animate-fade-in">
                            <h3 className={sectionTitle}>Cài đặt Tài khoản</h3>
                            <div className="max-w-md space-y-4">
                                <div> <label className={labelClass}>Username</label> <input value={username} onChange={e => setUsername(e.target.value)} className={inputClass} /> </div>
                                <div> <label className={labelClass}>Email</label> <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} /> </div>
                                <button onClick={() => setChangePasswordModalOpen(true)} className="text-indigo-600 font-semibold hover:underline text-sm">Đổi mật khẩu</button>
                            </div>
                            
                            <div className="pt-6 border-t border-red-100">
                                <h4 className="text-lg font-bold text-red-700 mb-2">Vùng nguy hiểm</h4>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-red-900">Xóa tài khoản vĩnh viễn</p>
                                        <p className="text-sm text-red-700">Hành động này không thể hoàn tác. Mọi dữ liệu sẽ bị mất.</p>
                                    </div>
                                    <button onClick={handleDeleteAccount} disabled={currentUser.id === OWNER_ID || loading} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm shadow-sm transition disabled:opacity-50">
                                        {loading ? <LoadingSpinner size="sm"/> : 'Xóa tài khoản'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsTab === "privacy" && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className={sectionTitle}>Quyền riêng tư</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg"> <div> <p className="font-semibold text-slate-800">Hiển thị trên bảng xếp hạng</p> <p className="text-sm text-slate-500">Tên bạn sẽ xuất hiện công khai trên Leaderboard.</p> </div> <ToggleSwitch checked={profile.showOnLeaderboard ?? true} onChange={(val) => setProfile({...profile, showOnLeaderboard: val})} /> </div>
                                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg"> <div> <p className="font-semibold text-slate-800">Công khai lịch sử nộp bài</p> <p className="text-sm text-slate-500">Người khác có thể xem các bài giải của bạn.</p> </div> <ToggleSwitch checked={profile.showSubmissionHistory ?? true} onChange={(val) => setProfile({...profile, showSubmissionHistory: val})} /> </div>
                                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg"> <div> <p className="font-semibold text-slate-800">Liên hệ tuyển dụng</p> <p className="text-sm text-slate-500">Cho phép nhà tuyển dụng xem hồ sơ và liên hệ.</p> </div> <ToggleSwitch checked={profile.allowJobContact ?? true} onChange={(val) => setProfile({...profile, allowJobContact: val})} /> </div>
                            </div>
                        </div>
                    )}

                    {settingsTab === "notifications" && (
                        <div className="animate-fade-in">
                            <h3 className={sectionTitle}>Tùy chỉnh thông báo</h3>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left font-semibold text-slate-700">Loại thông báo</th>
                                            <th className="px-6 py-4 text-center font-semibold text-slate-700 w-24">Email</th>
                                            <th className="px-6 py-4 text-center font-semibold text-slate-700 w-24">Web</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {notificationRows.map((row) => (
                                            <tr key={row.key} className="hover:bg-slate-50/50">
                                                <td className="px-6 py-4 text-slate-700 font-medium">{row.label}</td>
                                                <td className="px-6 py-4 text-center"> <div className="flex justify-center"><ToggleSwitch checked={profile.notifications?.[row.key]?.email ?? false} onChange={(val) => handleNotifChange(row.key, 'email', val)} /></div> </td>
                                                <td className="px-6 py-4 text-center"> <div className="flex justify-center"><ToggleSwitch checked={profile.notifications?.[row.key]?.site ?? false} onChange={(val) => handleNotifChange(row.key, 'site', val)} /></div> </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {settingsTab === "billing" && (
                        <div className="space-y-8 animate-fade-in">
                            <h3 className={`${sectionTitle} flex items-center gap-2`}><Crown className="text-amber-500" /> Premium & Hóa đơn</h3>
                            
                            {/* Premium Status Card */}
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <p className="text-amber-800 font-semibold mb-1">Trạng thái gói</p>
                                        <div className="text-2xl font-bold text-slate-800 capitalize flex items-center gap-2">
                                            {subscription?.status || 'Miễn phí'}
                                            {subscription?.status === 'active' && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200">Đang hoạt động</span>}
                                        </div>
                                        <p className="text-sm text-amber-700/80 mt-2 max-w-lg">Nâng cấp lên Premium để mở khóa tính năng gợi ý AI, tải hóa đơn PDF và ưu tiên hàng chờ chấm bài.</p>
                                    </div>
                                    <button onClick={() => startPremiumCheckout()} className="shrink-0 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-sm shadow-amber-200 transition flex items-center gap-2">
                                        <Crown className="w-5 h-5"/> Nâng cấp ngay
                                    </button>
                                </div>
                            </div>

                            {/* Redeem Key Section */}
                            <div className="bg-white border border-slate-200 rounded-xl p-6">
                                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Key className="w-4 h-4 text-indigo-500"/> Kích hoạt bằng mã (Redeem Code)</h4>
                                <div className="flex gap-3 max-w-lg">
                                    <input 
                                        type="text" 
                                        value={redeemKey} 
                                        onChange={(e) => setRedeemKey(e.target.value)} 
                                        placeholder="Nhập mã kích hoạt (VD: MLJ-PREM-...)" 
                                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none"
                                    />
                                    <button onClick={handleRedeemKey} disabled={loading || !redeemKey} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed">
                                        Kích hoạt
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">Nhập mã bản quyền bạn nhận được từ sự kiện hoặc quản trị viên.</p>
                            </div>

                            {/* Invoices List */}
                            <div>
                                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Receipt className="w-4 h-4 text-slate-500"/> Lịch sử hóa đơn</h4>
                                {invoices && invoices.length > 0 ? (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Số hóa đơn</th>
                                                    <th className="px-4 py-3 text-left">Ngày</th>
                                                    <th className="px-4 py-3 text-right">Số tiền</th>
                                                    <th className="px-4 py-3 text-center">Tải về</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {invoices.map((inv) => (
                                                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                                                        <td className="px-4 py-3 font-mono text-slate-700">{inv.invoiceNumber}</td>
                                                        <td className="px-4 py-3 text-slate-600">{new Date(inv.issuedAt).toLocaleDateString('vi-VN')}</td>
                                                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                                                            {(inv.amountCents / 100).toLocaleString('vi-VN', { minimumFractionDigits: 0 })} {inv.currency?.toUpperCase()}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <button onClick={() => downloadInvoicePdf(inv.id)} className="text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-50 transition" title="Tải PDF">
                                                                <Download className="w-4 h-4"/>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                        <p className="text-slate-500 text-sm">Chưa có hóa đơn nào.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Global Save Button */}
                <div className="mt-6 flex justify-end">
                    <button onClick={handleSave} disabled={loading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none flex items-center gap-2">
                        {loading ? <LoadingSpinner size="sm" color="white" /> : 'Lưu thay đổi'}
                    </button>
                </div>
            </div>
        </div>
    );
};