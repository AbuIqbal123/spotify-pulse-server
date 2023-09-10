/* eslint-disable no-undef */
const express = require('express');
const querystring = require('querystring');
const axios = require('axios');
const session = require('express-session');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000; 
const clientURL = process.env.CLIENT_URL;
const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
} = process.env;

const allowedOrigins = [clientURL, 'https://spotify-pulse-server-e685bcad0165.herokuapp.com'];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(
  session({
    secret: 'your-secret-key',
    resave: true,
    saveUninitialized: true,
  })
);

const generateRandomString = (length) => {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
};

const clientID = SPOTIFY_CLIENT_ID;
const clientSecret = SPOTIFY_CLIENT_SECRET;
const redirectURI = SPOTIFY_REDIRECT_URI;

app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  const scope = 'user-read-private user-read-email user-top-read';

  req.session.state = state;

  res.redirect(
    `https://accounts.spotify.com/authorize?${querystring.stringify({
      response_type: 'code',
      client_id: clientID,
      scope,
      redirect_uri: redirectURI,
      state,
    })}`
  );
});

app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (state === null) {
    return res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }));
  }

  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code,
      redirect_uri: redirectURI,
      grant_type: 'authorization_code',
    },
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientID}:${clientSecret}`).toString('base64')}`,
    },
    json: true,
  };

  try {
    const response = await axios.post(
      authOptions.url,
      querystring.stringify(authOptions.form),
      {
        headers: authOptions.headers,
      }
    );

    const access_token = response.data.access_token;
    const refresh_token = response.data.refresh_token;

    req.session.access_token = access_token;
    req.session.refresh_token = refresh_token;

    res.redirect(`https:spotify-pulse.netlify.app/#callback?access_token=${access_token}`);
  } catch (error) {
    res.redirect('/error');
  }
});

const handleFetchTopData = async (req, res, endpoint) => {
  const accessToken = req.headers.authorization;

  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const response = await axios.get(`https://api.spotify.com/v1/me/top/${endpoint}?limit=10`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error(`Error fetching top ${endpoint}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

app.get('/fetchTopArtists', (req, res) => {
  handleFetchTopData(req, res, 'artists');
});

app.get('/fetchTopTracks', (req, res) => {
  handleFetchTopData(req, res, 'tracks');
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
