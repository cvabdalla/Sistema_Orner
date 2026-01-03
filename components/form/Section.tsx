import React from 'react';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

const Section: React.FC<SectionProps> = ({ title, children, className = '' }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md ${className}`}>
      <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">{title}</h3>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

export default Section;
