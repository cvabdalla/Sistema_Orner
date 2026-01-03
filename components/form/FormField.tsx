
import React, { ChangeEvent } from 'react';

// Helper to format numbers as BRL currency with rounding up
const formatCurrency = (value: number | string | undefined) => {
  if (value === undefined || value === null || value === '') return 'R$ 0,00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';
  const rounded = Math.ceil(num * 100) / 100;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(rounded);
};

interface FormFieldProps {
  label: string;
  value: string | number;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  isCurrency?: boolean;
  isPercentage?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  name?: string;
  className?: string;
  type?: 'text' | 'number';
}

const FormField: React.FC<FormFieldProps> = ({ 
    label, 
    value, 
    onChange, 
    isCurrency = false, 
    isPercentage = false, 
    readOnly = false,
    placeholder = '0',
    name,
    className,
    type = 'number'
}) => {
  const displayValue = readOnly && isCurrency ? formatCurrency(value) : value;
  const isText = type === 'text';
  
  return (
    <div className={`flex items-center justify-between text-xs ${className}`}>
      <label htmlFor={name} className="text-gray-600 dark:text-gray-400 font-medium">{label}</label>
      {readOnly ? (
        <span className={`font-semibold text-gray-800 dark:text-white ${isText ? 'text-left' : ''}`}>
          {isPercentage ? `${displayValue}%` : displayValue}
        </span>
      ) : (
        <div className="relative">
          {isCurrency && !isText && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 z-10 text-[10px]">R$</span>}
           <input
            id={name}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            placeholder={placeholder}
            className={`${isText ? 'w-40 text-left pl-2' : 'w-24 text-right'} rounded border-gray-300 dark:border-gray-600 py-1 text-xs focus:ring-indigo-500 focus:border-indigo-500 
            ${!readOnly ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-500'} 
            ${isCurrency && !isText ? 'pl-7' : ''} ${isPercentage && !isText ? 'pr-6' : ''}`}
          />
          {isPercentage && !isText && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">%</span>}
        </div>
      )}
    </div>
  );
};

export default FormField;
