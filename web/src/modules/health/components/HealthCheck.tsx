import { useEffect, useState } from 'react';
import { Card, Tag, Typography, Spin, Alert } from 'antd';
import { checkHealth } from '@/modules/health/services/health.service';
import type { HealthStatus } from '@/modules/health/services/health.service';

const { Text } = Typography;

export const HealthCheck = () => {
    const [status, setStatus] = useState<HealthStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        checkHealth()
            .then(setStatus)
            .catch((err: any) => setError(err.message || 'Failed to fetch health status'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <Spin tip="Checking System Health..." />;
    if (error) return <Alert type="error" message="System Error" description={error} />;

    return (
        <Card title="System Health" style={{ maxWidth: 400, margin: '20px auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                    <Text strong>Server: </Text>
                    <Tag color={status?.server === 'running' ? 'green' : 'red'}>{status?.server}</Tag>
                </div>
                <div>
                    <Text strong>Database: </Text>
                    <Tag color={status?.database === 'connected' ? 'green' : 'red'}>{status?.database}</Tag>
                </div>
                <div>
                    <Text strong>Redis: </Text>
                    <Tag color={status?.redis === 'connected' ? 'green' : 'red'}>{status?.redis}</Tag>
                </div>
                <div style={{ marginTop: '10px' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Last Checked: {status?.timestamp}</Text>
                </div>
            </div>
        </Card>
    );
};
