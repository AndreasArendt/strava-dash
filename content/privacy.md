# Privacy Policy and Data Usage Declaration

**Last updated:** 12.12.2025

## 1. Introduction
This website (“the Application”) integrates with the Strava API to provide authenticated access to Strava services. The Application is designed according to the principles of data minimization, purpose limitation, and privacy by design.

## 2. Data Collected
Upon authentication with Strava, the Application stores only the following information:

- Session ID – used to manage authenticated user sessions
- API rate-limit state (per session) – used solely to comply with Strava API usage limits
- Strava access token – used to access Strava API endpoints on the user’s behalf
- Strava refresh token – used to renew the access token when required

All tokens are stored with a time-to-live (TTL) of 30 days and are automatically invalidated and removed after expiration.

## 3. Data Explicitly Not Stored
The Application does **not** store:

- Athlete profile information (name, email address, username, gender, location, profile images)
- Activity or performance data
- Historical usage or analytics data
- Any personal identifiers beyond what is strictly required for authentication

Any athlete information returned during the OAuth authentication flow is immediately discarded and never persisted.

## 4. Purpose and Legal Basis for Processing (GDPR / UK GDPR)

Personal data is processed solely for the following purposes and legal bases under Article 6(1) of the GDPR and UK GDPR:

| Purpose | Data Involved | Legal Basis |
|-------|--------------|-------------|
| Authentication and session management | Session ID, access token, refresh token | Article 6(1)(b) – performance of a contract |
| Token refresh and API access | Access token, refresh token | Article 6(1)(b) – performance of a contract |
| Compliance with Strava API rate limits | Rate-limit state | Article 6(1)(f) – legitimate interest |

No data is processed for marketing, profiling, analytics, or automated decision-making.

## 5. Data Retention
All stored data is retained only for as long as necessary to support authentication and session management. Tokens and session data are automatically deleted after 30 days or earlier if no longer required.

## 6. Data Sharing
No personal data is sold, shared, or transferred to third parties. Data is used exclusively within the scope of this Application and solely to communicate with Strava’s API.

## 7. User Rights (GDPR / UK GDPR)
Users have the right to:

- Access information about stored data
- Request deletion of stored session or token data
- Withdraw consent by revoking the Application’s access via Strava

Because the Application does not store athlete profile or activity data, requests are typically resolved by immediate token invalidation.

## 8. Security
Appropriate technical and organizational measures are applied to protect stored data against unauthorized access, disclosure, alteration, or destruction.

## 9. Changes to This Policy
This policy may be updated if data handling practices change. Any updates will continue to comply with applicable data protection laws.

## 10. Contact
For privacy-related inquiries:

**Email:** andi.arendt@icloud.com
