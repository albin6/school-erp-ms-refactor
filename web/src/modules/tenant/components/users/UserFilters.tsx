import React, { useEffect, useState } from 'react';
import { Form, Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { UserQueryParams } from '@/services/tenantUserService';
import { branchService } from '@/services/branchService';
import type { Branch } from '@/services/branchService';

interface UserFiltersProps {
    onFilterChange: (values: Partial<UserQueryParams>) => void;
}

export const UserFilters: React.FC<UserFiltersProps> = ({ onFilterChange }) => {
    const [form] = Form.useForm();
    const [branches, setBranches] = useState<Branch[]>([]);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const result = await branchService.getBranches({ limit: 100 });

                const branchesData = result.data.branches || result.data || [];
                setBranches(Array.isArray(branchesData) ? branchesData : []);
            } catch (err) {
                console.error('Failed to load branches for filter');
            }
        };
        fetchBranches();
    }, []);

    const handleValuesChange = (_: any, allValues: any) => {
        onFilterChange(allValues);
    };

    return (
        <Form
            form={form}
            layout="inline"
            onValuesChange={handleValuesChange}
            className="mb-4 gap-y-2"
        >
            <Form.Item name="search" className="mb-2 md:mb-0">
                <Input
                    placeholder="Search name or email..."
                    prefix={<SearchOutlined className="text-gray-400" />}
                    allowClear
                    style={{ width: 200 }}
                />
            </Form.Item>

            <Form.Item name="role" className="mb-2 md:mb-0">
                <Select placeholder="Role" allowClear style={{ width: 120 }}>
                    <Select.Option value="STUDENT">Student</Select.Option>
                    <Select.Option value="STAFF">Staff</Select.Option>
                </Select>
            </Form.Item>

            <Form.Item name="sub_role" className="mb-2 md:mb-0">
                <Select placeholder="Position" allowClear style={{ width: 140 }}>
                    <Select.Option value="TEACHER">Teacher</Select.Option>
                    <Select.Option value="PRINCIPAL">Principal</Select.Option>
                    <Select.Option value="OFFICE_STAFF">Office Staff</Select.Option>
                </Select>
            </Form.Item>

            <Form.Item name="branch_id" className="mb-2 md:mb-0">
                <Select placeholder="Branch" allowClear style={{ width: 150 }}>
                    {branches.map(b => (
                        <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
                    ))}
                </Select>
            </Form.Item>

            <Form.Item name="status" className="mb-2 md:mb-0">
                <Select placeholder="Status" allowClear style={{ width: 100 }}>
                    <Select.Option value="ACTIVE">Active</Select.Option>
                    <Select.Option value="BLOCKED">Blocked</Select.Option>
                </Select>
            </Form.Item>
        </Form>
    );
};
