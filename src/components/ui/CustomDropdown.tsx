import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="field-label">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="field-input flex items-center justify-between text-left group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-3 truncate">
          {selectedOption?.icon}
          <span className={!selectedOption ? 'text-ink-400' : 'text-ink-900 font-medium'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-ink-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          } group-hover:text-ink-600`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-[9999] w-full mt-2 bg-white border border-ink-100 rounded-xl shadow-modal overflow-hidden animate-scale-in origin-top">
          <div className="max-h-60 overflow-y-auto py-1 scrollbar-custom bg-white relative z-[10000]">
            {options.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-400 text-center italic">
                No options available
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-all hover:bg-ink-50 ${
                    value === option.id ? 'bg-brand-50/50 text-brand-700 font-semibold' : 'text-ink-700'
                  }`}
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className={`flex-shrink-0 transition-colors ${value === option.id ? 'text-brand-600' : 'text-ink-400'}`}>
                      {option.icon}
                    </div>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      {option.description && (
                        <span className="text-2xs text-ink-400 font-normal mt-0.5">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </div>
                  {value === option.id && (
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center">
                      <Check className="w-3 h-3 text-brand-700" strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
