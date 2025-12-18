import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Calendar } from 'lucide-react';

interface ScrollDatePickerProps {
  value: string; // Format: YYYY-MM-DD
  onChange: (date: string) => void;
  error?: string;
}

export const ScrollDatePicker: React.FC<ScrollDatePickerProps> = ({
  value,
  onChange,
  error,
}) => {
  const [day, setDay] = useState<number>(1);
  const [month, setMonth] = useState<number>(1);
  const [year, setYear] = useState<number>(2000);
  const [isScrolling, setIsScrolling] = useState(false);

  const dayRef = useRef<HTMLDivElement>(null);
  const monthRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);
  
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  
  const ITEM_HEIGHT = 40;
  const VISIBLE_ITEMS = 5;
  const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

  // Memoized data arrays
  const monthNames = useMemo(() => 
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], 
    []
  );

  const days = useMemo(() => 
    Array.from({ length: 31 }, (_, i) => i + 1), 
    []
  );

  const months = useMemo(() => 
    Array.from({ length: 12 }, (_, i) => i + 1), 
    []
  );

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - 1919 }, (_, i) => 1920 + i).reverse();
  }, []);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        setDay(date.getDate());
        setMonth(date.getMonth() + 1);
        setYear(date.getFullYear());
      }
    } else if (!isInitializedRef.current) {
      const today = new Date();
      setDay(today.getDate());
      setMonth(today.getMonth() + 1);
      setYear(today.getFullYear());
    }
    isInitializedRef.current = true;
  }, [value]);

  // Generate date string when values change
  useEffect(() => {
    if (!isInitializedRef.current || isScrolling) return;
    
    const daysInMonth = new Date(year, month, 0).getDate();
    const validDay = Math.min(day, daysInMonth);
    
    if (validDay !== day) {
      setDay(validDay);
      return;
    }

    const dateString = `${year}-${String(month).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
    onChange(dateString);
  }, [day, month, year, onChange, isScrolling]);

  // Scroll to selected value on mount
  useEffect(() => {
    const scrollToValue = (ref: React.RefObject<HTMLDivElement>, value: number, items: number[]) => {
      if (ref.current) {
        const index = items.indexOf(value);
        if (index !== -1) {
          const scrollTop = index * ITEM_HEIGHT;
          ref.current.scrollTop = scrollTop;
        }
      }
    };

    // Small delay to ensure DOM is ready
    setTimeout(() => {
      scrollToValue(dayRef, day, days);
      scrollToValue(monthRef, month, months);
      scrollToValue(yearRef, year, years);
    }, 100);

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [days, months, years]);

  // Handle scroll end with debouncing
  const handleScrollEnd = useCallback((
    type: 'day' | 'month' | 'year',
    ref: React.RefObject<HTMLDivElement>,
    items: number[]
  ) => {
    if (!ref.current) return;

    setIsScrolling(true);
    
    const container = ref.current;
    const scrollTop = container.scrollTop;
    const index = Math.round(scrollTop / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
    const selectedValue = items[clampedIndex];

    // Update state based on type
    if (type === 'day') {
      const daysInMonth = new Date(year, month, 0).getDate();
      const validDay = Math.min(selectedValue, daysInMonth);
      setDay(validDay);
    } else if (type === 'month') {
      setMonth(selectedValue);
      const daysInNewMonth = new Date(year, selectedValue, 0).getDate();
      if (day > daysInNewMonth) {
        setDay(daysInNewMonth);
      }
    } else {
      setYear(selectedValue);
      const daysInNewMonth = new Date(selectedValue, month, 0).getDate();
      if (day > daysInNewMonth) {
        setDay(daysInNewMonth);
      }
    }

    // Snap to position
    requestAnimationFrame(() => {
      if (ref.current) {
        const targetScrollTop = clampedIndex * ITEM_HEIGHT;
        ref.current.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        });
      }
      // Reset scrolling state after animation
      setTimeout(() => setIsScrolling(false), 300);
    });
  }, [day, month, year]);

  // Create scroll handlers with proper debouncing
  const createScrollHandler = useCallback((
    type: 'day' | 'month' | 'year',
    ref: React.RefObject<HTMLDivElement>,
    items: number[]
  ) => {
    return () => {
      setIsScrolling(true);
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        handleScrollEnd(type, ref, items);
      }, 150);
    };
  }, [handleScrollEnd]);

  // ScrollColumn component moved outside for better performance
  const ScrollColumn = React.useMemo(() => 
    React.forwardRef<
      HTMLDivElement,
      {
        items: number[];
        selected: number;
        label: string;
        type: 'day' | 'month' | 'year';
        formatValue?: (value: number) => string;
        onScroll: () => void;
        onClick: (value: number) => void;
      }
    >(({ 
      items, 
      selected, 
      label, 
      type, 
      formatValue, 
      onScroll,
      onClick 
    }, ref) => {
      
      const getDisplayValue = (value: number) => {
        if (formatValue) {
          return formatValue(value);
        }
        return value.toString().padStart(2, '0');
      };

      return (
        <div className="flex-1 flex flex-col items-center">
          <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
            {label}
          </div>
          <div 
            className="relative w-full overflow-hidden"
            style={{ height: CONTAINER_HEIGHT }}
          >
            {/* Selection highlight */}
            <div 
              className="absolute top-1/2 left-0 right-0 transform -translate-y-1/2 z-0 pointer-events-none"
              style={{ height: ITEM_HEIGHT }}
            >
              <div className="h-full bg-white/10 rounded-lg mx-1" />
            </div>
            
            <div
              ref={ref}
              className="h-full overflow-y-scroll scrollbar-hide relative z-10"
              onScroll={onScroll}
            >
              {/* Top padding */}
              <div style={{ height: ITEM_HEIGHT * 2 }} />
              
              {/* Items */}
              {items.map((item) => {
                const isSelected = selected === item;
                
                return (
                  <div
                    key={item}
                    className="flex items-center justify-center cursor-pointer transition-all duration-200"
                    style={{ height: ITEM_HEIGHT }}
                    onClick={() => onClick(item)}
                  >
                    <span
                      className={`select-none transition-all duration-200 ${
                        isSelected 
                          ? 'text-white font-bold text-base scale-110' 
                          : 'text-gray-400 text-sm opacity-70 hover:opacity-100'
                      }`}
                    >
                      {getDisplayValue(item)}
                    </span>
                  </div>
                );
              })}
              
              {/* Bottom padding */}
              <div style={{ height: ITEM_HEIGHT * 2 }} />
            </div>
          </div>
        </div>
      );
    }),
    [CONTAINER_HEIGHT, ITEM_HEIGHT]
  );

  // Handlers for column clicks
  const handleDayClick = useCallback((value: number) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const validDay = Math.min(value, daysInMonth);
    setDay(validDay);
    
    if (dayRef.current) {
      const index = days.indexOf(validDay);
      dayRef.current.scrollTo({
        top: index * ITEM_HEIGHT,
        behavior: 'smooth',
      });
    }
  }, [year, month, days]);

  const handleMonthClick = useCallback((value: number) => {
    setMonth(value);
    const daysInNewMonth = new Date(year, value, 0).getDate();
    if (day > daysInNewMonth) {
      setDay(daysInNewMonth);
    }
    
    if (monthRef.current) {
      const index = months.indexOf(value);
      monthRef.current.scrollTo({
        top: index * ITEM_HEIGHT,
        behavior: 'smooth',
      });
    }
  }, [year, day, months]);

  const handleYearClick = useCallback((value: number) => {
    setYear(value);
    const daysInNewMonth = new Date(value, month, 0).getDate();
    if (day > daysInNewMonth) {
      setDay(daysInNewMonth);
    }
    
    if (yearRef.current) {
      const index = years.indexOf(value);
      yearRef.current.scrollTo({
        top: index * ITEM_HEIGHT,
        behavior: 'smooth',
      });
    }
  }, [month, day, years]);

  return (
    <div className="w-full">
      <div className="relative">
        {/* Calendar Icon */}
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-20">
          <Calendar className="text-gray-400" size={20} />
        </div>
        
        {/* Main Container */}
        <div
          className={`w-full pl-12 pr-4 py-4 bg-black/30 backdrop-blur-sm border rounded-2xl transition-all duration-300 ${
            error 
              ? 'border-red-500/50' 
              : 'border-white/20 hover:border-white/30 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20'
          }`}
        >
          <div className="flex gap-6 items-center justify-center">
            {/* Month Column */}
            <ScrollColumn
              ref={monthRef}
              items={months}
              selected={month}
              label="Month"
              type="month"
              formatValue={(value) => monthNames[value - 1]}
              onScroll={createScrollHandler('month', monthRef, months)}
              onClick={handleMonthClick}
            />
            
            {/* Day Column */}
            <ScrollColumn
              ref={dayRef}
              items={days}
              selected={day}
              label="Day"
              type="day"
              formatValue={(value) => value.toString().padStart(2, '0')}
              onScroll={createScrollHandler('day', dayRef, days)}
              onClick={handleDayClick}
            />
            
            {/* Year Column */}
            <ScrollColumn
              ref={yearRef}
              items={years}
              selected={year}
              label="Year"
              type="year"
              onScroll={createScrollHandler('year', yearRef, years)}
              onClick={handleYearClick}
            />
          </div>
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <p className="text-red-400 text-sm mt-2 ml-1 font-medium">{error}</p>
      )}
      
      {/* Hide scrollbar globally */}
      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};