import { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Typography, Spin } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTenantAuthStore } from '@/store/tenantAuthStore';
import { getTenantSubdomain } from '@/utils/subdomain';
import { branchService } from '@/services/branchService';

const { Title, Text } = Typography;

export const TenantStudentLogin = () => {
    const { slug } = useParams<{ slug: string }>();
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(false);
    const [branchName, setBranchName] = useState<string>('');
    const navigate = useNavigate();
    const { loginStudent } = useTenantAuthStore();
    const subdomain = getTenantSubdomain();

    useEffect(() => {
        if (slug) {
            validateSlug(slug);
        }
    }, [slug]);

    const validateSlug = async (branchSlug: string) => {
        setPageLoading(true);
        try {
            const branch = await branchService.getPublicBranchBySlug(subdomain || '', branchSlug);
            setBranchName(branch.name);
        } catch (error) {
            message.error('Invalid branch URL');
            navigate('/404');
        } finally {
            setPageLoading(false);
        }
    };

    const onFinish = async (values: { email: string; password: string }) => {
        if (!subdomain) {
            message.error('Invalid tenant');
            return;
        }

        setLoading(true);
        try {
            const tenantId = subdomain;
            
            await loginStudent(values.email, values.password, tenantId);
            message.success('Login successful!');
            navigate(`/${slug}`);
        } catch (error: any) {
            message.error(error.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    if (pageLoading) return <div className="min-h-screen flex items-center justify-center"><Spin size="large" /></div>;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-100 to-emerald-100">
            <Card className="w-full max-w-md shadow-2xl">
                <div className="text-center mb-8">
                    <Title level={2} className="mb-2">Student Portal</Title>
                    <Text type="secondary" className="text-lg capitalize">
                        {branchName ? `${branchName} (${subdomain})` : `${subdomain} School`}
                    </Text>
                </div>

                <Form
                    name="student-login"
                    onFinish={onFinish}
                    layout="vertical"
                    size="large"
                >
                    <Form.Item
                        name="email"
                        rules={[
                            { required: true, message: 'Please input your email!' },
                            { type: 'email', message: 'Please enter a valid email!' }
                        ]}
                    >
                        <Input
                            prefix={<UserOutlined />}
                            placeholder="Email"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please input your password!' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Password"
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            block
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Sign In
                        </Button>
                    </Form.Item>

                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                        <Button
                            type="link"
                            onClick={() => navigate('/forgot-password')}
                            style={{ padding: 0 }}
                        >
                            Forgot Password?
                        </Button>
                    </div>
                </Form>

                <div className="text-center mt-4">
                    <Text type="secondary">
                        <Link to="/admin" className="text-green-600 hover:text-green-700 mx-2">Admin Login</Link>
                        |
                        <Link to={`/${slug}/staff`} className="text-green-600 hover:text-green-700 mx-2">Staff Login</Link>
                    </Text>
                </div>
            </Card>
        </div>
    );
};
