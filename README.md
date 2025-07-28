# Twitter Clone Backend (Node.js + Express)

A RESTful backend API for a Twitter-like application, built using Node.js, Express, and SQLite.

## Features

- User registration & login (with JWT Auth)
- Tweet CRUD operations
- Likes and Replies handling
- Follower/Following relationships
- Tweet feed (only from followed users)

## Tech Stack

- Node.js
- Express.js
- SQLite
- JWT Authentication
- Bcrypt (for password hashing)

## API Endpoints

- POST `/register/`
- POST `/login/`
- GET `/user/tweets/feed/`
- GET `/user/following/`
- GET `/user/followers/`
- GET `/tweets/:tweetId/`
- GET `/tweets/:tweetId/likes/`
- GET `/tweets/:tweetId/replies/`
- GET `/user/tweets/`
- POST `/user/tweets/`
- DELETE `/tweets/:tweetId/`

## How to Run

```bash
npm install
node app.js
