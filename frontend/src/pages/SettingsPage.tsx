import React, { useState, useRef, useCallback } from 'react';
import { UserCog, KeyRound, Lock, Bell, Camera, Globe, Github, Linkedin, Twitter } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { User, UserProfile, NotificationPreferences, Education, WorkExperience } from '../types'; // Import Education, WorkExperience
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
        imgSrc, setImgSrc, crop, setCrop, completedCrop, setCompletedCrop,
        isAvatarModalOpen, setIsAvatarModalOpen, originalFileName, setOriginalFileName,
        imgRef, showToast,
    } = useAppContext();

    const [settingsTab, setSettingsTab] = useState("basic-info");
    const [profile, setProfile] = useState<UserProfile>(currentUser?.profile ?? {} as UserProfile);
    const [username, setUsername] = useState(currentUser?.username ?? "");
    const [email, setEmail] = useState(currentUser?.email ?? "");
    const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
    const avatarFileRef = useRef<HTMLInputElement>(null);

    // Add state for editing education and work experience (simplified example)
    const [editingEducation, setEditingEducation] = useState<Education[]>(profile.education || []);
    const [editingWork, setEditingWork] = useState<WorkExperience[]>(profile.workExperience || []);

    if (!currentUser) {
        return <div className="p-8 text-center text-slate-500">Đang tải thông tin người dùng...</div>;
    }

     // --- Avatar Upload Logic ---
     const onSelectFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) { showToast("Vui lòng chọn file ảnh.", "error"); return; }
            if (file.size > 5 * 1024 * 1024) { showToast("Ảnh không quá 5MB.", "error"); return; }
            setOriginalFileName(file.name); setCrop(undefined);
            const reader = new FileReader();
            reader.onload = () => setImgSrc(reader.result?.toString() || '');
            reader.readAsDataURL(file);
            setIsAvatarModalOpen(true); e.target.value = "";
        }
    }, [setOriginalFileName, setCrop, setImgSrc, setIsAvatarModalOpen, showToast]);

    const handleAvatarUpdate = useCallback(async (croppedImageBlob: Blob | null) => {
        if (!croppedImageBlob || !currentUser) { if (!croppedImageBlob) showToast("Không thể cắt ảnh.", "error"); setIsAvatarModalOpen(false); setImgSrc(''); return; }
        const reader = new FileReader();
        reader.readAsDataURL(croppedImageBlob);
        reader.onloadend = async () => {
            const base64data = reader.result;
            if (!base64data) { showToast("Không thể đọc ảnh.", "error"); setIsAvatarModalOpen(false); setImgSrc(''); return; }
            setLoading(true);
            try {
                const data = await api.put('/users/me/avatar', { avatarDataUrl: base64data });
                setCurrentUser(prev => prev ? { ...prev, ...data.user } : data.user);
                setUsers(users.map(u => u.id === data.user.id ? data.user : u));
                setIsAvatarModalOpen(false); setImgSrc(''); showToast("Cập nhật ảnh thành công!", "success");
            } catch (err: any) { showToast(err.message || "Lỗi cập nhật ảnh.", "error"); }
            finally { setLoading(false); }
        };
        reader.onerror = () => { showToast("Lỗi đọc file ảnh.", "error"); setIsAvatarModalOpen(false); setImgSrc(''); }
    }, [currentUser, api, setCurrentUser, setUsers, setIsAvatarModalOpen, setImgSrc, setLoading, showToast]);


    // --- Save Handler ---
    const handleSave = useCallback(async () => {
        if (!currentUser || !username.trim() || !email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
            showToast(!username.trim() || !email.trim() ? "Tên và Email không được trống." : "Email không hợp lệ.", "error"); return;
        }
        setLoading(true);
        try {
             // Include updated education and work experience in the profile
             const updatedProfile = { ...profile, education: editingEducation, workExperience: editingWork };
             const data = await api.put('/users/me', { username: username.trim(), email: email.trim(), profile: updatedProfile });
            setCurrentUser(prev => prev ? { ...prev, ...data.user } : data.user);
            setUsers(users.map(u => u.id === data.user.id ? data.user : u));
            setProfile(updatedProfile); // Update local profile state as well
            showToast("Cập nhật thành công!", "success");
        } catch (err: any) { showToast(err.message || "Lỗi cập nhật.", "error"); }
        finally { setLoading(false); }
    }, [currentUser, username, email, profile, editingEducation, editingWork, api, setCurrentUser, setUsers, setLoading, showToast]); // Added editingEducation, editingWork

    // --- Change Password Handler ---
    const handleChangePassword = useCallback(async (currentPass: string, newPass: string): Promise<boolean> => {
        if (!currentPass || !newPass || newPass.length < 6) {
            showToast(!currentPass || !newPass ? "Nhập đủ mật khẩu." : "Mật khẩu mới quá yếu.", "error"); return false;
        }
        setLoading(true);
        try {
            await api.post('/auth/change-password', { currentPassword: currentPass, newPassword: newPass });
            setChangePasswordModalOpen(false); showToast("Đổi mật khẩu thành công!", "success"); setLoading(false); return true;
        } catch (err: any) { showToast(err.message || "Đổi mật khẩu thất bại.", "error"); setLoading(false); return false; }
    }, [api, setLoading, showToast]);

    // --- Delete Account Handler ---
    const handleDeleteAccount = useCallback(() => {
         if (!currentUser || currentUser.id === OWNER_ID) return;
         openConfirmModal( "Xác nhận xóa tài khoản", "CẢNH BÁO!...", async () => {
             setLoading(true);
             try { await api.delete('/users/me'); handleLogout(); }
             catch (err: any) { showToast(err.message || "Lỗi xóa tài khoản.", "error"); setLoading(false); closeConfirmModal(); }
         });
    }, [currentUser, api, handleLogout, openConfirmModal, closeConfirmModal, setLoading, showToast]);


    // --- Notification Change Handler ---
     const handleNotifChange = useCallback((key: keyof NotificationPreferences, type: "email" | "site", value: boolean) => {
        setProfile(p => ({ ...p, notifications: { ...(p.notifications || {}), [key]: { ...(p.notifications?.[key] || { email: false, site: false }), [type]: value } } }));
    }, []);

     // --- Handlers for Education/Work Experience --- (Simplified: Add/Remove only)
     const addEducation = () => setEditingEducation(prev => [...prev, { id: Date.now(), school: '', degree: '', duration: '' }]);
     const removeEducation = (id: number) => setEditingEducation(prev => prev.filter(edu => edu.id !== id));
     const updateEducation = (id: number, field: keyof Education, value: string) => {
         setEditingEducation(prev => prev.map(edu => edu.id === id ? { ...edu, [field]: value } : edu));
     };
     // Similar functions for Work Experience: addWork, removeWork, updateWork
     const addWork = () => setEditingWork(prev => [...prev, { id: Date.now(), title: '', company: '', duration: '' }]);
     const removeWork = (id: number) => setEditingWork(prev => prev.filter(w => w.id !== id));
      const updateWork = (id: number, field: keyof WorkExperience, value: string) => {
         setEditingWork(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
     };


    const tabs = [
        { id: "basic-info", label: "Thông tin cơ bản", icon: UserCog },
        { id: "account", label: "Tài khoản", icon: KeyRound },
        { id: "privacy", label: "Riêng tư", icon: Lock },
        { id: "notifications", label: "Thông báo", icon: Bell },
    ];

    const notificationRows = [
        { key: "announcements", label: "Thông báo chung" }, { key: "featureAnnouncements", label: "Tính năng mới" },
        { key: "award", label: "Giải thưởng/Thành tích" }, { key: "contestUpdates", label: "Cập nhật cuộc thi" },
        { key: "newComments", label: "Bình luận mới (Thảo luận)" }, { key: "promotions", label: "Khuyến mãi/Ưu đãi" },
    ] as const;

    // ----- RENDER -----
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Render Modals */}
             <AvatarCropModal isOpen={isAvatarModalOpen} onClose={() => { setIsAvatarModalOpen(false); setImgSrc(''); }} imgSrc={imgSrc} crop={crop} setCrop={setCrop} completedCrop={completedCrop} setCompletedCrop={setCompletedCrop} imgRef={imgRef} onSave={handleAvatarUpdate} isSaving={loading}/>
            <ChangePasswordModal isOpen={changePasswordModalOpen} onClose={() => setChangePasswordModalOpen(false)} onChangePassword={handleChangePassword} isChanging={loading}/>

            {/* Left Sidebar */}
            <div className="md:col-span-1">
                <div className="flex flex-col items-center md:items-start p-4 rounded-lg mb-6">
                    <div className="relative group cursor-pointer mb-2" onClick={() => avatarFileRef.current?.click()} title="Đổi ảnh đại diện">
                        <UserAvatar user={currentUser} size="w-24 h-24" textClass="text-4xl" />
                        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-8 h-8 text-white" /></div>
                    </div>
                    <input type="file" ref={avatarFileRef} hidden onChange={onSelectFile} accept="image/png, image/jpeg, image/gif"/>
                    <h3 className="font-bold text-xl mt-2 text-center md:text-left text-slate-800 break-all">{profile.realName || currentUser.username}</h3>
                    <p className="text-slate-500 text-center md:text-left break-all">@{currentUser.username}</p>
                </div>
                <h2 className="text-lg font-semibold mb-3 text-slate-700 sr-only md:not-sr-only">Cài đặt</h2>
                <nav className="space-y-1">
                    {tabs.map((tab) => ( <button key={tab.id} onClick={() => setSettingsTab(tab.id)} className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-md text-left transition-colors ${ settingsTab === tab.id ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-800" }`}> <tab.icon className={`w-5 h-5 mr-3 flex-shrink-0 ${settingsTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} /> {tab.label} </button> ))}
                </nav>
            </div>

            {/* Right Content Area */}
            <div className="md:col-span-3">
                <div className="bg-white rounded-xl shadow-md p-6 sm:p-8 border border-slate-200">
                    {/* Basic Info Tab */}
                    {settingsTab === "basic-info" && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-slate-800">Thông tin cơ bản</h3>
                            {/* Input fields for realName, gender, country, birthday */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div> <label htmlFor="realName" className="block text-sm font-medium text-slate-700 mb-1">Tên hiển thị</label> <input id="realName" value={profile.realName || ''} onChange={e => setProfile({...profile, realName: e.target.value})} className="input-field" /> </div>
                                <div> <label htmlFor="gender" className="block text-sm font-medium text-slate-700 mb-1">Giới tính</label> <select id="gender" value={profile.gender || ''} onChange={e => setProfile({...profile, gender: e.target.value as any})} className="input-field bg-white"> <option value="Male">Nam</option> <option value="Female">Nữ</option> <option value="Other">Bí mật!?</option> </select> </div>
                                <div> <label htmlFor="country" className="block text-sm font-medium text-slate-700 mb-1">Quốc gia/Vị trí</label> <input id="country" value={profile.country || ''} onChange={e => setProfile({...profile, country: e.target.value})} className="input-field" /> </div>
                                <div> <label htmlFor="birthday" className="block text-sm font-medium text-slate-700 mb-1">Ngày sinh</label> <input id="birthday" type="date" value={profile.birthday || ''} onChange={e => setProfile({...profile, birthday: e.target.value})} className="input-field" /> </div>
                            </div>
                            {/* Summary textarea */}
                            <div> <label htmlFor="summary" className="block text-sm font-medium text-slate-700 mb-1">Giới thiệu ngắn</label> <textarea id="summary" value={profile.summary || ''} onChange={e => setProfile({...profile, summary: e.target.value})} rows={3} className="input-field" placeholder="Viết một vài điều về bạn..."/> </div>
                             {/* Education Section */}
                            <div>
                                <h4 className="text-lg font-semibold text-slate-800 mb-3">Học vấn</h4>
                                {editingEducation.map((edu, index) => (
                                    <div key={edu.id || index} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 p-3 border rounded-md relative">
                                        <input type="text" placeholder="Trường học" value={edu.school} onChange={e => updateEducation(edu.id, 'school', e.target.value)} className="input-field text-sm md:col-span-1"/>
                                        <input type="text" placeholder="Bằng cấp/Chuyên ngành" value={edu.degree} onChange={e => updateEducation(edu.id, 'degree', e.target.value)} className="input-field text-sm md:col-span-1"/>
                                        <input type="text" placeholder="Thời gian (vd: 2018-2022)" value={edu.duration} onChange={e => updateEducation(edu.id, 'duration', e.target.value)} className="input-field text-sm md:col-span-1"/>
                                        <button onClick={() => removeEducation(edu.id)} className="absolute top-1 right-1 text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100">&times;</button>
                                    </div>
                                ))}
                                <button onClick={addEducation} className="text-sm text-indigo-600 font-semibold hover:underline">+ Thêm học vấn</button>
                            </div>

                             {/* Work Experience Section */}
                            <div>
                                <h4 className="text-lg font-semibold text-slate-800 mb-3">Kinh nghiệm làm việc</h4>
                                {editingWork.map((work, index) => (
                                    <div key={work.id || index} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 p-3 border rounded-md relative">
                                        <input type="text" placeholder="Chức vụ" value={work.title} onChange={e => updateWork(work.id, 'title', e.target.value)} className="input-field text-sm md:col-span-1"/>
                                        <input type="text" placeholder="Công ty" value={work.company} onChange={e => updateWork(work.id, 'company', e.target.value)} className="input-field text-sm md:col-span-1"/>
                                        <input type="text" placeholder="Thời gian (vd: 2022-Nay)" value={work.duration} onChange={e => updateWork(work.id, 'duration', e.target.value)} className="input-field text-sm md:col-span-1"/>
                                        <button onClick={() => removeWork(work.id)} className="absolute top-1 right-1 text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100">&times;</button>
                                    </div>
                                ))}
                                <button onClick={addWork} className="text-sm text-indigo-600 font-semibold hover:underline">+ Thêm kinh nghiệm</button>
                            </div>

                            <hr className="border-slate-200"/>
                            {/* Social Links */}
                            <h3 className="text-lg font-semibold text-slate-800">Liên kết mạng xã hội</h3>
                            <p className="text-xs text-slate-500 mb-4">Thêm URL đầy đủ, bao gồm https://</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                                <div className="flex items-center space-x-2"> <label htmlFor="website" className="social-icon-label" title="Website"><Globe size={20}/></label> <input id="website" type="url" placeholder="https://your-website.com" value={profile.website || ''} onChange={e => setProfile({...profile, website: e.target.value})} className="social-input"/> </div>
                                <div className="flex items-center space-x-2"> <label htmlFor="github" className="social-icon-label" title="Github"><Github size={20}/></label> <input id="github" type="url" placeholder="https://github.com/username" value={profile.github || ''} onChange={e => setProfile({...profile, github: e.target.value})} className="social-input"/> </div>
                                <div className="flex items-center space-x-2"> <label htmlFor="linkedin" className="social-icon-label" title="LinkedIn"><Linkedin size={20}/></label> <input id="linkedin" type="url" placeholder="https://linkedin.com/in/username" value={profile.linkedin || ''} onChange={e => setProfile({...profile, linkedin: e.target.value})} className="social-input"/> </div>
                                <div className="flex items-center space-x-2"> <label htmlFor="twitter" className="social-icon-label" title="X (Twitter)"><Twitter size={20}/></label> <input id="twitter" type="url" placeholder="https://x.com/username" value={profile.twitter || ''} onChange={e => setProfile({...profile, twitter: e.target.value})} className="social-input"/> </div>
                            </div>
                        </div>
                    )}

                    {/* Account Tab */}
                    {settingsTab === "account" && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-slate-800">Tài khoản</h3>
                            <div> <label htmlFor="username-acc" className="input-label">Tên đăng nhập (Username)</label> <input id="username-acc" value={username} onChange={e => setUsername(e.target.value)} required className="input-field"/> <p className="input-hint">Tên này sẽ hiển thị công khai.</p> </div>
                            <div> <label htmlFor="email-acc" className="input-label">Email</label> <input id="email-acc" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input-field"/> <p className="input-hint">Dùng để đăng nhập và nhận thông báo.</p> </div>
                            <div> <button onClick={() => setChangePasswordModalOpen(true)} className="link-button"> Đổi mật khẩu... </button> </div>
                            <hr className="border-slate-200"/>
                            <h3 className="text-lg font-semibold text-red-700">Vùng nguy hiểm</h3>
                            <div className="danger-zone">
                                <div> <p className="font-semibold text-red-800">Xóa tài khoản</p> <p className="text-sm text-red-700 mt-1 max-w-md"> Sau khi xóa, tài khoản và tất cả dữ liệu sẽ bị xóa vĩnh viễn. </p> </div>
                                <button onClick={handleDeleteAccount} disabled={currentUser.id === OWNER_ID || loading} className="danger-button"> {loading ? <LoadingSpinner size="sm"/> : 'Xóa tài khoản này'} </button>
                            </div>
                        </div>
                    )}

                     {/* Privacy Tab */}
                    {settingsTab === "privacy" && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-slate-800">Thiết lập Riêng tư</h3>
                            <div className="privacy-item"> <div> <p className="font-medium text-slate-700">Hiển thị trên bảng xếp hạng</p> <p className="text-xs text-slate-500">Cho phép tên của bạn xuất hiện công khai.</p> </div> <ToggleSwitch checked={profile.showOnLeaderboard ?? true} onChange={(val) => setProfile({...profile, showOnLeaderboard: val})} /> </div>
                            <div className="privacy-item"> <div> <p className="font-medium text-slate-700">Hiển thị lịch sử nộp bài</p> <p className="text-xs text-slate-500">Cho phép người khác xem lịch sử nộp bài.</p> </div> <ToggleSwitch checked={profile.showSubmissionHistory ?? true} onChange={(val) => setProfile({...profile, showSubmissionHistory: val})} /> </div>
                             <div className="privacy-item"> <div> <p className="font-medium text-slate-700">Cho phép nhà tuyển dụng liên hệ</p> <p className="text-xs text-slate-500">Cho phép công ty xem hồ sơ và liên hệ.</p> </div> <ToggleSwitch checked={profile.allowJobContact ?? true} onChange={(val) => setProfile({...profile, allowJobContact: val})} /> </div>
                        </div>
                    )}

                    {/* Notifications Tab */}
                    {settingsTab === "notifications" && (
                         <div>
                            <h3 className="text-xl font-bold mb-4 text-slate-800">Thiết lập Thông báo</h3>
                            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                <table className="w-full text-sm border-collapse">
                                    <thead className="bg-slate-50"> <tr className="border-b border-slate-300"> <th className="table-header">Loại thông báo</th> <th className="table-header text-center w-20">Email</th> <th className="table-header text-center w-20">Trên trang</th> </tr> </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {notificationRows.map((row) => ( <tr key={row.key} className="hover:bg-slate-50/50"> <td className="table-cell">{row.label}</td> <td className="table-cell text-center"> <ToggleSwitch checked={profile.notifications?.[row.key]?.email ?? false} onChange={(val) => handleNotifChange(row.key, 'email', val)} /> </td> <td className="table-cell text-center"> <ToggleSwitch checked={profile.notifications?.[row.key]?.site ?? false} onChange={(val) => handleNotifChange(row.key, 'site', val)} /> </td> </tr> ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Save Button */}
                     <div className="flex justify-end pt-6 mt-6 border-t border-slate-200">
                        <button onClick={handleSave} disabled={loading} className="save-button"> {loading ? <LoadingSpinner size="sm"/> : 'Lưu thay đổi'} </button>
                    </div>
                </div>
                 {/* Add some simple base styles (ideally move to index.css or App.css) */}
                 <style>{`
                    .input-label { display: block; text-sm font-medium text-slate-700 mb-1; }
                    .input-field { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; box-shadow: inset 0 1px 2px 0 rgb(0 0 0 / 0.05); }
                    .input-field:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #4f46e5; box-shadow: 0 0 0 2px #c7d2fe; }
                    .input-hint { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; }
                    .social-icon-label { width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center; color: #64748b; flex-shrink: 0; }
                    .social-input { flex-grow: 1; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; box-shadow: inset 0 1px 2px 0 rgb(0 0 0 / 0.05); font-size: 0.875rem; }
                    .social-input:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #4f46e5; box-shadow: 0 0 0 2px #c7d2fe; }
                    .link-button { font-size: 0.875rem; color: #4f46e5; font-weight: 600; } .link-button:hover { text-decoration: underline; }
                    .danger-zone { display: flex; flex-direction: column; sm:flex-direction: row; justify-content: space-between; align-items: flex-start; sm:align-items: center; padding: 1rem; border: 1px solid #fecaca; border-radius: 0.5rem; background-color: #fef2f2; }
                    .danger-button { margin-top: 0.75rem; sm:margin-top: 0; sm:margin-left: 1rem; flex-shrink: 0; font-size: 0.875rem; background-color: #dc2626; color: white; font-weight: 600; padding: 0.5rem 1rem; border-radius: 0.5rem; } .danger-button:hover { background-color: #b91c1c; } .danger-button:disabled { background-color: #fca5a5; cursor: not-allowed; }
                    .privacy-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; }
                    .table-header { padding: 0.75rem; text-align: left; font-weight: 600; color: #475569; }
                    .table-cell { padding: 0.75rem; color: #334155; }
                    .save-button { background-color: #4f46e5; color: white; font-weight: 700; padding: 0.75rem 1.25rem; border-radius: 0.5rem; min-width: 120px; display: flex; justify-content: center; align-items: center; } .save-button:hover { background-color: #4338ca; } .save-button:disabled { background-color: #a5b4fc; cursor: not-allowed; }
                `}</style>
            </div>
        </div>
    );
};

