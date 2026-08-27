import React from 'react';
import clsx from 'clsx';
import { EmptyState } from './EmptyState';

export const DataTable = ({
  columns = [],
  data = [],
  keyExtractor = (item, index) => item.id || index,
  emptyMessage = 'No records found',
  emptySubtext = 'Try adjusting your search or filters.',
  onRowClick,
  className = '',
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
        <EmptyState title={emptyMessage} description={emptySubtext} />
      </div>
    );
  }

  return (
    <div className={clsx('bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full erp-table text-left border-collapse">
          <thead>
            <tr>
              {columns.map((col, index) => (
                <th
                  key={col.key || index}
                  className={clsx(
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={keyExtractor(row, rowIndex)}
                onClick={() => onRowClick && onRowClick(row)}
                className={clsx(
                  onRowClick && 'cursor-pointer hover:bg-slate-50/80 transition-colors'
                )}
              >
                {columns.map((col, colIndex) => {
                  const cellValue = col.accessor ? row[col.accessor] : undefined;
                  return (
                    <td
                      key={col.key || colIndex}
                      className={clsx(
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.className
                      )}
                    >
                      {col.render ? col.render(row, cellValue, rowIndex) : cellValue ?? '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
