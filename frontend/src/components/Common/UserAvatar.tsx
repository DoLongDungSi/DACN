
import React from 'react';
import { User, DiscussionPost, DiscussionComment } from '../../types';

interface UserAvatarProps {
  user: User | DiscussionPost | DiscussionComment | null; // Allow null
  size?: string;
  textClass?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = "w-10 h-10",
  textClass = "text-lg",
}) => {
  // Handle null user case gracefully
  if (!user) {
    // Render a placeholder or default avatar
    return (
      <div
        className={`${size} rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-slate-300`}
        aria-label="Default user avatar"
      >
        <span className={`font-bold text-white ${textClass}`}>?</span>
      </div>
    );
  }

  const initial = user.username ? user.username[0].toUpperCase() : '?'; // Handle potentially missing username

  return (
    <div
      className={`${size} rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${
        user.avatarUrl ? 'bg-slate-200' : user.avatarColor || 'bg-slate-400' // Default color if none provided
      }`}
      aria-label={`Avatar for ${user.username || 'user'}`}
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.username || 'User Avatar'}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Optional: Handle image loading errors, e.g., show initials
            const target = e.target as HTMLImageElement;
            target.style.display = 'none'; // Hide broken image
            // Optionally, replace with initials container
            const parent = target.parentElement;
            if (parent) {
              // Check if initials aren't already there
              if (!parent.querySelector('.initials-fallback')) {
                  const initialsSpan = document.createElement('span');
                  initialsSpan.className = `font-bold text-white ${textClass} initials-fallback`;
                  initialsSpan.textContent = initial;
                  parent.appendChild(initialsSpan);
                  parent.classList.add(user.avatarColor || 'bg-slate-400'); // Add background color back
              }
            }

          }}
        />
      ) : (
        <span className={`font-bold text-white ${textClass}`}>
          {initial}
        </span>
      )}
    </div>
  );
};
