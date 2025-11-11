import pino from 'pino';

const transport = pino.transport({
    target: 'pino-pretty',
    options: { colorize: true }
});

const logger = pino(
    {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        base: {
            pid: false,
        },
        timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
    },
    process.env.NODE_ENV !== 'production' ? transport : undefined
);

export default logger;