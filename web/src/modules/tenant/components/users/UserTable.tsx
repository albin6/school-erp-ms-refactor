import React from 'react';
import { Table, Tag, Button, Space, Popconfirm, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { TenantUser } from '@/services/tenantUserService';

interface UserTableProps {
    data: TenantUser[];
    loading: boolean;
    pagination: {
        current: number;
        pageSize: number;
        total: number;
    };
    onChange: (pagination: any, filters: any, sorter: any) => void;
    onEdit: (user: TenantUser) => void;
    onDelete: (userId: string) => void;
}

export const UserTable: React.FC<UserTableProps> = ({
    data,
    loading,
    pagination,
    onChange,
    onEdit,
    onDelete
}) => {
    const columns = [
        {
            title: 'Name',
            dataIndex: ['user', 'name'],
            sorter: true,
            key: 'name',
            render: (text: string, record: TenantUser) => (
                <div>
                    <div className="font-medium">{text}</div>
                    <div className="text-xs text-gray-500">{record.user.email}</div>
                </div>
            )
        },
        {
            title: 'Role',
            dataIndex: 'role',
            width: '120px',
            render: (role: string, record: TenantUser) => (
                <Space orientation="vertical" size={0}>
                    <Tag color={role === 'ADMIN' ? 'purple' : role === 'STAFF' ? 'blue' : 'cyan'}>
                        {role}
                    </Tag>
                    {record.sub_role && (
                        <div className="text-xs text-gray-500 mt-1 capitalize">
                            {record.sub_role.replace('_', ' ').toLowerCase()}
                        </div>
                    )}
                </Space>
            )
        },
        {
            title: 'Branch',
            dataIndex: ['branch', 'name'],
            render: (text: string) => text || <span className="text-gray-400 italic">None</span>
        },
        {
            title: 'Status',
            dataIndex: ['user', 'is_active'],
            width: '100px',
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'success' : 'error'}>
                    {isActive ? 'Active' : 'Blocked'}
                </Tag>
            )
        },
        {
            title: 'Last Login',
            dataIndex: ['user', 'last_login_at'],
            render: (date: string) => date ? new Date(date).toLocaleDateString() : '-'
        },
        {
            title: 'Actions',
            key: 'actions',
            width: '100px',
            render: (_: any, record: TenantUser) => (
                <Space>
                    <Tooltip title="Edit">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => onEdit(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Popconfirm
                            title="Delete user?"
                            description="This will verify if they belong to other tenants first."
                            onConfirm={() => onDelete(record.user.id)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            pagination={pagination}
            onChange={onChange}
            scroll={{ x: 800 }}
        />
    );
};
