
import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, icon: Icon, color }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-150 dark:border-gray-700/80 p-4 flex flex-col justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden group min-w-0 min-h-[100px]">
      {/* Decorative background subtle glow/pattern */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800 dark:to-gray-750/30 rounded-full blur-2xl -mr-6 -mt-6 transition-transform group-hover:scale-110 duration-500" />
      
      <div className="flex items-start justify-between relative z-10 gap-3">
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wide leading-snug font-sans break-words line-clamp-2 max-h-[2.8rem] flex-1" title={title}>
          {title}
        </span>
        <div className={`p-1.5 rounded-lg ${color} text-white shadow-md shadow-black/5 flex-shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      
      <div className="mt-2.5 relative z-10">
        <h3 className="text-base sm:text-lg lg:text-sm xl:text-lg font-black text-gray-900 dark:text-white tracking-tight leading-none whitespace-nowrap overflow-hidden text-ellipsis" title={value}>
          {value}
        </h3>
      </div>
    </div>
  );
};

export default DashboardCard;
