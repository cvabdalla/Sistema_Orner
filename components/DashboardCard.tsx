
import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, icon: Icon, color }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 flex items-center space-x-4 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300 min-w-0">
      <div className={`p-3 rounded-xl ${color} flex-shrink-0 shadow-lg shadow-black/5`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-[10px] font-black text-gray-400 tracking-widest mb-1 leading-tight">
            {title}
        </p>
        <p className="text-xl font-black text-gray-900 dark:text-white leading-none truncate" title={value}>
            {value}
        </p>
      </div>
    </div>
  );
};

export default DashboardCard;
