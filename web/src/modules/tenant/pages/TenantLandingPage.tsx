import { useState, useEffect } from 'react';
import { Card, Typography, Spin, Empty, Input, Button, List, Tag } from 'antd';
import { BankOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTenantSubdomain } from '@/utils/subdomain';
import { branchService, type Branch } from '@/services/branchService';

const { Title, Text } = Typography;

export const TenantLandingPage = () => {
    const subdomain = getTenantSubdomain();
    const navigate = useNavigate();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    const fetchBranches = async (search?: string) => {
        if (!subdomain) return;
        setLoading(true);
        try {
            const data = await branchService.getPublicBranches(subdomain, search);
            setBranches(data);
        } catch (error) {
            console.error('Failed to fetch branches', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        
        fetchBranches();
    }, [subdomain]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchBranches(searchText);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchText]);

    if (!subdomain) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Empty description="No School Selected" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            { }
            <div className="bg-indigo-700 text-white py-16 px-6 text-center">
                <Title level={1} style={{ color: 'white', margin: 0, textTransform: 'capitalize' }}>
                    {subdomain} School
                </Title>
                <Text className="text-indigo-100 text-lg mt-2 block">
                    Welcome to our digital campus portal
                </Text>
            </div>

            { }
            <div className="flex-1 max-w-5xl mx-auto w-full p-6 -mt-8">
                <Card
                    className="shadow-lg border-0"
                    title={<div className="text-center py-4"><Title level={3}>Find Your Branch</Title></div>}
                >
                    <div className="max-w-md mx-auto mb-8">
                        <Input
                            size="large"
                            placeholder="Search by branch name..."
                            prefix={<SearchOutlined />}
                            onChange={e => setSearchText(e.target.value)}
                            value={searchText}
                        />
                    </div>

                    {loading ? (
                        <div className="text-center p-12"><Spin size="large" /></div>
                    ) : branches.length > 0 ? (
                        <List
                            grid={{ gutter: 16, xs: 1, sm: 2, md: 3 }}
                            dataSource={branches}
                            renderItem={branch => (
                                <List.Item>
                                    <Card
                                        hoverable
                                        className="text-center h-full flex flex-col justify-between"
                                        style={{ borderColor: '#e5e7eb' }}
                                    >
                                        <div className="mb-4">
                                            <BankOutlined className="text-4xl text-indigo-600 mb-3" />
                                            <Title level={4} className="mb-1">{branch.name}</Title>
                                            <Tag color="blue">/{branch.slug}</Tag>
                                        </div>
                                        <div className="space-y-2">
                                            <Button
                                                block
                                                type="primary"
                                                onClick={() => navigate(`/${branch.slug}`)}
                                            >
                                                Student Login
                                            </Button>
                                            <Button
                                                block
                                                onClick={() => navigate(`/${branch.slug}/staff`)}
                                            >
                                                Staff Login
                                            </Button>
                                        </div>
                                    </Card>
                                </List.Item>
                            )}
                        />
                    ) : (
                        <div className="text-center py-12">
                            <Empty description="No branches found." />
                            <div className="mt-4">
                                <Text type="secondary">Know your branch slug? Enter URL manually:</Text>
                                <code className="block mt-2 bg-gray-100 p-2 rounded">
                                    {window.location.host}/your-branch-slug
                                </code>
                            </div>
                        </div>
                    )}
                </Card>

                <div className="text-center mt-8">
                    <Button type="link" onClick={() => navigate('/admin')}>
                        School Admin Login
                    </Button>
                </div>
            </div>
        </div>
    );
};
