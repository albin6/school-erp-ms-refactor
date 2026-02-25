import { useState, useEffect } from 'react';
import { Button, Tag, Space, Tooltip, message, Popconfirm, Modal } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { AdvancedTable } from '@/components/common/AdvancedTable';
import { CreateTenantModal } from '../components/CreateTenantModal';
import { EditTenantModal } from '../components/EditTenantModal';
import { tenantService } from '../services/tenant.service';
import type { Tenant } from '../types/tenant.types';
import { useNavigate } from 'react-router-dom';
import { config } from '@/config';

export const TenantManagement = () => {
    const navigate = useNavigate();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0,
    });
    const [filters, setFilters] = useState({
        search: '',
        status: undefined as string | undefined,
    });

    const fetchTenants = async () => {
        setLoading(true);
        try {
            const response = await tenantService.getTenants({
                page: pagination.current,
                limit: pagination.pageSize,
                search: filters.search || undefined,
                status: filters.status as any,
            });

            setTenants(response.data.tenants);
            setPagination((prev) => ({
                ...prev,
                total: response.data.pagination.total,
            }));
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to fetch tenants');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTenants();
    }, [pagination.current, pagination.pageSize, filters]);

    const handleSearch = (value: string) => {
        setFilters((prev) => ({ ...prev, search: value }));
        setPagination((prev) => ({ ...prev, current: 1 }));
    };

    const handleFilter = (newFilters: Record<string, any>) => {
        setFilters((prev) => ({ ...prev, ...newFilters }));
        setPagination((prev) => ({ ...prev, current: 1 }));
    };

    const handlePaginationChange = (page: number, pageSize: number) => {
        setPagination((prev) => ({ ...prev, current: page, pageSize }));
    };

    const handleDelete = async (id: string, name: string) => {
        Modal.confirm({
            title: `Are you sure you want to delete ${name}?`,
            content: 'This action cannot be undone. All data associated with this tenant, including users, will be permanently deleted.',
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await tenantService.deleteTenant(id);
                    message.success('Tenant deleted successfully');
                    fetchTenants();
                } catch (error: any) {
                    message.error(error.response?.data?.message || 'Failed to delete tenant');
                }
            },
        });
    };

    const handleBlock = async (id: string) => {
        try {
            await tenantService.blockTenant(id);
            message.success('Tenant blocked successfully');
            fetchTenants();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to block tenant');
        }
    };

    const handleUnblock = async (id: string) => {
        try {
            await tenantService.unblockTenant(id);
            message.success('Tenant unblocked successfully');
            fetchTenants();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to unblock tenant');
        }
    };

    const columns: ColumnsType<Tenant> = [
        {
            title: 'School Name',
            dataIndex: 'name',
            key: 'name',
            sorter: true,
            render: (name: string) => <span className="font-semibold text-gray-900">{name}</span>,
        },
        {
            title: 'Subdomain',
            dataIndex: 'subdomain',
            key: 'subdomain',
            render: (subdomain: string) => (
                <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                    {subdomain}.{config.ROOT_DOMAIN}
                </code>
            ),
        },
        {
            title: 'Domain',
            dataIndex: 'domain',
            key: 'domain',
            render: (domain: string) => domain || <span className="text-gray-400">-</span>,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                const colors = {
                    ACTIVE: 'green',
                    INACTIVE: 'red',
                    SUSPENDED: 'orange',
                };
                return <Tag color={colors[status as keyof typeof colors]}>{status}</Tag>;
            },
        },
        {
            title: 'Created',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date: string) => new Date(date).toLocaleDateString(),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Tooltip title="View Details">
                        <Button
                            type="text"
                            icon={<EyeOutlined />}
                            onClick={() => navigate(`/tenants/${record.id}`)}
                        />
                    </Tooltip>

                    <Tooltip title="Edit">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => {
                                setSelectedTenant(record);
                                setEditModalOpen(true);
                            }}
                        />
                    </Tooltip>

                    {record.status === 'SUSPENDED' || record.status === 'INACTIVE' ? (
                        <Tooltip title="Unblock">
                            <Popconfirm
                                title="Unblock Tenant"
                                description="Are you sure you want to unblock this tenant?"
                                onConfirm={() => handleUnblock(record.id)}
                                okText="Yes"
                                cancelText="No"
                            >
                                <Button
                                    type="text"
                                    className="text-green-600 hover:text-green-700"
                                    icon={<CheckCircleOutlined />}
                                />
                            </Popconfirm>
                        </Tooltip>
                    ) : (
                        <Tooltip title="Block">
                            <Popconfirm
                                title="Block Tenant"
                                description="Are you sure you want to block this tenant? They will lose access immediately."
                                onConfirm={() => handleBlock(record.id)}
                                okText="Yes"
                                cancelText="No"
                            >
                                <Button
                                    type="text"
                                    className="text-orange-600 hover:text-orange-700"
                                    icon={<StopOutlined />}
                                />
                            </Popconfirm>
                        </Tooltip>
                    )}

                    <Tooltip title="Delete">
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDelete(record.id, record.name)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
                    <p className="text-gray-600 mt-1">Manage all schools and institutions</p>
                </div>
                <Button
                    type="primary"
                    size="large"
                    icon={<PlusOutlined />}
                    onClick={() => setCreateModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700"
                >
                    Create Tenant
                </Button>
            </div>

            <AdvancedTable
                dataSource={tenants}
                columns={columns}
                loading={loading}
                rowKey="id"
                onSearch={handleSearch}
                onFilter={handleFilter}
                onRefresh={fetchTenants}
                searchPlaceholder="Search by name or subdomain..."
                filterOptions={[
                    {
                        key: 'status',
                        label: 'Status',
                        options: [
                            { label: 'Active', value: 'ACTIVE' },
                            { label: 'Inactive', value: 'INACTIVE' },
                            { label: 'Suspended', value: 'SUSPENDED' },
                        ],
                    },
                ]}
                pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    onChange: handlePaginationChange,
                }}
            />

            <CreateTenantModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSuccess={fetchTenants}
            />

            <EditTenantModal
                open={editModalOpen}
                tenant={selectedTenant}
                onClose={() => {
                    setEditModalOpen(false);
                    setSelectedTenant(null);
                }}
                onSuccess={fetchTenants}
            />
        </div>
    );
};
