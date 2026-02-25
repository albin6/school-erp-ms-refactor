import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface FullPageLoaderProps {
    tip?: string;
    transparent?: boolean;
}

export const FullPageLoader: React.FC<FullPageLoaderProps> = ({
    tip = "Loading...",
    transparent = false
}) => {
    const antIcon = <LoadingOutlined style={{ fontSize: 32 }} spin />;

    return (
        <div
            className={`flex flex-col items-center justify-center min-h-screen w-full 
                ${transparent ? 'bg-white/50 absolute top-0 left-0 z-50' : 'bg-gray-50'}`}
            style={transparent ? { position: 'absolute', inset: 0 } : {}}
        >
            <Spin indicator={antIcon} size="large" tip={tip}>
                <div style={{ padding: '50px' }} />
            </Spin>
        </div>
    );
};
