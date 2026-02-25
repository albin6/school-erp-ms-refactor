import { useState, useEffect } from 'react';
import { Card, Typography, List, Button, Spin, Empty, Input, Tag } from 'antd';
import { BankOutlined, ArrowRightOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { branchService } from '@/services/branchService';
import type { Branch } from '@/services/branchService';

const { Title, Text } = Typography;

export const BranchSelection = () => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        try {
            setLoading(true);
            const result = await branchService.getBranches({ limit: 100, status: 'ACTIVE' });
            setBranches(result.branches);
        } catch (error) {
            console.error('Failed to load branches');
        } finally {
            setLoading(false);
        }
    };

    const filteredBranches = branches.filter(branch =>
        branch.name.toLowerCase().includes(searchText.toLowerCase()) ||
        branch.address?.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <div className="p-6">
            <div className="mb-8 text-left">
                <Title level={2}>Manage Users</Title>
                <Text type="secondary">Select a branch to manage its staff and students</Text>
            </div>

            <Card variant="borderless" className="shadow-xs" title={
                <Input
                    prefix={<SearchOutlined />}
                    placeholder="Search branches..."
                    onChange={e => setSearchText(e.target.value)}
                    className="max-w-md"
                />
            }>
                {loading ? (
                    <div className="text-center p-8"><Spin size="large" /></div>
                ) : filteredBranches.length === 0 ? (
                    <Empty description="No branches found" />
                ) : (
                    <List
                        grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 6 }}
                        dataSource={filteredBranches}
                        renderItem={branch => (
                            <List.Item>
                                <Card
                                    hoverable
                                    className="h-full border-l-4 border-l-indigo-500"
                                    onClick={() => navigate(`/admin/users/${branch.id}`)}
                                >
                                    <div className="flex flex-col h-full justify-between">
                                        <div className="mb-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <BankOutlined className="text-indigo-600 text-lg" />
                                                <Text strong className="text-lg truncate" title={branch.name}>{branch.name}</Text>
                                            </div>
                                            <div className="mb-2">
                                                <Tag color="geekblue">/{branch.slug}</Tag>
                                            </div>
                                            <Text type="secondary" className="block h-10 overflow-hidden text-ellipsis line-clamp-2">
                                                {branch.address || 'No address provided'}
                                            </Text>
                                        </div>
                                        <div className="mt-auto">
                                            <Button type="primary" ghost block icon={<ArrowRightOutlined />}>
                                                Manage Users
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </List.Item>
                        )}
                    />
                )}
            </Card>
        </div>
    );
};
