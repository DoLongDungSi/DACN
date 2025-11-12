import React, { useEffect, useMemo } from 'react';
import { Briefcase, GraduationCap, Award, Activity, Globe, Github, Linkedin, Twitter, MapPin, Mail } from 'lucide-react';
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

    // Safely access profile data
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
    // Sort Education/Work Experience (example: newest first based on duration end year)
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


    return (
        <div className="-m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-7xl mx-auto space-y-8">
                <section className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <UserAvatar user={profileUser} size="w-24 h-24" textClass="text-3xl" />
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{profile.realName || profileUser.username}</h1>
                                <p className="text-slate-500">@{profileUser.username}</p>
                                <p className="text-sm text-slate-400">Tham gia {joinLabel}</p>
                            </div>
                        </div>
                        <div className="flex flex-1 flex-wrap gap-4 justify-start lg:justify-end">
                            {statCards.map(card => (
                                <div key={card.label} className="stats-card min-w-[140px] flex-1">
                                    <p className="stats-label">{card.label}</p>
                                    <p className="stats-value">
                                        {card.value}
                                        {card.suffix && <span className="stats-total">{card.suffix}</span>}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                    {profile.summary && (
                        <p className="mt-6 text-slate-600 leading-relaxed">
                            {profile.summary}
                        </p>
                    )}
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                            <h3 className="font-bold text-lg mb-4 text-slate-800">Thông tin</h3>
                            <ul className="space-y-3 text-sm text-slate-600">
                                {profile.country && (
                                    <li className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-indigo-500" />
                                        {profile.country}
                                    </li>
                                )}
                                {profile.allowJobContact && profileUser.email && (
                                    <li className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-indigo-500" />
                                        <a href={`mailto:${profileUser.email}`} className="hover:underline">{profileUser.email}</a>
                                    </li>
                                )}
                                {profile.gender && (
                                    <li className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-700">Giới tính:</span>
                                        <span>{profile.gender}</span>
                                    </li>
                                )}
                            </ul>
                        </div>

                        {profile.skills && profile.skills.length > 0 && (
                            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                                <h3 className="font-bold text-lg mb-4 text-slate-800">Kỹ năng</h3>
                                <div className="flex flex-wrap gap-2">
                                    {profile.skills.map((skill: string, index: number) => (
                                        <span key={`${skill}-${index}`} className="skill-tag">{skill}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {socialLinks.length > 0 && (
                            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                                <h3 className="font-bold text-lg mb-4 text-slate-800">Liên kết</h3>
                                <div className="flex flex-wrap gap-3">
                                    {socialLinks.map(link => (
                                        <a
                                            key={link.label}
                                            href={link.url!}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                                        >
                                            <link.icon className="w-4 h-4" />
                                            {link.label}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        {stats?.activityData && stats.activityData.length > 0 && (
                            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                                <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center">
                                    <Activity className="w-5 h-5 mr-2 text-indigo-600" />
                                    Lịch sử hoạt động
                                </h3>
                                <ResponsiveContainer width="100%" height={180}>
                                    <LineChart data={stats.activityData} margin={{ top: 5, right: 20, left: -15, bottom: 5 }}>
                                        <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                                        <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} width={35} />
                                        <Tooltip
                                            contentStyle={{ fontSize: '11px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', padding: '4px 8px' }}
                                            itemStyle={{ color: '#4f46e5' }}
                                            labelStyle={{ color: '#64748b', fontSize: '11px' }}
                                            labelFormatter={(_, payload) => payload?.[0]?.payload.isoDate ? format(parseISO(payload[0].payload.isoDate), 'MMM dd, yyyy') : ''}
                                            formatter={(value: number) => [`${value} bài`, 'Nộp']}
                                        />
                                        <Line type="monotone" dataKey="submissions" stroke="#4f46e5" strokeWidth={2} dot={stats.activityData.length < 60 ? { r: 3, fill: '#818cf8' } : false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: '#4f46e5' }} name="Bài nộp" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {sortedEducation.length > 0 && (
                            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                                <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center"> <GraduationCap className="icon" /> Học vấn </h3>
                                <ul className="space-y-4">
                                    {sortedEducation.map((edu: Education, index: number) => (
                                        <li key={edu.id ?? `edu-${index}`} className="item-detail">
                                            <p className="font-semibold text-slate-700">{edu.degree || 'N/A'} - {edu.school || 'N/A'}</p>
                                            <p className="text-slate-500 text-xs">{edu.duration || 'N/A'}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {sortedWorkExperience.length > 0 && (
                            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                                <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center"> <Briefcase className="icon" /> Kinh nghiệm làm việc </h3>
                                <ul className="space-y-4">
                                    {sortedWorkExperience.map((work: WorkExperience, index: number) => (
                                        <li key={work.id ?? `work-${index}`} className="item-detail">
                                            <p className="font-semibold text-slate-700">{work.title || 'N/A'} - {work.company || 'N/A'}</p>
                                            <p className="text-slate-500 text-xs">{work.duration || 'N/A'}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                            <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center">
                                <Award className="icon" />
                                Thành tích
                            </h3>
                            <p className="text-sm text-slate-500 italic">
                                Tính năng thành tích/huy hiệu sẽ sớm xuất hiện tại đây. Hãy tiếp tục chinh phục các bài toán để mở khóa danh hiệu!
                            </p>
                        </div>
                    </div>
                </section>
            </div>
             <style>{`
                .skill-tag { background-color: #eef2ff; color: #4338ca; font-size: 0.75rem; font-weight: 500; padding: 0.25rem 0.75rem; border-radius: 9999px; border: 1px solid #c7d2fe; }
                .stats-card { background-color: white; border-radius: 0.75rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); padding: 1rem 1.25rem; border: 1px solid #e2e8f0; text-align: center; }
                .stats-label { font-weight: 500; color: #64748b; font-size: 0.75rem; line-height: 1rem; margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .stats-value { font-size: 1.6rem; line-height: 2.25rem; font-weight: 700; color: #1e293b; display: flex; align-items: baseline; justify-content: center; column-gap: 0.35rem; }
                .stats-total { font-size: 0.9rem; line-height: 1.25rem; font-weight: 500; color: #94a3b8; }
                .icon { width: 1.125rem; height: 1.125rem; margin-right: 0.625rem; color: #4f46e5; flex-shrink: 0; }
                .item-detail { font-size: 0.875rem; line-height: 1.25rem; position: relative; padding-left: 1.5rem; }
                .item-detail::before { content: ''; position: absolute; left: 0.25rem; top: 0.25rem; bottom: 0.25rem; width: 2px; background-color: #c7d2fe; border-radius: 1px; }
             `}</style>
        </div>
    );
};
