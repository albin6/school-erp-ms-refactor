import React from 'react';
import { Table, Tag, Button, Space, Popconfirm, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { Branch } from '@/services/branchService';

interface BranchTableProps {
    data: Branch[];
    loading: boolean;
    pagination: {
        current: number;
        pageSize: number;
        total: number;
    };
    onChange: (pagination: any, filters: any, sorter: any) => void;
    onEdit: (branch: Branch) => void;
    onDelete: (branchId: string) => void;
    onToggleStatus: (branchId: string) => void;
}

export const BranchTable: React.FC<BranchTableProps> = ({
    data,
    loading,
    pagination,
    onChange,
    onEdit,
    onDelete,
    onToggleStatus
}) => {
    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            sorter: true,
            width: '20%',
        },
        {
            title: 'Slug',
            dataIndex: 'slug',
            render: (slug: string) => <Tag color="geekblue">{slug}</Tag>,
            width: '15%',
        },
        {
            title: 'Address',
            dataIndex: 'address',
            ellipsis: true,
        },
        {
            title: 'Phone',
            dataIndex: 'phone',
            width: '15%',
            responsive: ['md'] as any[], 
        },
        {
            title: 'Status',
            dataIndex: 'status',
            width: '100px',
            render: (status: string) => (
                <Tag color={status === 'ACTIVE' ? 'success' : 'error'}>
                    {status}
                </Tag>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            width: '150px',
            render: (_: any, record: Branch) => (
                <Space>
                    <Tooltip title="Edit">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => onEdit(record)}
                        />
                    </Tooltip>
                    <Tooltip title={record.status === 'ACTIVE' ? "Block" : "Unblock"}>
                        <Popconfirm
                            title={`Are you sure you want to ${record.status === 'ACTIVE' ? 'block' : 'unblock'} this branch?`}
                            onConfirm={() => onToggleStatus(record.id)}
                        >
                            <Button
                                type="text"
                                icon={record.status === 'ACTIVE' ? <StopOutlined className="text-orange-500" /> : <CheckCircleOutlined className="text-green-500" />}
                            />
                        </Popconfirm>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Popconfirm
                            title="Are you sure delete this branch?"
                            description="This action cannot be undone."
                            onConfirm={() => onDelete(record.id)}
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
