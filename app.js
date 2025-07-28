const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const databasePath = path.join(__dirname, 'twitterClone.db')

const app = express()

app.use(express.json())

let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log('Server Running at http://localhost:3000/'),
    )
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

const authenticateToken = (request, response, next) => {
  const authHeader = request.headers['authorization']
  let jwtToken

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }

  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'nxtwave', (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        request.userId = payload.userId
        next()
      }
    })
  }
}

const getFollowingPeopleUserId = async username => {
  const getFollowingPeopleQuery = `
    SELECT following_user_id
    FROM follower f INNER JOIN user u
    ON f.follower_user_id = u.user_id 
    WHERE u.username = '${username}';
  `

  const followingPeople = await db.all(getFollowingPeopleQuery)

  const arrayOfIds = followingPeople.map(eachUser => eachUser.following_user_id)

  return arrayOfIds
}

//API-1

app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const selecyQuery = `
        SELECT * 
        FROM user
        WHERE username = '${username}'
    `

  const dbRepsonse = await db.get(selecyQuery)

  if (dbRepsonse !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const registerQuery = `
        INSERT INTO user(username, password, name, gender)
        VALUES(
            '${username}',
            '${hashedPassword}',
            '${name}',
            '${gender}'
        )
    `
      await db.run(registerQuery)
      response.status(200)
      response.send('User created successfully')
    }
  }
})

//API-2

app.post('/login/', async (request, response) => {
  const {username, password} = request.body

  const selectQuery = `
    SELECT * 
    FROM user
    WHERE username = '${username}'
  `
  const dbResponse = await db.get(selectQuery)

  if (dbResponse === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordCorrect = await bcrypt.compare(
      password,
      dbResponse.password,
    )
    if (isPasswordCorrect) {
      const payload = {
        username: dbResponse.username,
        userId: dbResponse.user_id,
      }

      const jwtToken = jwt.sign(payload, 'nxtwave')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API-3

app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  const {username} = request

  const followingPeopleIds = await getFollowingPeopleUserId(username)

  const getTweetQuery = `
    SELECT username, tweet, date_time 
    FROM user u INNER JOIN tweet t
    ON u.user_id = t.user_id 
    WHERE u.user_id IN (${followingPeopleIds})
    ORDER BY date_time DESC 
    LIMIT 4 ;
  `

  const tweets = await db.all(getTweetQuery)
  response.send(
    tweets.map(tweet => ({
      username: tweet.username,
      tweet: tweet.tweet,
      dateTime: tweet.date_time,
    })),
  )
})

// API- 4

app.get('/user/following/', authenticateToken, async (request, response) => {
  const {username, userId} = request

  const getFollowingPeopleQuery = `
    SELECT name 
    FROM follower f INNER JOIN user u
    ON f.following_user_id = u.user_id
    WHERE follower_user_id = ${userId} ;
  `
  const followingPeople = await db.all(getFollowingPeopleQuery)
  response.send(followingPeople)
})

// API - 5

app.get('/user/followers/', authenticateToken, async (request, response) => {
  const {username, userId} = request

  const getFollowersQuery = `
    SELECT name 
    FROM follower f INNER JOIN user u
    ON f.follower_user_id = u.user_id
    WHERE following_user_id = ${userId} ;
  `

  const followers = await db.all(getFollowersQuery)
  response.send(followers)
})

// API - 6

const tweetAcessVerification = async (request, response, next) => {
  const {username, userId} = request
  const {tweetId} = request.params

  const getTweetQuery = `
    SELECT * 
    FROM follower f INNER JOIN tweet t
    ON f.following_user_id = t.user_id
    WHERE t.tweet_id = ${tweetId} AND follower_user_id = ${userId};
  `

  const tweet = await db.get(getTweetQuery)
  if (tweet === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    next()
  }
}

app.get(
  '/tweets/:tweetId/',
  authenticateToken,
  tweetAcessVerification,
  async (request, response) => {
    const {username, userId} = request
    const {tweetId} = request.params

    const getTweetQuery = `
    SELECT tweet,
    (SELECT COUNT(like_id) FROM like WHERE tweet_id = '${tweetId}') AS likes,
    (SELECT COUNT(reply_id) FROM reply WHERE tweet_id = '${tweetId}') AS replies,
    date_time AS dateTime 

    FROM tweet  
    WHERE tweet.tweet_id = '${tweetId}';
  `

    const tweet = await db.get(getTweetQuery)
    response.send(tweet)
  },
)

// API - 7

app.get(
  '/tweets/:tweetId/likes/',
  authenticateToken,
  tweetAcessVerification,
  async (request, response) => {
    const {tweetId} = request.params

    const getLikesQuery = `
      SELECT username 
      FROM user u INNER JOIN like l 
      ON u.user_id = l.user_id
      WHERE tweet_id = ${tweetId} ;
    `

    const userLiked = await db.all(getLikesQuery)
    const userArray = userLiked.map(eachUser => eachUser.username)
    response.send({likes: userArray})
  },
)

// API - 8

app.get(
  '/tweets/:tweetId/replies/',
  authenticateToken,
  tweetAcessVerification,
  async (request, response) => {
    const {tweetId} = request.params

    const getRepliesQuery = `
      SELECT name, reply 
      FROM user u INNER JOIN reply r 
      ON u.user_id = r.user_id
      WHERE tweet_id = ${tweetId} ;
    `

    const userReplied = await db.all(getRepliesQuery)
    response.send({replies: userReplied})
  },
)

// API - 9

app.get('/user/tweets/', authenticateToken, async (request, response) => {
  const {userId} = request

  const getTweetQuery = `
    SELECT tweet,
    COUNT(DISTINCT like_id) AS likes,
    COUNT(DISTINCT reply_id) AS replies,
    date_time AS dateTime

    FROM tweet t LEFT JOIN reply r 
    ON t.tweet_id = r.tweet_id LEFT JOIN like l ON t.tweet_id = l.tweet_id
    WHERE t.user_id = ${userId} 
    GROUP BY t.tweet_id;
  `

  const dbReponse = await db.all(getTweetQuery)
  response.send(dbReponse)
})

// API - 10

app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const {tweet} = request.body

  const userId = parseInt(request.userId)
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // JS months are 0-based
  const day = now.getDate()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()

  const formatted =
    year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds

  const createTweetQuery = `
  INSERT INTO tweet(tweet, user_id, date_time)
  VALUES(
    '${tweet}',
    '${userId}',
    '${formatted}'
  );
  `

  await db.run(createTweetQuery)
  response.send('Created a Tweet')
})

// API - 11

app.delete(
  '/tweets/:tweetId/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request.params
    const {userId} = request

    const selectTweetQuery = `
    SELECT * FROM tweet WHERE tweet_id = ${tweetId} AND user_id = ${userId}
  `

    const tweet = await db.get(selectTweetQuery)
    if (tweet === undefined) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const deleteTweetQuery = `
      DELETE FROM tweet 
      WHERE tweet_id = ${tweetId}
    `
      await db.run(deleteTweetQuery)
      response.send('Tweet Removed')
    }
  },
)

module.exports = app
