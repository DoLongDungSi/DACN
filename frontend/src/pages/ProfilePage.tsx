import React, { useEffect, useMemo } from 'react';
import { Briefcase, GraduationCap } from 'lucide-react'; // Import icons
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, formatDistanceToNow, startOfDay } from 'date-fns';
import { useAppContext } from '../hooks/useAppContext';
import { Submission, LeaderboardEntry, Education, WorkExperience, User } from '../types'; // Import User type
import { ProfileCard } from '../components/Profile/ProfileCard'; // Import ProfileCard

export const ProfilePage: React.FC = () => {
    // Get necessary state and functions from context
    const { users, viewingUserId, currentUser, submissions, problems, leaderboardData, setPage, setError, loading } = useAppContext();

    // Determine whose profile to show
    const profileUserId = viewingUserId ?? currentUser?.id;
    // Find the user data based on the ID
    const profileUser = useMemo(() => users.find((u) => u.id === profileUserId), [users, profileUserId]);

     // Redirect if user not found after data load
     useEffect(() => {
         // Only redirect if not loading, users are loaded, profileUserId exists, but profileUser is not found
        if (!loading && users.length > 0 && profileUserId && !profileUser) {
            console.warn(`User with ID ${profileUserId} not found. Redirecting.`);
            setError(`Không tìm thấy người dùng.`); // More generic error
            setPage('problems');
        }
    }, [profileUser, profileUserId, users, setPage, setError, loading]); // Added loading dependency


    // Calculate user stats, memoized for performance
    const stats = useMemo(() => {
        const calculateUserStats = (userId: number | undefined): {
            solvedProblems: number;
            totalSubmissions: number;
            bestRank: number | string;
            successRate: number;
            activityData: { date: string; isoDate: string; submissions: number }[];
         } | null => {
            if (userId === undefined || !users.length || !submissions.length) return null; // Ensure data dependencies exist

            const user = users.find((u) => u.id === userId);
            if (!user) return null;

            const userSubs = submissions.filter((s: Submission) => s.userId === userId);
            const totalSubmissionsCount = userSubs.length;
            if (totalSubmissionsCount === 0) { // Handle case with no submissions
                return { solvedProblems: 0, totalSubmissions: 0, bestRank: '-', successRate: 0, activityData: [] };
            }

            const solvedProblemsCount = new Set(userSubs.map((s: Submission) => s.problemId)).size;

            const userRanks = Object.values(leaderboardData)
                .flat()
                .filter((e: LeaderboardEntry) => e.username === user.username && typeof e.rank === 'number')
                .map((e: LeaderboardEntry) => e.rank as number);
            const bestRankValue = userRanks.length > 0 ? Math.min(...userRanks) : null;

            // Generate activity data for ALL TIME and AGGREGATE by day
            const activityMap = new Map<string, number>();
            userSubs.forEach((s: Submission) => {
                try {
                    if (s.submittedAt) { // Check if submittedAt exists
                        const submissionDate = startOfDay(parseISO(s.submittedAt));
                        const dateString = format(submissionDate, 'yyyy-MM-dd');
                        activityMap.set(dateString, (activityMap.get(dateString) || 0) + 1);
                    }
                } catch (e) { console.error("Error parsing date:", s.submittedAt, e); }
            });

            const activityData = Array.from(activityMap.entries())
                .map(([dateString, count]) => ({
                    date: format(parseISO(dateString), 'MMM dd'), // Format for display
                    isoDate: dateString, // Keep ISO for sorting
                    submissions: count,
                }))
                .sort((a, b) => a.isoDate.localeCompare(b.isoDate)); // Sort chronologically

            const successfulSubs = userSubs.filter((s: Submission) => s.status === 'succeeded').length;
            const successRateValue = Math.round((successfulSubs / totalSubmissionsCount) * 100);

            return {
                solvedProblems: solvedProblemsCount,
                totalSubmissions: totalSubmissionsCount,
                bestRank: bestRankValue === null ? '-' : bestRankValue,
                successRate: successRateValue,
                activityData: activityData,
            };
        };
        return calculateUserStats(profileUser?.id);
    }, [profileUser, users, submissions, leaderboardData, problems.length]); // Dependencies


    // Display loading state or if user not found yet
    if (loading || !profileUser) {
        return <div className="p-8 text-center text-slate-500">Đang tải hồ sơ người dùng...</div>;
    }

    // Safely access profile data
    const profile = profileUser.profile || {};
    const sortedEducation = profile.education?.sort(/* Add sorting logic if needed, e.g., by duration */) || [];
    const sortedWorkExperience = profile.workExperience?.sort(/* Add sorting logic if needed */) || [];


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-1 space-y-8">
                 {/* Use ProfileCard component */}
                 <ProfileCard profileUser={profileUser} />

                 {profile.skills && profile.skills.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                        <h3 className="font-bold text-lg mb-4 text-slate-800">Kỹ năng</h3>
                        <div className="flex flex-wrap gap-2">
                            {profile.skills.map((skill: string) => (
                                <span key={skill} className="skill-tag"> {skill} </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column */}
            <div className="lg:col-span-2 space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                     <div className="stats-card"> <h4 className="stats-label">Đã giải</h4> <p className="stats-value">{stats?.solvedProblems ?? 0}<span className="stats-total"> / {problems.length}</span></p> </div>
                     <div className="stats-card"> <h4 className="stats-label">Lượt nộp</h4> <p className="stats-value">{stats?.totalSubmissions ?? 0}</p> </div>
                     <div className="stats-card"> <h4 className="stats-label">Hạng cao nhất</h4> <p className="stats-value">{stats?.bestRank ?? '-'}</p> </div>
                     <div className="stats-card"> <h4 className="stats-label">Tỷ lệ thành công</h4> <p className="stats-value">{stats?.successRate ?? 0}%</p> </div>
                 </div>

                {/* Activity Chart */}
                 {stats && stats.activityData && stats.activityData.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                        <h3 className="font-bold text-lg mb-4 text-slate-800">Lịch sử hoạt động (Theo ngày)</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={stats.activityData} margin={{ top: 5, right: 20, left: -15, bottom: 5 }}> {/* Adjusted left margin */}
                                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" dy={5}/> {/* Added dy */}
                                <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} width={30}/> {/* Reduced font size */}
                                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }} itemStyle={{ color: '#4f46e5' }} labelStyle={{ color: '#64748b' }} labelFormatter={(label, payload) => payload?.[0]?.payload.isoDate ? format(parseISO(payload[0].payload.isoDate), 'MMM dd, yyyy') : label } />
                                <Line type="monotone" dataKey="submissions" stroke="#4f46e5" strokeWidth={2} dot={stats.activityData.length < 50} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: '#4f46e5' }} name="Bài nộp" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                 {/* Education */}
                 {sortedEducation.length > 0 && (
                     <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                         <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center"> <GraduationCap className="icon"/> Học vấn </h3>
                         <ul className="space-y-4">
                             {sortedEducation.map((edu: Education) => ( <li key={edu.id} className="item-detail"> <p className="font-semibold text-slate-700">{edu.degree} - {edu.school}</p> <p className="text-slate-500 text-xs">{edu.duration || 'N/A'}</p> </li> ))}
                         </ul>
                     </div>
                 )}

                 {/* Work Experience */}
                 {sortedWorkExperience.length > 0 && (
                     <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                         <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center"> <Briefcase className="icon"/> Kinh nghiệm làm việc </h3>
                         <ul className="space-y-4">
                             {sortedWorkExperience.map((work: WorkExperience) => ( <li key={work.id} className="item-detail"> <p className="font-semibold text-slate-700">{work.title} - {work.company}</p> <p className="text-slate-500 text-xs">{work.duration || 'N/A'}</p> </li> ))}
                         </ul>
                     </div>
                 )}

            </div>
             {/* Simple Styles (move to CSS) */}
             <style>{`
                .skill-tag { background-color: #e0e7ff; color: #3730a3; font-size: 0.875rem; font-weight: 500; padding: 0.25rem 0.75rem; border-radius: 9999px; }
                .stats-card { background-color: white; border-radius: 0.75rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1); padding: 1rem; border: 1px solid #e2e8f0; }
                .stats-label { font-weight: 600; color: #64748b; font-size: 0.75rem; line-height: 1rem; margin-bottom: 0.25rem; }
                .stats-value { font-size: 1.875rem; line-height: 2.25rem; font-weight: 700; color: #1e293b; }
                .stats-total { font-size: 1rem; line-height: 1.5rem; font-weight: 400; color: #94a3b8; }
                .icon { width: 1.25rem; height: 1.25rem; margin-right: 0.5rem; color: #4f46e5; }
                .item-detail { font-size: 0.875rem; line-height: 1.25rem; border-left-width: 2px; border-color: #c7d2fe; padding-left: 1rem; }
            `}</style>
        </div>
    );
};

