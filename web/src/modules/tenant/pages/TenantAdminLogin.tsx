import { useState } from 'react';
import { Form, Input, Button, Card, App, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useTenantAuthStore } from '@/store/tenantAuthStore';
import { getTenantSubdomain } from '@/utils/subdomain';

const { Title, Text } = Typography;

export const TenantAdminLogin = () => {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { loginAdmin } = useTenantAuthStore();
    const subdomain = getTenantSubdomain();

    const onFinish = async (values: { email: string; password: string }) => {
        if (!subdomain) {
            message.error('Invalid tenant');
            return;
        }

        setLoading(true);
        try {
            const tenantId = subdomain;
            await loginAdmin(values.email, values.password, tenantId);

            const { user } = useTenantAuthStore.getState();
            if (user && user.mustResetPassword) {
                message.info('Please reset your password to continue');
                navigate('/admin/reset-password');
            } else {
                message.success('Login successful!');
                navigate('/admin/dashboard');
            }
        } catch (error: any) {
            message.error(error.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
            <Card className="w-full max-w-md shadow-2xl">
                <div className="text-center mb-8">
                    <Title level={2} className="mb-2">Admin Portal</Title>
                    <Text type="secondary" className="text-lg capitalize">{subdomain} School</Text>
                </div>

                <Form
                    name="admin-login"
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
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            Sign In as Admin
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
                        <Link to="/" className="text-indigo-600 hover:text-indigo-700">Back to School Home</Link>
                    </Text>
                </div>
            </Card>
        </div>
    );
};
