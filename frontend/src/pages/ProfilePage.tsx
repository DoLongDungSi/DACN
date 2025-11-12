import React, { useEffect, useMemo } from 'react';
import { Briefcase, GraduationCap, Award, Activity, Globe, Github, Linkedin, Twitter, MapPin, Mail, User as UserIcon, Send } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, formatDistanceToNow, startOfDay } from 'date-fns';
import { useAppContext } from '../hooks/useAppContext';
import type { Submission, LeaderboardEntry, Education, WorkExperience, User } from '../types';
import { UserAvatar } from '../components/Common/UserAvatar';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';

export const ProfilePage: React.FC = () => {
    const {
        users, viewingUserId, currentUser, submissions, problems, leaderboardData,
        navigate, // Use navigate for redirection
        setError, loading
    } = useAppContext();

    // Determine whose profile to show
    const profileUserId = viewingUserId ?? currentUser?.id;
    // Find the user data based on the ID
    const profileUser = useMemo(() => users.find((u) => u.id === profileUserId), [users, profileUserId]);

     // Redirect if user not found after data load
     useEffect(() => {
        if (!loading && users.length > 0 && profileUserId && !profileUser) {
            console.warn(`User with ID ${profileUserId} not found. Redirecting.`);
            setError(`Không tìm thấy người dùng.`);
            navigate('problems', undefined, true); // Use navigate to redirect
        }
    }, [profileUser, profileUserId, users, navigate, setError, loading]); // Added navigate


    // Calculate user stats, memoized for performance
    const stats = useMemo(() => {
        const calculateUserStats = (userId: number | undefined): {
            solvedProblems: number;
            totalSubmissions: number;
            bestRank: number | string;
            // Removed successRate
            activityData: { date: string; isoDate: string; submissions: number }[];
         } | null => {
            if (userId === undefined || !users.length || !submissions.length) return null;

            const user = users.find((u) => u.id === userId);
            if (!user) return null;

            const userSubs = submissions.filter((s: Submission) => s.userId === userId);
            const totalSubmissionsCount = userSubs.length;
            if (totalSubmissionsCount === 0) {
                return { solvedProblems: 0, totalSubmissions: 0, bestRank: '-', activityData: [] };
            }

            // Count unique problems with at least one 'succeeded' submission as "solved"
            const solvedProblemIds = new Set(
                userSubs.filter(s => s.status === 'succeeded').map((s: Submission) => s.problemId)
            );
            const solvedProblemsCount = solvedProblemIds.size;


            const userRanks = Object.values(leaderboardData)
                .flat()
                .filter((e: LeaderboardEntry) => e.username === user.username && typeof e.rank === 'number')
                .map((e: LeaderboardEntry) => e.rank as number);
            const bestRankValue = userRanks.length > 0 ? Math.min(...userRanks) : null;

            // Generate activity data
            const activityMap = new Map<string, number>();
            userSubs.forEach((s: Submission) => {
                try {
                    if (s.submittedAt) {
                        const submissionDate = startOfDay(parseISO(s.submittedAt));
                        const dateString = format(submissionDate, 'yyyy-MM-dd');
                        activityMap.set(dateString, (activityMap.get(dateString) || 0) + 1);
                    }
                } catch (e) { console.error("Error parsing date:", s.submittedAt, e); }
            });

            const activityData = Array.from(activityMap.entries())
                .map(([dateString, count]) => ({
                    date: format(parseISO(dateString), 'MMM dd'),
                    isoDate: dateString,
                    submissions: count,
                }))
                .sort((a, b) => a.isoDate.localeCompare(b.isoDate));

            // Removed successRate calculation

            return {
                solvedProblems: solvedProblemsCount,
                totalSubmissions: totalSubmissionsCount,
                bestRank: bestRankValue === null ? '-' : `#${bestRankValue}`, // Add # to rank
                activityData: activityData,
            };
        };
        return calculateUserStats(profileUser?.id);
    }, [profileUser, users, submissions, leaderboardData, problems.length]); // Dependencies


    const formatLink = (url?: string | null) => {
        if (!url) return null;
        return url.startsWith('http') ? url : `https://${url}`;
    };

    // Display loading state or if user not found yet
    if (loading || !profileUser) {
        return (
            <div className="flex justify-center items-center h-64">
                <LoadingSpinner />
                <span className="ml-3 text-slate-500">Đang tải hồ sơ người dùng...</span>
            </div>
        );
    }

    const profile = profileUser.profile || {};
    const joinLabel = profileUser.joinedAt ? formatDistanceToNow(parseISO(profileUser.joinedAt), { addSuffix: true }) : 'không rõ';
    const socialLinks = [
        { label: 'Website', icon: Globe, url: formatLink(profile.website) },
        { label: 'GitHub', icon: Github, url: formatLink(profile.github) },
        { label: 'LinkedIn', icon: Linkedin, url: formatLink(profile.linkedin) },
        { label: 'Twitter', icon: Twitter, url: formatLink(profile.twitter) },
    ].filter(link => link.url);
    const statCards = [
        { label: 'Bài đã giải', value: stats?.solvedProblems ?? 0, suffix: ` / ${problems.length}` },
        { label: 'Lượt nộp', value: stats?.totalSubmissions ?? 0 },
        { label: 'Hạng cao nhất', value: stats?.bestRank ?? '-' },
    ];
    const sortTimeline = (a: Education | WorkExperience, b: Education | WorkExperience) => {
        const getYear = (duration: string | undefined) => {
            if (!duration) return 0;
            const parts = duration.split('-');
            const endYear = parts[parts.length - 1].trim().toLowerCase();
            if (endYear === 'nay' || endYear === 'present') return Infinity;
            return parseInt(endYear, 10) || 0;
        };
        return getYear(b.duration) - getYear(a.duration);
    };
    const sortedEducation = (profile.education || []).sort(sortTimeline);
    const sortedWorkExperience = (profile.workExperience || []).sort(sortTimeline);
    const isOwnerViewing = currentUser?.id === profileUser.id;

    return (
        <div className="profile-wrapper -m-4 sm:-m-6 lg:-m-8">
            <div className="profile-shell max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-10">
                <section className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-[2.2fr,1fr]">
                        <div className="profile-hero p-6 sm:p-8">
                            <div className="flex flex-col gap-6 md:flex-row md:items-center">
                                <div className="relative shrink-0">
                                    <span className="status-dot" />
                                    <div className="hero-avatar">
                                        <UserAvatar user={profileUser} size="w-24 h-24" textClass="text-3xl" />
                                    </div>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h1 className="text-3xl font-bold text-white">{profile.realName || profileUser.username}</h1>
                                        <span className="chip-badge">#{profileUser.username}</span>
                                        {profile.country && <span className="chip-badge">🌍 {profile.country}</span>}
                                    </div>
                                    <p className="text-sm text-slate-300">
                                        @{profileUser.username} · Tham gia {joinLabel}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="chip-pill">Solved: {stats?.solvedProblems ?? 0}</span>
                                        <span className="chip-pill">Submissions: {stats?.totalSubmissions ?? 0}</span>
                                        <span className="chip-pill">Best rank: {stats?.bestRank ?? '-'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex flex-wrap gap-3">
                                {profile.allowJobContact ? (
                                    profileUser.email ? (
                                        <a href={`mailto:${profileUser.email}`} className="contact-chip">
                                            <Send className="w-4 h-4" />
                                            Gửi liên hệ
                                        </a>
                                    ) : (
                                        <span className="chip-pill text-xs">Email chưa công khai</span>
                                    )
                                ) : null}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {statCards.map((card, index) => (
                                <div
                                    key={card.label}
                                    className={`stats-pill ${index === statCards.length - 1 ? 'sm:col-span-2' : ''}`}
                                >
                                    <p className="stats-pill-label">{card.label}</p>
                                    <p className="stats-pill-value">
                                        {card.value}
                                        {card.suffix && <span>{card.suffix}</span>}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {profile.summary && (
                        <div className="glass-panel summary-card p-6">
                            <h3>Giới thiệu</h3>
                            <p>{profile.summary}</p>
                        </div>
                    )}
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-6">
                        <div className="glass-panel p-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-slate-900">Thông tin</h3>
                                <span className="chip-pill text-xs">Công khai</span>
                            </div>
                            <ul className="info-list mt-6">
                                <li className="info-item">
                                    <span className="info-icon">
                                        <MapPin className="w-4 h-4" />
                                    </span>
                                    <div>
                                        <p className="info-label">Vị trí</p>
                                        <p className="info-value">{profile.country || 'Chưa cập nhật'}</p>
                                    </div>
                                </li>
                                <li className="info-item">
                                    <span className="info-icon">
                                        <Mail className="w-4 h-4" />
                                    </span>
                                    <div>
                                        <p className="info-label">Liên hệ</p>
                                        <p className="info-value">
                                            {profile.allowJobContact && profileUser.email ? profileUser.email : 'Không công khai'}
                                        </p>
                                    </div>
                                </li>
                                {profile.gender && (
                                    <li className="info-item">
                                        <span className="info-icon">
                                            <UserIcon className="w-4 h-4" />
                                        </span>
                                        <div>
                                            <p className="info-label">Giới tính</p>
                                            <p className="info-value">{profile.gender}</p>
                                        </div>
                                    </li>
                                )}
                            </ul>
                        </div>

                        {profile.skills && profile.skills.length > 0 && (
                            <div className="glass-panel p-6">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Kỹ năng nổi bật</h3>
                                <div className="flex flex-wrap gap-2">
                                    {profile.skills.map((skill: string, index: number) => (
                                        <span key={`${skill}-${index}`} className="skill-chip">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {socialLinks.length > 0 && (
                            <div className="glass-panel p-6">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Liên kết</h3>
                                <div className="flex flex-wrap gap-3">
                                    {socialLinks.map(link => (
                                        <a
                                            key={link.label}
                                            href={link.url!}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="social-chip"
                                        >
                                            <link.icon className="w-4 h-4" />
                                            {link.label}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="glass-panel p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="info-icon">
                                    <Award className="w-4 h-4" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">Danh hiệu & huy hiệu</h3>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-3">
                                <span className="achievements-pill">Sắp ra mắt</span>
                                {stats?.bestRank && (
                                    <span className="achievements-pill bg-indigo-50 text-indigo-700">{`Hạng ${stats.bestRank}`}</span>
                                )}
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Hệ thống huy hiệu đang cập nhật. Tiếp tục nộp bài để mở khóa phần thưởng mới.
                            </p>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        {stats?.activityData && stats.activityData.length > 0 && (
                            <div className="dark-panel p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                                        <Activity className="w-5 h-5 text-indigo-300" />
                                        Lịch sử hoạt động
                                    </h3>
                                    <span className="chip-pill text-xs bg-white/10 text-slate-200">
                                        {stats.activityData.length} ngày có hoạt động
                                    </span>
                                </div>
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={stats.activityData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <XAxis
                                            dataKey="date"
                                            tickLine={false}
                                            axisLine={false}
                                            dy={8}
                                            tick={{ fill: '#cbd5f5', fontSize: 11 }}
                                        />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            width={30}
                                            tick={{ fill: '#cbd5f5', fontSize: 11 }}
                                        />
                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.9rem', color: '#f8fafc' }} />
                                        <Line
                                            type="monotone"
                                            dataKey="submissions"
                                            stroke="#fbbf24"
                                            strokeWidth={3}
                                            dot={stats.activityData.length < 60 ? { r: 3, fill: '#fde68a' } : false}
                                            activeDot={{ r: 6, stroke: '#fef3c7', strokeWidth: 2, fill: '#fbbf24' }}
                                            name="Bài nộp"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="glass-panel p-6">
                                <div className="section-header">
                                    <div className="section-icon">
                                        <GraduationCap className="w-4 h-4" />
                                    </div>
                                    <h3>Học vấn</h3>
                                </div>
                                <div>
                                    {sortedEducation.length > 0 ? (
                                        sortedEducation.map((education: Education, index: number) => (
                                            <div key={education.id || index} className="timeline-item">
                                                <span className="timeline-dot" />
                                                <p className="timeline-title">{education.degree}</p>
                                                <p className="timeline-subtitle">{education.school}</p>
                                                <p className="timeline-duration">{education.duration}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-500">Chưa cập nhật học vấn.</p>
                                    )}
                                </div>
                            </div>

                            <div className="glass-panel p-6">
                                <div className="section-header">
                                    <div className="section-icon">
                                        <Briefcase className="w-4 h-4" />
                                    </div>
                                    <h3>Kinh nghiệm</h3>
                                </div>
                                <div>
                                    {sortedWorkExperience.length > 0 ? (
                                        sortedWorkExperience.map((work: WorkExperience, index: number) => (
                                            <div key={work.id || index} className="timeline-item">
                                                <span className="timeline-dot" />
                                                <p className="timeline-title">{work.title}</p>
                                                <p className="timeline-subtitle">{work.company}</p>
                                                <p className="timeline-duration">{work.duration}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-500">Chưa cập nhật kinh nghiệm làm việc.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
            <style>{`
                .profile-wrapper { background: linear-gradient(180deg, #e0e7ff 0%, #f8fafc 45%, #ffffff 100%); }
                .profile-shell { background: radial-gradient(circle at 15% 15%, rgba(99,102,241,0.12), transparent 45%), #f8fafc; border-radius: 2.5rem 2.5rem 1.5rem 1.5rem; box-shadow: 0 35px 120px rgba(15,23,42,0.08); }
                .profile-hero { border-radius: 2rem; background: linear-gradient(130deg, #0f172a 0%, #1e1b4b 45%, #1d4ed8 100%); color: #f8fafc; border: 1px solid rgba(255,255,255,0.15); position: relative; overflow: hidden; }
                .profile-hero::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 85% 15%, rgba(255,255,255,0.3), transparent 45%); pointer-events: none; }
                .hero-avatar { display: inline-flex; padding: 0.5rem; border-radius: 9999px; background: rgba(15,23,42,0.55); box-shadow: 0 20px 45px rgba(2,6,23,0.5); }
                .status-dot { position: absolute; right: 0.35rem; top: 0.35rem; width: 0.75rem; height: 0.75rem; border-radius: 9999px; background: #34d399; box-shadow: 0 0 10px rgba(52,211,153,0.9); }
                .chip-badge { background: rgba(255,255,255,0.16); color: #e0e7ff; font-size: 0.75rem; padding: 0.2rem 0.8rem; border-radius: 9999px; font-weight: 600; letter-spacing: 0.05em; }
                .chip-pill { background: rgba(255,255,255,0.12); color: #cbd5f5; font-size: 0.75rem; padding: 0.3rem 0.8rem; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.08em; }
                .contact-chip { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 1.1rem; border-radius: 9999px; font-weight: 600; color: #0f172a; background: #f8fafc; border: 1px solid rgba(255,255,255,0.6); box-shadow: 0 14px 35px rgba(15,23,42,0.35); }
                .contact-chip:hover { background: #fff; }
                .hero-btn { border-radius: 9999px; font-weight: 600; font-size: 0.9rem; padding: 0.55rem 1.5rem; transition: transform 0.2s ease, box-shadow 0.2s ease; }
                .hero-btn--primary { background: #fbbf24; color: #1f2937; box-shadow: 0 18px 40px rgba(251,191,36,0.4); }
                .hero-btn--primary:hover { transform: translateY(-1px); box-shadow: 0 20px 50px rgba(251,191,36,0.45); }
                .hero-btn--ghost { border: 1px solid rgba(255,255,255,0.5); color: #f1f5f9; background: transparent; }
                .hero-btn--ghost:hover { background: rgba(255,255,255,0.08); }
                .stats-pill { background: linear-gradient(135deg, #1e1b4b, #312e81); border-radius: 1.5rem; padding: 1.2rem 1.4rem; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 25px 60px rgba(49,46,129,0.35); }
                .stats-pill-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.2em; color: #c7d2fe; }
                .stats-pill-value { font-size: 2rem; font-weight: 700; color: #fff; display: flex; align-items: baseline; gap: 0.5rem; }
                .stats-pill-value span { font-size: 1rem; font-weight: 500; color: #cbd5f5; }
                .glass-panel { background: rgba(255,255,255,0.97); border-radius: 1.5rem; border: 1px solid rgba(148,163,184,0.25); box-shadow: 0 25px 60px rgba(15,23,42,0.08); }
                .dark-panel { border-radius: 1.5rem; border: 1px solid rgba(148,163,184,0.2); background: linear-gradient(145deg, #020617, #0f172a); box-shadow: 0 25px 60px rgba(2,6,23,0.45); }
                .info-list { display: flex; flex-direction: column; gap: 1.5rem; }
                .info-item { display: flex; gap: 0.9rem; align-items: flex-start; }
                .info-icon { width: 2.5rem; height: 2.5rem; border-radius: 1rem; background: rgba(79,70,229,0.08); color: #4f46e5; display: inline-flex; align-items: center; justify-content: center; }
                .section-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.25rem; }
                .section-header h3 { font-size: 1.05rem; font-weight: 700; color: #0f172a; }
                .section-icon { width: 2.25rem; height: 2.25rem; border-radius: 0.9rem; background: rgba(99,102,241,0.12); color: #4f46e5; display: inline-flex; align-items: center; justify-content: center; }
                .info-label { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
                .info-value { font-size: 0.95rem; font-weight: 600; color: #0f172a; }
                .skill-chip { background: #eef2ff; color: #3730a3; padding: 0.35rem 0.9rem; border-radius: 9999px; font-size: 0.82rem; font-weight: 600; border: 1px solid rgba(99,102,241,0.25); }
                .social-chip { border: 1px solid rgba(148,163,184,0.4); border-radius: 9999px; padding: 0.45rem 0.95rem; font-weight: 600; font-size: 0.85rem; color: #475569; display: inline-flex; align-items: center; gap: 0.35rem; transition: transform 0.2s ease, box-shadow 0.2s ease, border 0.2s ease; background: #fff; }
                .social-chip:hover { border-color: #6366f1; color: #4338ca; box-shadow: 0 18px 40px rgba(99,102,241,0.2); transform: translateY(-1px); }
                .timeline-item { position: relative; padding-left: 1.7rem; }
                .timeline-item + .timeline-item { margin-top: 1.2rem; }
                .timeline-item::before { content: ''; position: absolute; left: 0.7rem; top: 0.4rem; bottom: -0.8rem; width: 2px; background: rgba(99,102,241,0.2); }
                .timeline-item:last-child::before { bottom: 0.4rem; }
                .timeline-dot { position: absolute; left: 0.35rem; top: 0.35rem; width: 0.8rem; height: 0.8rem; border-radius: 9999px; background: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.18); }
                .timeline-title { font-weight: 700; color: #0f172a; font-size: 0.95rem; }
                .timeline-subtitle { font-size: 0.85rem; color: #475569; }
                .timeline-duration { font-size: 0.78rem; color: #94a3b8; margin-top: 0.2rem; }
                .achievements-pill { background: rgba(16,185,129,0.12); color: #047857; border-radius: 9999px; padding: 0.3rem 0.9rem; font-weight: 600; font-size: 0.8rem; }
                .summary-card h3 { font-size: 1.1rem; font-weight: 700; color: #0f172a; }
                .summary-card p { color: #475569; font-size: 1rem; }
            `}</style>
        </div>
    );
};
