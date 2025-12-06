import React, { useMemo } from 'react';

interface User {
    username: string;
    avatarUrl?: string | null;
}

interface UserAvatarProps {
    user?: User | null;
    size?: 'sm' | 'md' | 'lg' | 'xl' | string; // Hỗ trợ cả preset và class tùy chỉnh
    className?: string;
    textClass?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
    user, 
    size = 'md', 
    className = '',
    textClass
}) => {
    // Map các size chuẩn sang Tailwind classes
    const sizeClasses: Record<string, string> = {
        xs: 'w-6 h-6 text-xs',
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-16 h-16 text-xl',
        '2xl': 'w-24 h-24 text-3xl'
    };

    // Nếu size truyền vào là key trong map thì dùng, không thì dùng nguyên chuỗi đó (cho phép custom w-[px])
    const finalSizeClass = sizeClasses[size] || size;
    
    // Tạo màu nền ngẫu nhiên dựa trên tên user nếu không có ảnh
    const bgColor = useMemo(() => {
        if (!user?.username) return 'bg-slate-200';
        const colors = [
            'bg-red-500', 'bg-orange-500', 'bg-amber-500', 
            'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 
            'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 
            'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
        ];
        let hash = 0;
        for (let i = 0; i < user.username.length; i++) {
            hash = user.username.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }, [user?.username]);

    const initial = user?.username ? user.username.charAt(0).toUpperCase() : '?';

    return (
        <div 
            className={`
                relative rounded-full flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 shadow-sm
                ${finalSizeClass} 
                ${!user?.avatarUrl ? bgColor : 'bg-slate-100'}
                ${className}
            `}
        >
            {user?.avatarUrl ? (
                <img 
                    src={user.avatarUrl} 
                    alt={user.username} 
                    className="w-full h-full object-cover" // Quan trọng: Giúp ảnh không bị méo
                    onError={(e) => {
                        // Fallback nếu ảnh lỗi
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            ) : (
                <span className={`font-bold text-white leading-none ${textClass || ''}`}>
                    {initial}
                </span>
            )}
        </div>
    );
};