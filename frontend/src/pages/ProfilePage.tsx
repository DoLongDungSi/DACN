import React, { useEffect, useMemo } from 'react';
import { Briefcase, GraduationCap, Award, Activity } from 'lucide-react'; // Added Award, Activity icons
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, formatDistanceToNow, startOfDay } from 'date-fns';
import { useAppContext } from '../hooks/useAppContext';
import { Submission, LeaderboardEntry, Education, WorkExperience, User } from '../types';
import { ProfileCard } from '../components/Profile/ProfileCard';
import { LoadingSpinner } from '../components/Common/LoadingSpinner'; // Import LoadingSpinner

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
        // Adjusted grid layout: lg:grid-cols-3 -> lg:grid-cols-4
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Column (Profile Card + Skills) - Takes 1 column */}
            <div className="lg:col-span-1 space-y-8">
                 <ProfileCard profileUser={profileUser} />

                 {profile.skills && profile.skills.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                        <h3 className="font-bold text-lg mb-4 text-slate-800">Kỹ năng</h3>
                        <div className="flex flex-wrap gap-2">
                            {profile.skills.map((skill: string, index: number) => ( // Added index for key
                                <span key={`${skill}-${index}`} className="skill-tag"> {skill} </span>
                            ))}
                        </div>
                    </div>
                )}
                 {/* Placeholder for Languages if needed */}
                 {/* <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                    <h3 className="font-bold text-lg mb-4 text-slate-800">Ngôn ngữ</h3>
                     {/* ... language list ... */}
                 {/* </div> */}
            </div>

            {/* Right Column (Stats, Activity, Education, Work, Achievements) - Takes 3 columns */}
            <div className="lg:col-span-3 space-y-8">
                {/* Stats Cards - Removed Success Rate */}
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6"> {/* Changed to 3 columns */}
                     <div className="stats-card"> <h4 className="stats-label">Đã giải</h4> <p className="stats-value">{stats?.solvedProblems ?? 0}<span className="stats-total"> / {problems.length}</span></p> </div>
                     <div className="stats-card"> <h4 className="stats-label">Lượt nộp</h4> <p className="stats-value">{stats?.totalSubmissions ?? 0}</p> </div>
                     <div className="stats-card"> <h4 className="stats-label">Hạng cao nhất</h4> <p className="stats-value">{stats?.bestRank ?? '-'}</p> </div>
                     {/* Removed Success Rate Card */}
                 </div>

                {/* Activity Chart */}
                 {stats?.activityData && stats.activityData.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                         <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center">
                            <Activity className="w-5 h-5 mr-2 text-indigo-600"/>
                            Lịch sử hoạt động
                        </h3>
                        <ResponsiveContainer width="100%" height={150}> {/* Reduced height slightly */}
                            <LineChart data={stats.activityData} margin={{ top: 5, right: 20, left: -15, bottom: 5 }}>
                                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" dy={5}/>
                                <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} width={30}/>
                                <Tooltip
                                    contentStyle={{ fontSize: '11px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', padding: '4px 8px' }} // Adjusted style
                                    itemStyle={{ color: '#4f46e5' }}
                                    labelStyle={{ color: '#64748b', fontSize: '10px' }} // Adjusted style
                                    labelFormatter={(label, payload) => payload?.[0]?.payload.isoDate ? format(parseISO(payload[0].payload.isoDate), 'MMM dd, yyyy') : label }
                                    formatter={(value: number) => [`${value} bài`, 'Nộp']} // Custom formatter
                                 />
                                <Line type="monotone" dataKey="submissions" stroke="#4f46e5" strokeWidth={2} dot={stats.activityData.length < 60 ? { r: 3, fill: '#818cf8' } : false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: '#4f46e5' }} name="Bài nộp" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                 {/* Education */}
                 {sortedEducation.length > 0 && (
                     <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                         <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center"> <GraduationCap className="icon"/> Học vấn </h3>
                         <ul className="space-y-4">
                              {/* Ensure unique key */}
                             {sortedEducation.map((edu: Education, index: number) => ( <li key={edu.id ?? `edu-${index}`} className="item-detail"> <p className="font-semibold text-slate-700">{edu.degree || 'N/A'} - {edu.school || 'N/A'}</p> <p className="text-slate-500 text-xs">{edu.duration || 'N/A'}</p> </li> ))}
                         </ul>
                     </div>
                 )}

                 {/* Work Experience */}
                 {sortedWorkExperience.length > 0 && (
                     <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                         <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center"> <Briefcase className="icon"/> Kinh nghiệm làm việc </h3>
                         <ul className="space-y-4">
                             {/* Ensure unique key */}
                             {sortedWorkExperience.map((work: WorkExperience, index: number) => ( <li key={work.id ?? `work-${index}`} className="item-detail"> <p className="font-semibold text-slate-700">{work.title || 'N/A'} - {work.company || 'N/A'}</p> <p className="text-slate-500 text-xs">{work.duration || 'N/A'}</p> </li> ))}
                         </ul>
                     </div>
                 )}

                 {/* Achievements Placeholder */}
                 <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                    <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center">
                        <Award className="icon"/>
                        Thành tích
                     </h3>
                    <p className="text-sm text-slate-500 italic">
                        (Tính năng thành tích/huy hiệu chưa được cài đặt. Dữ liệu sẽ được hiển thị ở đây trong tương lai.)
                        {/* Example structure if data existed: */}
                        {/* <div className="grid grid-cols-3 gap-4">
                            <div className="flex flex-col items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg"> <Star className="w-8 h-8 text-yellow-500 mb-1"/> <span className="text-xs font-medium text-yellow-700">Top 10%</span> </div>
                            <div className="flex flex-col items-center p-3 bg-slate-50 border border-slate-200 rounded-lg"> <Medal className="w-8 h-8 text-slate-500 mb-1"/> <span className="text-xs font-medium text-slate-700">5 Problems Solved</span> </div>
                        </div> */}
                    </p>
                </div>

            </div>
             {/* Styles */}
             <style>{`
                .skill-tag { background-color: #eef2ff; color: #4338ca; font-size: 0.75rem; font-weight: 500; padding: 0.25rem 0.75rem; border-radius: 9999px; border: 1px solid #c7d2fe; }
                .stats-card { background-color: white; border-radius: 0.75rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); padding: 1rem 1.25rem; border: 1px solid #e2e8f0; text-align: center; }
                .stats-label { font-weight: 500; color: #64748b; font-size: 0.75rem; line-height: 1rem; margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .stats-value { font-size: 1.5rem; line-height: 2rem; font-weight: 700; color: #1e293b; display: flex; align-items: baseline; justify-content: center; }
                .stats-total { font-size: 0.875rem; line-height: 1.25rem; font-weight: 500; color: #94a3b8; margin-left: 0.25rem; }
                .icon { width: 1.125rem; height: 1.125rem; margin-right: 0.625rem; color: #4f46e5; flex-shrink: 0; }
                .item-detail { font-size: 0.875rem; line-height: 1.25rem; position: relative; padding-left: 1.5rem; }
                .item-detail::before { content: ''; position: absolute; left: 0.25rem; top: 0.25rem; bottom: 0.25rem; width: 2px; background-color: #c7d2fe; border-radius: 1px; }
             `}</style>
        </div>
    );
};
