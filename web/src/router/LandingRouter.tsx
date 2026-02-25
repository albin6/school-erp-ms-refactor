import { useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Button } from 'antd';
import {
    RocketOutlined,
    SafetyOutlined,
    TeamOutlined,
    DashboardOutlined,
    CheckCircleOutlined,
    ArrowRightOutlined,
    GlobalOutlined,
    ThunderboltOutlined
} from '@ant-design/icons';
import { motion, useScroll, useTransform } from 'framer-motion';

export const LandingRouter = () => {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

const LandingPage = () => {
    const targetRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start start", "end start"]
    });

    const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
    const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
    const y = useTransform(scrollYProgress, [0, 0.5], [0, -50]);

    return (
        <div className="min-h-screen bg-white font-sans text-slate-600 selection:bg-indigo-500/30">
            { }
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-100/50 blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-100/50 blur-[120px] animate-pulse delay-1000" />
            </div>

            { }
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        { }
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                <DashboardOutlined className="text-xl" />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-slate-900">
                                SchoolHub
                            </span>
                        </div>

                        { }
                        <div className="hidden md:flex items-center space-x-8">
                            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</a>
                            <a href="#stats" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Impact</a>
                            <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>

                            <div className="flex items-center gap-4 border-l border-slate-200 pl-8">
                                <Button
                                    type="text"
                                    href={import.meta.env.VITE_SUPER_ADMIN_URL}
                                    className="text-slate-600 hover:text-slate-900 font-medium"
                                >
                                    Log in
                                </Button>
                                <Button
                                    type="primary"
                                    href={import.meta.env.VITE_SUPER_ADMIN_URL}
                                    className="bg-indigo-600 hover:bg-indigo-700 h-10 px-6 rounded-lg font-medium shadow-lg shadow-indigo-500/20 border-none transition-all hover:scale-105"
                                >
                                    Get Started
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            { }
            <section ref={targetRef} className="relative pt-32 pb-40 overflow-hidden z-10">
                <motion.div
                    style={{ opacity, scale, y }}
                    className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center"
                >
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-8 border border-indigo-100 uppercase tracking-wide backdrop-blur-sm"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        New Generation Platform
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-8 leading-[1.1]"
                    >
                        The standard for <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">modern education.</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="text-lg md:text-xl text-slate-500 mb-10 leading-relaxed max-w-2xl mx-auto"
                    >
                        Streamline your entire institution with a platform designed for clarity, speed, and reliability. Experience the future of school management today.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                    >
                        <Button
                            type="primary"
                            size="large"
                            href={import.meta.env.VITE_SUPER_ADMIN_URL}
                            className="bg-indigo-600 hover:bg-indigo-700 h-14 px-8 rounded-xl text-base font-semibold shadow-lg shadow-indigo-500/25 transition-all border-none hover:scale-105"
                            icon={<RocketOutlined />}
                        >
                            Start Free Trial
                        </Button>
                        <Button
                            size="large"
                            className="h-14 px-8 rounded-xl text-base font-semibold text-slate-700 border-slate-200 hover:border-indigo-600 hover:text-indigo-600 transition-all bg-white/50 backdrop-blur-sm"
                            icon={<ArrowRightOutlined />}
                        >
                            View Demo
                        </Button>
                    </motion.div>
                </motion.div>
            </section>

            { }
            <section id="stats" className="py-20 border-y border-slate-100 bg-slate-50/50 backdrop-blur-sm z-20 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center"
                    >
                        <StatItem number="500+" label="Partner Schools" />
                        <StatItem number="100k+" label="Daily Users" />
                        <StatItem number="99.9%" label="Uptime SLA" />
                        <StatItem number="24/7" label="Expert Support" />
                    </motion.div>
                </div>
            </section>

            { }
            <section id="features" className="py-32 relative z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="text-center max-w-3xl mx-auto mb-20"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                            Everything you need to run high-performance schools
                        </h2>
                        <p className="text-lg text-slate-500">
                            We've reimagined school management from the ground up to be intuitive, powerful, and scalable.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<DashboardOutlined />}
                            title="Command Center"
                            description="A unified dashboard giving you real-time visibility into every aspect of your institution's performance."
                            delay={0}
                        />
                        <FeatureCard
                            icon={<TeamOutlined />}
                            title="Multi-Tenant Architecture"
                            description="Manage multiple branches or schools from a single master account with complete data isolation."
                            delay={0.1}
                        />
                        <FeatureCard
                            icon={<SafetyOutlined />}
                            title="Enterprise Security"
                            description="Bank-grade encryption, role-based access control, and comprehensive audit logging built-in."
                            delay={0.2}
                        />
                        <FeatureCard
                            icon={<GlobalOutlined />}
                            title="Global Scalability"
                            description="Infrastructure that grows with you, whether you have 500 students or 500,000."
                            delay={0.3}
                        />
                        <FeatureCard
                            icon={<ThunderboltOutlined />}
                            title="Lightning Fast"
                            description="Built on modern edge technology ensuring instant load times and seamless interactions."
                            delay={0.4}
                        />
                        <FeatureCard
                            icon={<CheckCircleOutlined />}
                            title="Automated Compliance"
                            description="Stay compliant with automated reporting and regulatory standard adherence tools."
                            delay={0.5}
                        />
                    </div>
                </div>
            </section>

            { }
            <section id="pricing" className="py-32 relative z-20 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="text-center max-w-3xl mx-auto mb-20"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                            Transparent, predictable pricing
                        </h2>
                        <p className="text-lg text-slate-500">
                            Choose the plan that best fits your institution's size and needs.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">
                        <PricingCard
                            name="Starter"
                            price="$99"
                            description="Essential tools for small schools."
                            features={['Up to 500 Students', 'Basic Reporting', 'Email Support', '5 Staff Accounts']}
                            delay={0}
                        />
                        <PricingCard
                            name="Professional"
                            price="$299"
                            description="Complete solution for growing institutions."
                            features={['Up to 2,000 Students', 'Advanced Analytics', 'Priority 24/7 Support', 'Unlimited Staff', 'API Access', 'Custom Branding']}
                            isPopular
                            delay={0.2}
                        />
                        <PricingCard
                            name="Enterprise"
                            price="Custom"
                            description="For large multi-branch organizations."
                            features={['Unlimited Students', 'Dedicated Success Manager', 'SLA Guarantees', 'On-Premise Deployment', 'Custom Integrations']}
                            delay={0.4}
                        />
                    </div>
                </div>
            </section>

            { }
            <footer className="bg-slate-900 py-16 text-slate-400 border-t border-slate-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
                        <div className="col-span-2 lg:col-span-2">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded flex items-center justify-center text-white">
                                    <DashboardOutlined />
                                </div>
                                <span className="text-xl font-bold text-white">SchoolHub</span>
                            </div>
                            <p className="max-w-xs text-sm leading-relaxed">
                                Empowering the next generation of educational institutions with technology that works.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-6">Product</h4>
                            <ul className="space-y-4 text-sm">
                                <li><a href="#" className="hover:text-indigo-400 transition-colors">Features</a></li>
                                <li><a href="#" className="hover:text-indigo-400 transition-colors">Pricing</a></li>
                                <li><a href="#" className="hover:text-indigo-400 transition-colors">Changelog</a></li>
                                <li><a href="#" className="hover:text-indigo-400 transition-colors">Docs</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-6">Company</h4>
                            <ul className="space-y-4 text-sm">
                                <li><a href="#" className="hover:text-indigo-400 transition-colors">About</a></li>
                                <li><a href="#" className="hover:text-indigo-400 transition-colors">Careers</a></li>
                                <li><a href="#" className="hover:text-indigo-400 transition-colors">Contact</a></li>
                                <li><a href="#" className="hover:text-indigo-400 transition-colors">Legal</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-6">Connect</h4>
                            <ul className="space-y-4 text-sm">
                                <li><a href="#" className="hover:text-indigo-400 transition-colors">Twitter</a></li>
                                <li><a href="#" className="hover:text-indigo-400 transition-colors">LinkedIn</a></li>
                                <li><a href="#" className="hover:text-indigo-400 transition-colors">GitHub</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
                        <p>© 2026 SchoolHub Inc. All rights reserved.</p>
                        <div className="flex gap-6">
                            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const StatItem = ({ number, label }: { number: string; label: string }) => (
    <div className="flex flex-col items-center group cursor-default">
        <div className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2 tracking-tight group-hover:scale-110 transition-transform duration-300">{number}</div>
        <div className="text-slate-500 font-medium text-sm uppercase tracking-wider group-hover:text-slate-400 transition-colors">{label}</div>
    </div>
);

const FeatureCard = ({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay }}
        whileHover={{ y: -5 }}
        className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:shadow-indigo-500/10 hover:border-indigo-100 transition-all duration-300 group"
    >
        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 text-xl mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-inner shadow-indigo-500/0">
            {icon}
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors">{title}</h3>
        <p className="text-slate-500 leading-relaxed text-sm">{description}</p>
    </motion.div>
);

const PricingCard = ({
    name,
    price,
    description,
    features,
    isPopular = false,
    delay
}: {
    name: string,
    price: string,
    description: string,
    features: string[],
    isPopular?: boolean,
    delay: number
}) => (
    <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay }}
        className={`bg-white p-8 rounded-3xl border ${isPopular ? 'border-indigo-200 shadow-2xl shadow-indigo-500/10 relative' : 'border-slate-200 shadow-lg'} flex flex-col h-full hover:border-indigo-200 transition-all duration-300`}
    >
        {isPopular && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-500/30">
                Most Popular
            </div>
        )}
        <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-900 mb-2">{name}</h3>
            <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-slate-900">{price}</span>
                {price !== 'Custom' && <span className="text-slate-500 text-sm">/month</span>}
            </div>
            <p className="text-slate-500 text-sm">{description}</p>
        </div>
        <div className="flex-1 mb-8">
            <ul className="space-y-4">
                {features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-600">
                        <CheckCircleOutlined className="text-indigo-600 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
        </div>
        <Button
            block
            size="large"
            type={isPopular ? 'primary' : 'default'}
            className={`h-12 rounded-xl font-semibold border ${isPopular ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 border-none' : 'bg-transparent border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600'}`}
        >
            Choose {name}
        </Button>
    </motion.div>
);
