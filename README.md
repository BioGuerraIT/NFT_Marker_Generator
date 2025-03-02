# NFT Marker Generator API

This API allows you to create NFT markers and associated AR content from images.

## Features

- Upload images to create NFT markers
- Process images with Novita.ai
- Store markers and videos in S3
- Resize images to optimal dimensions

## Prerequisites

- Node.js >= 18.0.0
- npm >= 10.2.4
- AWS S3 bucket
- Novita.ai API key

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with the following variables:

```
AWS_REGION=your-aws-region
AWS_BUCKET_NAME=your-bucket-name
NOVITA_API_KEY=your-novita-api-key
CORS_ORIGIN=*
```

## Running the Application

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

### POST /create-nft

Upload an image to create an NFT marker and associated AR content.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: 
  - image: File (JPEG, PNG)

**Response:**
```json
{
  "success": true,
  "markerUrl": "https://example.com/marker.jpg",
  "videoUrl": "https://example.com/video.mp4"
}
```

### GET /health

Check the health status of the API.

**Request:**
- Method: GET

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2023-12-13T12:00:00.000Z"
}
```

## Testing

The application includes a test suite using Jest. To run the tests:

### Run all tests

```bash
npm test
```

### Run specific tests

```bash
# Run basic tests
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/basic.test.js

# Run server health check test
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/server.test.js
```

## CI/CD

This project uses GitHub Actions for continuous integration. Tests are automatically run on every push to the main branch.

The workflow configuration is in `.github/workflows/test.yml`.

## Docker

A Dockerfile is included for containerization. To build and run the Docker image:

```bash
docker build -t nft-marker-generator .
docker run -p 3000:3000 --env-file .env nft-marker-generator
```

## License

ISC 