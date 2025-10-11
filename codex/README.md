# Codex - Document Management System

Codex is a comprehensive document management system built with Node.js that supports S3-compatible storage, LDAP/AD authentication, and fine-grained access control.

## Features

- **Multi-storage support**: Store documents on disk or S3-compatible storage (AWS S3, MinIO, etc.)
- **LDAP/AD Integration**: Authenticate users against existing LDAP/AD infrastructure
- **Advanced Access Control**: Matrix-based permissions system with read, write, delete, and admin permissions
- **Metadata Extraction**: Automatic extraction of document metadata and text content
- **Full-Text Search**: Search through extracted text and document properties
- **Secure API**: JWT-based authentication with role-based access control

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- LDAP/AD server (optional, for authentication)
- S3-compatible storage (optional, for cloud storage)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/codex.git
cd codex
```

2. Install dependencies:
```bash
npm install
```

3. Set up configuration:
```bash
cp .env.example .env
```

4. Configure the `.env` file with your settings (see Configuration section below).

## Configuration

The system can be configured via environment variables in the `.env` file or via JSON configuration files in the `config/` directory.

### Available Configuration Options

#### Application
- `PORT`: Server port (default: 3000)
- `JWT_SECRET`: Secret key for JWT tokens
- `MONGODB_URI`: MongoDB connection string

#### Storage
- `STORAGE_TYPE`: 's3' or 'disk' (default: 'disk')
- `UPLOAD_DIR`: Directory for file uploads (when using disk storage)

#### S3 Storage (when STORAGE_TYPE=s3)
- `S3_ACCESS_KEY_ID`: AWS access key ID
- `S3_SECRET_ACCESS_KEY`: AWS secret access key
- `S3_REGION`: AWS region
- `S3_BUCKET`: S3 bucket name
- `S3_ENDPOINT`: Custom S3 endpoint (for MinIO or other S3-compatible services)

#### LDAP/AD
- `LDAP_URL`: LDAP server URL (e.g., ldap://ldap.example.com:389)
- `LDAP_BIND_DN`: Bind DN for LDAP connection
- `LDAP_BIND_CREDENTIALS`: Bind password
- `LDAP_SEARCH_BASE`: Base DN for user searches
- `LDAP_SEARCH_FILTER`: Search filter template (e.g., (uid={{username}}))

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout (client-side token invalidation)

### Documents
- `POST /api/documents/upload` - Upload a document
- `GET /api/documents` - List accessible documents
- `GET /api/documents/:id` - Get document details
- `GET /api/documents/:id/download` - Download document
- `PUT /api/documents/:id/permissions` - Update document permissions
- `GET /api/documents/:id/permissions` - Get document permissions
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/search` - Search documents

## Usage Examples

### Authentication
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your-username","password":"your-password"}'
```

### Document Upload
```bash
# Upload a document (requires authentication token)
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@path/to/your/document.pdf"
```

### Document Search
```bash
# Search for documents containing specific text
curl -X POST http://localhost:3000/api/documents/search \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"search term", "tags":["important"]}'
```

## Development

To run the application in development mode:

```bash
npm run dev
```

To run tests:

```bash
npm test
```

## Security Considerations

- Always use HTTPS in production
- Secure your JWT secret key
- Configure rate limiting appropriately
- Regularly update dependencies
- Validate and sanitize all file uploads

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.