const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');

function setupRoutes(app) {
  app.use('/api/auth', authRoutes);
  app.use('/api/documents', documentRoutes);
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });
}

module.exports = { setupRoutes };