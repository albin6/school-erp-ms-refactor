import { useState, useEffect } from 'react';
import { AdvancedTable } from '@/components/common/AdvancedTable';
import { tenantService } from '../services/tenant.service';
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface TenantUserListProps {
    tenantId: string;
    branchId?: string;
    branchName?: string;
    onBack?: () => void;
}

export const TenantUserList = ({ tenantId, branchId, branchName, onBack }: TenantUserListProps) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0,
    });
    const [searchText, setSearchText] = useState('');
    const [filters, setFilters] = useState<Record<string, any>>({});

    const fetchData = async (page = pagination.current, size = pagination.pageSize, search = searchText, currentFilters = filters) => {
        setLoading(true);
        try {
            const response = await tenantService.getTenantUsers(tenantId, {
                page,
                limit: size,
                search,
                role: currentFilters.role,
                status: currentFilters.status,
                branch_id: branchId,
            });
            setData(response.data.users);
            setPagination((prev) => ({
                ...prev,
                current: page,
                pageSize: size,
                total: response.data.pagination.total,
            }));
        } catch (error) {
            console.error('Failed to fetch users', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [tenantId, branchId]);

    const handleSearch = (value: string) => {
        setSearchText(value);
        fetchData(1, pagination.pageSize, value, filters);
    };

    const handleFilter = (newFilters: Record<string, any>) => {
        setFilters(newFilters);
        fetchData(1, pagination.pageSize, searchText, newFilters);
    };

    const handleRefresh = () => {
        fetchData();
    };

    const handlePageChange = (page: number, pageSize: number) => {
        fetchData(page, pageSize);
    };

    const columns: ColumnsType<any> = [
        {
            title: 'Name',
            dataIndex: ['user', 'name'],
            key: 'name',
            sorter: true,
        },
        {
            title: 'Email',
            dataIndex: ['user', 'email'],
            key: 'email',
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => <Tag color="blue">{role}</Tag>,
        },
        {
            title: 'Status',
            dataIndex: ['user', 'is_active'],
            key: 'status',
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'green' : 'red'}>
                    {isActive ? 'Active' : 'Inactive'}
                </Tag>
            ),
        },
    ];

    return (
        <div>
            {onBack && (
                <div className="mb-4">
                    <button
                        onClick={onBack}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium"
                    >
                        ← Back to Branches {branchName && `(${branchName})`}
                    </button>
                </div>
            )}

            <AdvancedTable
                columns={columns}
                dataSource={data}
                rowKey="id"
                loading={loading}
                pagination={{
                    ...pagination,
                    onChange: handlePageChange
                }}
                onSearch={handleSearch}
                onFilter={handleFilter}
                onRefresh={handleRefresh}
                showSearch={true}
                searchPlaceholder="Search users..."
                showFilter={true}
                filterOptions={[
                    {
                        key: 'role',
                        label: 'Role',
                        options: [
                            { label: 'Admin', value: 'ADMIN' },
                            { label: 'Staff', value: 'STAFF' },
                            { label: 'Student', value: 'STUDENT' },
                            { label: 'Parent', value: 'PARENT' },
                        ]
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        options: [
                            { label: 'Active', value: 'ACTIVE' },
                            { label: 'Inactive', value: 'INACTIVE' },
                        ]
                    }
                ]}
                title={() => branchName ? `Users in ${branchName}` : 'All Users'}
            />
        </div>
    );
};
