

# FinWise Auth Module Documentation

Comprehensive authentication system with email/password, OAuth (Google/Apple), JWT tokens, and role-based access.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [API Endpoints](#api-endpoints)
- [Request/Response Examples](#requestresponse-examples)
- [Security](#security)
- [Testing](#testing)

## Overview

The auth module provides:
- **Email/Password Authentication** with Argon2 password hashing
- **OAuth Integration** with Google and Apple Sign-In
- **JWT Tokens** with access/refresh token rotation
- **Role-Based Access** (PARENT/CHILD roles)
- **Parent Verification** with ID document upload
- **Email Notifications** for account events
- **Rate Limiting** on auth endpoints

## Features

### User Roles

- **PARENT**: Full account with financial profile, requires ID verification
- **CHILD**: Limited account, linked to parent households via invitations

### Token System

- **Access Token**: Short-lived (15min), used for API requests
- **Refresh Token**: Long-lived (7d), stored securely, used to get new access tokens
- **Token Rotation**: Refresh tokens are rotated on each use for security

### Verification System

- Parents must upload ID image during signup
- Verification requests are created with PENDING status
- Email notifications sent at each verification stage
- Admins can approve/reject verification requests

## API Endpoints

### POST /auth/signup

Register a new user account.

**Content-Type**: `multipart/form-data`

**Body Parameters**:

**For PARENT:**
- `role`: "PARENT" (required)
- `name`: User's full name (required)
- `email`: Email address (required)
- `password`: Password (min 8 characters) (required)
- `country`: ISO-2 country code, e.g., "US" (required)
- `numberOfChildren`: Number of children (required)
- `monthlyIncomeBase`: Monthly income in base currency (required)
- `monthlyRentBase`: Monthly rent (optional)
- `monthlyLoansBase`: Monthly loan payments (optional)
- `otherNotes`: Additional notes (optional)
- `idImage`: ID document image file (required, max 5MB, JPEG/PNG/WebP)

**For CHILD:**
- `role`: "CHILD" (required)
- `name`: User's full name (required)
- `email`: Email address (required)
- `password`: Password (min 8 characters) (required)

**Success Response** (201):
```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "PARENT",
      "createdAt": "2025-10-29T10:00:00.000Z"
    },
    "verificationStatus": "PENDING",
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

**Error Responses**:
- `400`: Validation failed
- `409`: Email already registered
- `415`: Missing ID image for PARENT role
- `500`: Internal server error

---

### POST /auth/login

Authenticate with email and password.

**Content-Type**: `application/json`

**Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "PARENT"
    },
    "verificationStatus": "APPROVED",
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

**Error Responses**:
- `400`: Validation failed
- `401`: Invalid email or password
- `500`: Internal server error

---

### POST /auth/oauth

Authenticate with Google or Apple.

**Content-Type**: `application/json`

**Body**:
```json
{
  "provider": "google",
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Providers**: `"google"` or `"apple"`

**Success Response** (200):
```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "PARENT"
    },
    "verificationStatus": "PENDING",
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    },
    "isNewUser": true
  }
}
```

**Error Responses**:
- `400`: Validation failed or missing email from provider
- `401`: Invalid OAuth token
- `500`: Internal server error

---

### POST /auth/refresh

Refresh access token using refresh token.

**Content-Type**: `application/json`

**Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

**Note**: Old refresh token is automatically revoked (token rotation).

**Error Responses**:
- `400`: Validation failed
- `401`: Invalid, expired, or revoked token
- `500`: Internal server error

---

### POST /auth/logout

Revoke refresh token (logout).

**Content-Type**: `application/json`

**Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

### GET /auth/me

Get current user profile.

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Success Response** (200):
```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "PARENT",
      "avatarUrl": null,
      "createdAt": "2025-10-29T10:00:00.000Z"
    },
    "verificationStatus": "APPROVED",
    "parentProfile": {
      "country": "US",
      "numberOfChildren": 2,
      "monthlyIncomeBase": "5000.0000",
      "monthlyRentBase": "1500.0000",
      "monthlyLoansBase": "500.0000"
    }
  }
}
```

**Error Responses**:
- `401`: Unauthorized (missing/invalid token)
- `404`: User not found
- `500`: Internal server error

---

## Request/Response Examples

### Example: Parent Signup

```bash
curl -X POST http://localhost:3000/auth/signup \
  -F "role=PARENT" \
  -F "name=John Doe" \
  -F "email=john@example.com" \
  -F "password=securepass123" \
  -F "country=US" \
  -F "numberOfChildren=2" \
  -F "monthlyIncomeBase=5000" \
  -F "monthlyRentBase=1500" \
  -F "idImage=@/path/to/id.jpg"
```

### Example: Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepass123"
  }'
```

### Example: Using Access Token

```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### Example: Refresh Token

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

## Security

### Password Security
- **Argon2id** hashing with strong parameters
- **Constant-time** comparison to prevent timing attacks
- Automatic **rehashing** when parameters change

### Token Security
- **JWT** with RS256 or HS256 signing
- **Short-lived** access tokens (15min)
- **Refresh token rotation** on every use
- Tokens stored as **SHA256 hashes** in database
- Automatic **cleanup** of expired tokens

### Rate Limiting
- **Signup**: 3 attempts per hour per IP
- **Login**: 5 attempts per 15min per IP
- **OAuth**: 5 attempts per 15min per IP
- **Global**: 100 requests per 15min per IP

### File Upload Security
- **File type validation** (JPEG, PNG, WebP only)
- **File size limit** (5MB max)
- **Random filename** generation
- **Separate storage** for uploads

### OAuth Security
- **Server-side token verification**
- Google: Using official Google Auth Library
- Apple: Using Apple Sign-In verification
- No client secrets exposed

## Testing

### Unit Tests

Run unit tests:
```bash
npm test
```

### Integration Tests

Test signup flow:
```bash
npm run test:integration -- --grep "signup"
```

### Manual Testing

1. **Start the server**:
```bash
npm run dev
```

2. **Test parent signup** (using Postman or curl)
3. **Test login** with created credentials
4. **Test refresh token** rotation
5. **Test protected endpoint** (`/auth/me`)

### Test Coverage

Key test scenarios:
- ✅ Parent signup with ID image
- ✅ Child signup without ID image
- ✅ Login with valid credentials
- ✅ Login with invalid credentials
- ✅ OAuth with Google
- ✅ OAuth with Apple
- ✅ Token refresh and rotation
- ✅ Token expiration
- ✅ Logout and token revocation
- ✅ Protected route access
- ✅ Rate limiting enforcement

## Environment Setup

1. **Copy environment template**:
```bash
cp .env.example .env
```

2. **Configure database**:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/finwise"
```

3. **Configure JWT secrets**:
```env
JWT_ACCESS_SECRET=your-strong-random-secret-here
JWT_REFRESH_SECRET=your-different-strong-random-secret-here
```

4. **Configure SMTP** (Gmail example):
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
MAIL_FROM=noreply@finwise.app
```

5. **Configure OAuth** (optional):
```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
APPLE_CLIENT_ID=your.apple.service.id
```

6. **Run database migrations**:
```bash
npm run prisma:migrate
```

7. **Start the server**:
```bash
npm run dev
```

## Troubleshooting

### Common Issues

**"Missing ID image for parent accounts"**
- Ensure you're using `multipart/form-data`
- Include `idImage` file in the request
- Check file size is under 5MB

**"Invalid Google token"**
- Verify `GOOGLE_CLIENT_ID` matches your OAuth configuration
- Ensure token is fresh (not expired)
- Check token is for the correct client ID

**"Email already registered"**
- Use a different email address
- Or login with existing credentials

**"Too many authentication attempts"**
- Wait 15 minutes before retrying
- Check for rate limiting in logs

**"SMTP connection failed"**
- Verify SMTP credentials
- Check firewall settings
- For Gmail, use App Passwords

## Next Steps

- Implement email verification flow
- Add password reset functionality
- Create admin dashboard for verification review
- Implement household invitation system
- Add two-factor authentication (2FA)
- Add social login with Facebook/Twitter
