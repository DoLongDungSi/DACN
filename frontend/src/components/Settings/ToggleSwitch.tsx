import React from 'react';

interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    ariaLabel?: string; // For accessibility
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
    checked,
    onChange,
    disabled = false,
    ariaLabel = "Toggle switch"
}) => {
    const handleToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.checked);
    };

    return (
        <label className="relative inline-flex items-center cursor-pointer" aria-label={ariaLabel}>
            <input
                type="checkbox"
                checked={checked}
                onChange={handleToggle}
                disabled={disabled}
                className="sr-only peer" // Hide the default checkbox
            />
            <div className={`
                w-11 h-6 bg-slate-200 rounded-full
                peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300
                dark:bg-slate-700
                peer-checked:after:translate-x-full peer-checked:after:border-white
                after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                after:bg-white after:border-slate-300 after:border after:rounded-full
                after:h-5 after:w-5 after:transition-all
                dark:border-slate-600 peer-checked:bg-indigo-600
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}></div>
            {/* Optional: Add a label text next to the switch if needed */}
            {/* <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">Toggle me</span> */}
        </label>
    );
};
