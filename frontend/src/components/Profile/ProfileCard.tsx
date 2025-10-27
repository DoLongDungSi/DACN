import React from 'react';
import { Globe, Github, Linkedin, Twitter } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { User } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';

interface ProfileCardProps {
    profileUser: User; // Pass the user object whose profile is being displayed
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ profileUser }) => {
    const profile = profileUser.profile || {}; // Ensure profile exists, provide default empty object

    // Helper to add https:// if missing
    const formatUrl = (url: string | undefined): string | undefined => {
        if (!url) return undefined;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return `https://${url}`;
        }
        return url;
    };


    return (
        <div className="bg-white rounded-xl shadow-lg p-6 text-center border border-slate-200">
            {/* Avatar */}
            <div className="flex justify-center mb-4">
                <UserAvatar user={profileUser} size="w-32 h-32" textClass="text-5xl" />
            </div>

            {/* Names */}
            <h2 className="text-3xl font-bold mt-4 text-slate-800 break-words">
                {profile.realName || profileUser.username}
            </h2>
            <p className="text-slate-500 text-lg">@{profileUser.username}</p>

            {/* Social Links */}
            <div className="flex justify-center space-x-4 mt-4 text-slate-400">
                {profile.github && formatUrl(profile.github) && (
                    <a
                        href={formatUrl(profile.github)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-slate-600 transition-colors"
                        title="GitHub"
                        aria-label="GitHub profile"
                    >
                        <Github />
                    </a>
                )}
                 {profile.linkedin && formatUrl(profile.linkedin) && (
                    <a
                        href={formatUrl(profile.linkedin)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-slate-600 transition-colors"
                        title="LinkedIn"
                         aria-label="LinkedIn profile"
                   >
                        <Linkedin />
                    </a>
                )}
                {profile.twitter && formatUrl(profile.twitter) && (
                    <a
                        href={formatUrl(profile.twitter)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-slate-600 transition-colors"
                        title="Twitter/X"
                        aria-label="Twitter profile"
                    >
                        <Twitter />
                    </a>
                )}
                {profile.website && formatUrl(profile.website) && (
                    <a
                         href={formatUrl(profile.website)}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="hover:text-slate-600 transition-colors"
                         title="Website"
                         aria-label="Personal website"
                    >
                        <Globe />
                    </a>
                )}
            </div>

            {/* Summary */}
            {profile.summary && (
                <p className="text-slate-600 text-sm mt-4 text-center">{profile.summary}</p>
            )}

            {/* Joined Date */}
            <p className="text-xs text-slate-400 mt-4">
                Tham gia {profileUser.joinedAt ? formatDistanceToNow(parseISO(profileUser.joinedAt), { addSuffix: true }) : 'N/A'}
            </p>
        </div>
    );
};


