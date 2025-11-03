/**
 * ResponsiveTable Component
 * 
 * Desktop: Traditional table
 * Mobile: Stacked cards
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Card } from './DesignSystem';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  mobileLabel?: string; // Custom label voor mobile view
  hideOnMobile?: boolean;
  className?: string;
}

export interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  mobileCardRender?: (item: T) => React.ReactNode; // Custom mobile card render
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = 'Geen data beschikbaar',
  isLoading = false,
  mobileCardRender,
}: ResponsiveTableProps<T>) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="text-center py-12">
        <p className="text-gray-500">{emptyMessage}</p>
      </Card>
    );
  }

  const visibleColumns = columns.filter(col => !col.hideOnMobile);

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-left text-sm font-semibold text-gray-700',
                    column.className
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <motion.tr
                key={keyExtractor(item)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-4 py-4 text-sm', column.className)}>
                    {column.render
                      ? column.render(item)
                      : String((item as any)[column.key] || '-')}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {data.map((item, index) => (
          <motion.div
            key={keyExtractor(item)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            {mobileCardRender ? (
              mobileCardRender(item)
            ) : (
              <Card
                hover={!!onRowClick}
                onClick={() => onRowClick?.(item)}
                className="p-4"
              >
                <div className="space-y-3">
                  {visibleColumns.map((column) => (
                    <div key={column.key} className="flex justify-between items-start">
                      <span className="text-sm font-medium text-gray-500 min-w-[100px]">
                        {column.mobileLabel || column.label}
                      </span>
                      <span className="text-sm text-gray-900 text-right flex-1">
                        {column.render
                          ? column.render(item)
                          : String((item as any)[column.key] || '-')}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        ))}
      </div>
    </>
  );
}

