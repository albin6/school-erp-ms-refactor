import React from 'react';
import { Form, Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { BranchQueryParams } from '@/services/branchService';

interface BranchFiltersProps {
    onFilterChange: (values: Partial<BranchQueryParams>) => void;
}

export const BranchFilters: React.FC<BranchFiltersProps> = ({ onFilterChange }) => {
    const [form] = Form.useForm();

    const handleValuesChange = (_: any, allValues: any) => {
        onFilterChange(allValues);
    };

    return (
        <Form
            form={form}
            layout="inline"
            onValuesChange={handleValuesChange}
            className="mb-4"
        >
            <Form.Item name="search" className="mb-2 md:mb-0">
                <Input
                    placeholder="Search branches..."
                    prefix={<SearchOutlined className="text-gray-400" />}
                    allowClear
                    style={{ width: 220 }}
                />
            </Form.Item>

            <Form.Item name="status" className="mb-2 md:mb-0">
                <Select
                    placeholder="Filter by Status"
                    allowClear
                    style={{ width: 150 }}
                >
                    <Select.Option value="ACTIVE">Active</Select.Option>
                    <Select.Option value="BLOCKED">Blocked</Select.Option>
                </Select>
            </Form.Item>
        </Form>
    );
};
