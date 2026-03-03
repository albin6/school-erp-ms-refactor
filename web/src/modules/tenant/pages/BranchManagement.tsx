import { useState, useEffect, useCallback } from 'react';
import { Card, Button, message, Typography } from 'antd';
import { PlusOutlined, BankOutlined } from '@ant-design/icons';
import { branchService } from '@/services/branchService';
import type { Branch, BranchQueryParams } from '@/services/branchService';
import { BranchTable } from '../components/branches/BranchTable';
import { BranchFilters } from '../components/branches/BranchFilters';
import { CreateBranchModal } from '../components/branches/CreateBranchModal';
import { EditBranchModal } from '../components/branches/EditBranchModal';

const { Title } = Typography;

export const BranchManagement = () => {
    const [data, setData] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0
    });
    const [filters, setFilters] = useState<Partial<BranchQueryParams>>({});
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

    const fetchData = useCallback(async (params: BranchQueryParams = {}) => {
        setLoading(true);
        try {
            const result = await branchService.getBranches({
                page: params.page || pagination.current,
                limit: params.limit || pagination.pageSize,
                ...filters,
                ...params
            });
            setData(result.branches);
            setPagination({
                current: result.pagination.page,
                pageSize: result.pagination.limit,
                total: result.pagination.total
            });
        } catch (error) {
            message.error('Failed to load branches');
        } finally {
            setLoading(false);
        }
    }, [pagination.current, pagination.pageSize, filters]);

    useEffect(() => {
        fetchData();
    }, [filters]);

    const handleTableChange = (newPagination: any, _filters: any, sorter: any) => {
        const sortBy = sorter.field as string;
        const sortOrder = sorter.order === 'ascend' ? 'ASC' : 'DESC';

        fetchData({
            page: newPagination.current,
            limit: newPagination.pageSize,
            sortBy,
            sortOrder: sorter.order ? sortOrder : undefined
        });
    };

    const handleDelete = async (id: string) => {
        try {
            await branchService.deleteBranch(id);
            message.success('Branch deleted');
            fetchData();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Delete failed');
        }
    };

    const handleToggleStatus = async (id: string) => {
        try {
            await branchService.toggleBlock(id);
            message.success('Status updated');
            fetchData();
        } catch (error) {
            message.error('Failed to update status');
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <div className="flex items-center gap-2">
                        <BankOutlined className="text-2xl text-indigo-600" />
                        <Title level={2} style={{ margin: 0 }}>School Branches</Title>
                    </div>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsCreateModalOpen(true)}
                    size="large"
                >
                    Add Branch
                </Button>
            </div>

            <Card variant="borderless" className="shadow-xs">
                <BranchFilters onFilterChange={setFilters} />
                <BranchTable
                    data={data}
                    loading={loading}
                    pagination={pagination}
                    onChange={handleTableChange}
                    onEdit={(branch) => setEditingBranch(branch)}
                    onDelete={handleDelete}
                    onToggleStatus={handleToggleStatus}
                />
            </Card>

            <CreateBranchModal
                open={isCreateModalOpen}
                onCancel={() => setIsCreateModalOpen(false)}
                onSuccess={() => {
                    setIsCreateModalOpen(false);
                    fetchData({ page: 1 });
                }}
            />

            <EditBranchModal
                open={!!editingBranch}
                branch={editingBranch}
                onCancel={() => setEditingBranch(null)}
                onSuccess={() => {
                    setEditingBranch(null);
                    fetchData();
                }}
            />
        </div>
    );
};
