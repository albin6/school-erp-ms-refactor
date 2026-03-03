import { useState, useEffect } from 'react';
import { Card, Input, Select, Pagination, Spin, Tag, Empty } from 'antd';
import { SearchOutlined, EnvironmentOutlined, PhoneOutlined, MailOutlined } from '@ant-design/icons';
import { tenantService } from '../services/tenant.service';

interface BranchListProps {
    tenantId: string;
    onSelectBranch: (branch: any) => void;
}

export const BranchList = ({ tenantId, onSelectBranch }: BranchListProps) => {
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 9,
        total: 0,
    });

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const response = await tenantService.getTenantBranches(tenantId, {
                page: pagination.current,
                limit: pagination.pageSize,
                search: searchText,
                status: statusFilter,
            });
            setBranches(response.data.branches);
            setPagination((prev) => ({
                ...prev,
                total: response.data.pagination.total,
            }));
        } catch (error) {
            console.error('Failed to fetch branches', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, [tenantId, pagination.current, searchText, statusFilter]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                <div className="flex gap-4 flex-1">
                    <Input
                        placeholder="Search branches..."
                        prefix={<SearchOutlined className="text-gray-400" />}
                        className="max-w-md"
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                    />
                    <Select
                        placeholder="Status"
                        allowClear
                        className="w-32"
                        onChange={setStatusFilter}
                        options={[
                            { value: 'ACTIVE', label: 'Active' },
                            { value: 'BLOCKED', label: 'Blocked' },
                        ]}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <Spin size="large" />
                </div>
            ) : branches.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {branches.map((branch) => (
                            <Card
                                key={branch.id}
                                hoverable
                                className="cursor-pointer transition-all duration-200 hover:shadow-md border-gray-200"
                                onClick={() => onSelectBranch(branch)}
                                title={
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold">{branch.name}</span>
                                        <Tag color={branch.status === 'ACTIVE' ? 'green' : 'red'}>
                                            {branch.status}
                                        </Tag>
                                    </div>
                                }
                            >
                                <div className="space-y-2 text-gray-600">
                                    <div className="flex items-start gap-2">
                                        <EnvironmentOutlined className="mt-1 flex-shrink-0" />
                                        <span className="line-clamp-2 text-sm">
                                            {branch.address || 'No address provided'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <PhoneOutlined />
                                        <span className="text-sm">
                                            {branch.phone || 'No phone'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MailOutlined />
                                        <span className="text-sm">
                                            {branch.email || 'No email'}
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                    <div className="flex justify-end pt-4">
                        <Pagination
                            current={pagination.current}
                            pageSize={pagination.pageSize}
                            total={pagination.total}
                            onChange={(page) => setPagination(prev => ({ ...prev, current: page }))}
                            showTotal={(total) => `Total ${total} branches`}
                        />
                    </div>
                </>
            ) : (
                <div className="bg-white p-12 rounded-lg shadow-sm text-center">
                    <Empty description="No branches found" />
                </div>
            )}
        </div>
    );
};
