const app = require('./app');
const pino = require('pino')();

const PORT = process.env.PORT || 8001;

app.listen(PORT, () => {
  pino.info(`Users service running on port ${PORT}`);
});
