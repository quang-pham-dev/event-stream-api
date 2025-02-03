# EVENT-STREAM-API

## Table of Contents

- [EVENT-STREAM-API](#event-stream-api)
  - [Table of Contents](#table-of-contents)
  - [Getting Started - Local Development](#getting-started---local-development)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
  - [Available Scripts](#available-scripts)
    - [`pnpm run start:dev`](#pnpm-run-startdev)
    - [`pnpm run test`](#pnpm-run-test)
    - [`pnpm run build`](#pnpm-run-build)
    - [`pnpm run start:prod`](#pnpm-run-startprod)
  - [Features](#features)
  - [Environment Variables](#environment-variables)
  - [AWS Integration](#aws-integration)

## Getting Started - Local Development

### Prerequisites

Make sure you have the following installed on your system:

- Node.js (v20 or later recommended)
- pnpm (comes with Node.js)
- AWS Account (for S3 and CloudFront features)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Copy the example environment file and configure your variables:
   ```bash
   cp .env.example .env
   ```

## Available Scripts

In the project directory, you can run:

### `pnpm run start:dev`

Runs the app in development mode with watch mode enabled.
The application will automatically reload if you change any of the source files.

### `pnpm run test`

Launches the test runner.
Additional test scripts:

- `pnpm run test:watch` - Run tests in watch mode
- `pnpm run test:cov` - Generate test coverage report
- `pnpm run test:e2e` - Run end-to-end tests

### `pnpm run build`

Builds the app for production to the `dist` folder.
Uses the NestJS CLI to create an optimized production build.

### `pnpm run start:prod`

Runs the built application in production mode.
Make sure to run `pnpm run build` before using this command.

## Features

- AWS S3 Integration for file storage
- AWS CloudFront CDN support
- File upload handling with Multer
- Image processing with Sharp
- Rate limiting
- Security features with Helmet
- Compression for response optimization
- Cookie parsing
- Request IP tracking
- Swagger API documentation

## Environment Variables

| Variable Name              | Description                      | Required |
| -------------------------- | -------------------------------- | -------- |
| AWS_REGION                 | AWS Region for S3 and CloudFront | Yes      |
| AWS_ACCESS_KEY_ID          | AWS Access Key                   | Yes      |
| AWS_SECRET_ACCESS_KEY      | AWS Secret Access Key            | Yes      |
| S3_BUCKET_NAME             | Name of the S3 bucket            | Yes      |
| CLOUDFRONT_DISTRIBUTION_ID | CloudFront Distribution ID       | Yes      |
| PORT                       | Server port (default: 3000)      | No       |

## AWS Integration

This project uses several AWS services:

- **S3**: For file storage
- **CloudFront**: As CDN for file distribution
- **AWS SDK v3**: Latest version of AWS SDK for JavaScript
