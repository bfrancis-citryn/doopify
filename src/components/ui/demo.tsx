import { Component } from '@/components/ui/etheral-shadow';

const DemoOne = () => {
  return (
    <div style={{ width: '100%', minHeight: '100vh' }}>
      <Component
        color="rgba(128, 128, 128, 1)"
        animation={{ scale: 100, speed: 90 }}
        noise={{ opacity: 1, scale: 1.2 }}
        sizing="fill"
        style={{ minHeight: '100vh' }}
      />
    </div>
  );
};

export { DemoOne };
