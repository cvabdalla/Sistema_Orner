
import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, icon: Icon, color }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 flex items-center space-x-4 hover:shadow-xl transition-shadow duration-300 overflow-hidden">
      <div className={`p-3 rounded-full ${color} flex-shrink-0`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 tracking-wide truncate" title={title}>
            {title}
        </p>
        <p className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate" title={value}>
            {value}
        </p>
      </div>
    </div>
  );
};

export default DashboardCard;