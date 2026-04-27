import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, Select, Typography, message } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { tenantUserService } from '@/services/tenantUserService';
import type { TenantUser, UserQueryParams } from '@/services/tenantUserService';
import { branchService } from '@/services/branchService';
import type { Branch } from '@/services/branchService';
import { UserTable } from '../components/users/UserTable';
import { CreateUserModal } from '../components/users/CreateUserModal';
import { EditUserModal } from '../components/users/EditUserModal';

const { Title } = Typography;

export const StudentsManagement = () => {
    const [form] = Form.useForm();
    const [students, setStudents] = useState<TenantUser[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [filters, setFilters] = useState<Partial<UserQueryParams>>({});
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<TenantUser | null>(null);

    const getErrorMessage = (error: any, fallback: string) =>
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        fallback;

    useEffect(() => {
        branchService.getBranches({ limit: 100, status: 'ACTIVE' })
            .then((result) => setBranches(result.branches))
            .catch(() => message.error('Failed to load branches'));
    }, []);

    const fetchStudents = useCallback(async (params: UserQueryParams = {}) => {
        setLoading(true);
        try {
            const result = await tenantUserService.getUsers({
                page: params.page || pagination.current,
                limit: params.limit || pagination.pageSize,
                ...filters,
                ...params,
                role: 'STUDENT',
            });

            setStudents(result.data.users);
            setPagination({
                current: result.data.pagination.page,
                pageSize: result.data.pagination.limit,
                total: result.data.pagination.total,
            });
        } catch (error) {
            message.error(getErrorMessage(error, 'Failed to load students'));
        } finally {
            setLoading(false);
        }
    }, [filters, pagination.current, pagination.pageSize]);

    useEffect(() => {
        fetchStudents({ page: 1 });
    }, [filters]);

    const handleTableChange = (newPagination: any, _filters: any, sorter: any) => {
        const sortBy = sorter.field === 'name' ? 'name' : sorter.field;
        const sortOrder = sorter.order === 'ascend' ? 'ASC' : 'DESC';

        fetchStudents({
            page: newPagination.current,
            limit: newPagination.pageSize,
            sortBy: sorter.field ? sortBy : undefined,
            sortOrder: sorter.order ? sortOrder : undefined,
        });
    };

    const handleDelete = async (userId: string) => {
        try {
            await tenantUserService.deleteUser(userId);
            message.success('Student removed');
            fetchStudents();
        } catch (error) {
            message.error(getErrorMessage(error, 'Delete failed'));
        }
    };

    const handleFilterChange = (_: any, values: Partial<UserQueryParams>) => {
        setFilters(values);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Title level={2} style={{ margin: 0 }}>Students</Title>
                    <Typography.Text type="secondary">Manage student memberships across active branches</Typography.Text>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsCreateModalOpen(true)}
                    size="large"
                >
                    Add Student
                </Button>
            </div>

            <Card variant="borderless" className="shadow-xs">
                <Form
                    form={form}
                    layout="inline"
                    onValuesChange={handleFilterChange}
                    className="mb-4 gap-y-2"
                >
                    <Form.Item name="search" className="mb-2 md:mb-0">
                        <Input
                            placeholder="Search name or email..."
                            prefix={<SearchOutlined className="text-gray-400" />}
                            allowClear
                            style={{ width: 220 }}
                        />
                    </Form.Item>

                    <Form.Item name="branch_id" className="mb-2 md:mb-0">
                        <Select placeholder="Branch" allowClear style={{ width: 180 }}>
                            {branches.map((branch) => (
                                <Select.Option key={branch.id} value={branch.id}>{branch.name}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="status" className="mb-2 md:mb-0">
                        <Select placeholder="Status" allowClear style={{ width: 120 }}>
                            <Select.Option value="ACTIVE">Active</Select.Option>
                            <Select.Option value="BLOCKED">Blocked</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>

                <UserTable
                    data={students}
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
                defaultRole="STUDENT"
                lockedRole="STUDENT"
                onSuccess={() => {
                    setIsCreateModalOpen(false);
                    fetchStudents({ page: 1 });
                }}
            />

            <EditUserModal
                open={!!editingUser}
                user={editingUser}
                onCancel={() => setEditingUser(null)}
                onSuccess={() => {
                    setEditingUser(null);
                    fetchStudents();
                }}
            />
        </div>
    );
};
