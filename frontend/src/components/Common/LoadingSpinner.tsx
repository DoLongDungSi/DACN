import React from 'react';

export const LoadingSpinner: React.FC<{ overlay?: boolean }> = ({ overlay = false }) => {
  const spinner = (
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 bg-white/70 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};
