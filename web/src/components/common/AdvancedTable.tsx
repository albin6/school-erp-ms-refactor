import { Table, Input, Select, Button } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { TableProps, TablePaginationConfig } from 'antd';
import { useState } from 'react';

interface AdvancedTableProps<T> extends Omit<TableProps<T>, 'pagination'> {
    onSearch?: (value: string) => void;
    onFilter?: (filters: Record<string, any>) => void;
    onRefresh?: () => void;
    searchPlaceholder?: string;
    filterOptions?: Array<{
        key: string;
        label: string;
        options: Array<{ label: string; value: string }>;
    }>;
    pagination?: {
        current: number;
        pageSize: number;
        total: number;
        onChange: (page: number, pageSize: number) => void;
    };
    showSearch?: boolean;
    showFilter?: boolean;
    showRefresh?: boolean;
}

export function AdvancedTable<T extends Record<string, any>>({
    onSearch,
    onFilter,
    onRefresh,
    searchPlaceholder = 'Search...',
    filterOptions = [],
    pagination,
    showSearch = true,
    showFilter = true,
    showRefresh = true,
    ...tableProps
}: AdvancedTableProps<T>) {
    const [searchValue, setSearchValue] = useState('');
    const [filters, setFilters] = useState<Record<string, any>>({});

    const handleSearch = (value: string) => {
        setSearchValue(value);
        onSearch?.(value);
    };

    const handleFilterChange = (key: string, value: any) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        onFilter?.(newFilters);
    };

    const paginationConfig: TablePaginationConfig | false = pagination
        ? {
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: pagination.onChange,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} items`,
            pageSizeOptions: ['10', '20', '50', '100'],
        }
        : false;

    return (
        <div className="space-y-4">
            { }
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
                    {showSearch && (
                        <Input
                            placeholder={searchPlaceholder}
                            prefix={<SearchOutlined className="text-gray-400" />}
                            value={searchValue}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full sm:w-64"
                            allowClear
                        />
                    )}
                    {showFilter && filterOptions.map((filter) => (
                        <Select
                            key={filter.key}
                            placeholder={filter.label}
                            value={filters[filter.key]}
                            onChange={(value) => handleFilterChange(filter.key, value)}
                            className="w-full sm:w-40"
                            allowClear
                        >
                            {filter.options.map((option) => (
                                <Select.Option key={option.value} value={option.value}>
                                    {option.label}
                                </Select.Option>
                            ))}
                        </Select>
                    ))}
                </div>
                {showRefresh && (
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={onRefresh}
                    >
                        Refresh
                    </Button>
                )}
            </div>

            { }
            <Table
                {...tableProps}
                pagination={paginationConfig}
                className="bg-white rounded-lg shadow"
            />
        </div>
    );
}
