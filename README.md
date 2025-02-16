# PKD Code Service

A Node.js service that provides PKD (Polish Classification of Activities) code suggestions based on service descriptions using AI and vector similarity search.

## Features

- Service description to PKD code matching using Qdrant vector database
- AI-powered suggestions using OpenAI GPT-4
- SQLite caching for both Qdrant queries and AI suggestions
- Separate endpoints for database-only and AI-only processing
- Express.js REST API

## Prerequisites

- Node.js
- SQLite3
- Qdrant instance
- OpenAI API access

## Environment Variables

```env
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_api_key
OPENAI_API_KEY=your_openai_api_key
PORT=3000 # optional, defaults to 3000
```

## API Endpoints

### GET /process/

Process a service description to get PKD code suggestions.

Query Parameters:
- `serviceDescription` (required): Description of the service to analyze
- `onlyDatabase` (optional): Return only Qdrant vector search results
- `onlyAi` (optional): Return only AI suggestions

Response Format:
```json
{
  "data": {
    "pkdCodeData": [...],     // When onlyDatabase=true or not specified
    "aiSuggestion": {...}     // When onlyAi=true or not specified
  }
}
```

## Caching

The service implements two-level caching using SQLite:
- `cache` table: Stores Qdrant query results
- `aiCache` table: Stores AI-generated suggestions

## Error Handling

- Environment variable validation
- Database connection error handling
- Global error middleware
- Proper error responses with 500 status codes

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Set up environment variables
4. Start the server:
```bash
npm start
```

## Dependencies

- express
- ai-service-hub (custom package for Qdrant and OpenAI integration)
- dotenv
- sqlite3

## License

This project is licensed under the MIT License. 