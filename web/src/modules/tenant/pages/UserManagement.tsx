import { useState, useEffect, useCallback } from 'react';
import { Card, Button, message, Typography, Spin, Breadcrumb } from 'antd';
import { PlusOutlined, HomeOutlined } from '@ant-design/icons';
import { useParams, Link } from 'react-router-dom';
import { tenantUserService } from '@/services/tenantUserService';
import { branchService } from '@/services/branchService';
import type { Branch } from '@/services/branchService';
import type { TenantUser, UserQueryParams } from '@/services/tenantUserService';
import { UserTable } from '../components/users/UserTable';
import { UserFilters } from '../components/users/UserFilters';
import { CreateUserModal } from '../components/users/CreateUserModal';
import { EditUserModal } from '../components/users/EditUserModal';

const { Title } = Typography;

export const UserManagement = () => {
    const { branchId } = useParams();
    const [data, setData] = useState<TenantUser[]>([]);
    const [branch, setBranch] = useState<Branch | null>(null);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0
    });
    const [filters, setFilters] = useState<Partial<UserQueryParams>>({});
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<TenantUser | null>(null);

    const getErrorMessage = (error: any, fallback: string) =>
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        fallback;

    useEffect(() => {
        if (branchId) {
            branchService.getBranch(branchId)
                .then(setBranch)
                .catch((error) => message.error(getErrorMessage(error, 'Failed to load branch details')));
        }
    }, [branchId]);

    const fetchData = useCallback(async (params: UserQueryParams = {}) => {
        if (!branchId) return;

        setLoading(true);
        try {
            const result = await tenantUserService.getUsers({
                page: params.page || pagination.current,
                limit: params.limit || pagination.pageSize,
                branch_id: branchId,
                ...filters,
                ...params
            });
            setData(result.data.users);
            setPagination({
                current: result.data.pagination.page,
                pageSize: result.data.pagination.limit,
                total: result.data.pagination.total
            });
        } catch (error) {
            message.error(getErrorMessage(error, 'Failed to load users'));
        } finally {
            setLoading(false);
        }
    }, [pagination.current, pagination.pageSize, filters, branchId]);

    useEffect(() => {
        fetchData();
    }, [filters, branchId]);

    const handleTableChange = (newPagination: any, _filters: any, sorter: any) => {
        const sortBy = sorter.field === 'name' ? 'name' : sorter.field;
        const sortOrder = sorter.order === 'ascend' ? 'ASC' : 'DESC';

        fetchData({
            page: newPagination.current,
            limit: newPagination.pageSize,
            sortBy: sorter.field ? sortBy : undefined,
            sortOrder: sorter.order ? sortOrder : undefined
        });
    };

    const handleDelete = async (userId: string) => {
        try {
            await tenantUserService.deleteUser(userId);
            message.success('User deleted');
            fetchData();
        } catch (error: any) {
            message.error(getErrorMessage(error, 'Delete failed'));
        }
    };

    if (!branch && branchId) return <div className="p-12 text-center"><Spin /></div>;

    return (
        <div className="p-6">
            <Breadcrumb className="mb-4" items={[
                { title: <Link to="/admin/branches"><HomeOutlined /> Branches</Link> },
                { title: <Link to="/admin/users">Select Branch</Link> },
                { title: branch?.name || 'User Management' },
            ]} />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <Title level={2} style={{ margin: 0 }}>
                        {branch?.name} Users
                    </Title>
                    <Typography.Text type="secondary">Manage staff and students for this branch</Typography.Text>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsCreateModalOpen(true)}
                    size="large"
                >
                    Add User
                </Button>
            </div>

            <Card variant="borderless" className="shadow-xs">
                <UserFilters onFilterChange={setFilters} />
                <UserTable
                    data={data}
                    loading={loading}
                    pagination={pagination}
                    onChange={handleTableChange}
                    onEdit={(user) => setEditingUser(user)}
                    onDelete={handleDelete}
                />
            </Card>

            <CreateUserModal
                open={isCreateModalOpen}
                onCancel={() => setIsCreateModalOpen(false)}
                selectedBranchId={branchId}
                onSuccess={() => {
                    setIsCreateModalOpen(false);
                    fetchData({ page: 1 });
                }}
            />

            <EditUserModal
                open={!!editingUser}
                user={editingUser}
                onCancel={() => setEditingUser(null)}
                onSuccess={() => {
                    setEditingUser(null);
                    fetchData();
                }}
            />
        </div>
    );
};
